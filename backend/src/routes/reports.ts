import express, { Request } from "express";
import { Prisma, Category, Status } from "@prisma/client";

import { prisma } from "../lib/prisma";
import { enhanceReport } from "../lib/ai";
import { asyncHandler } from "../utils/asyncHandler";
import { requireAuth } from "../middleware/requireAuth";

// Same pattern as routes/auth.ts: a Router is a mini Express app, and index.ts
// mounts the whole thing with `app.use("/api/reports", reportRoutes)`. So "/"
// below is served at "/api/reports" and "/:id" at "/api/reports/:id".
const router = express.Router();

// ---------------------------------------------------------------------------
// CONSTANTS
// ---------------------------------------------------------------------------

// The exact fields a report response contains. Same allowlist idea as
// SAFE_USER_FIELDS in auth.ts, and the reason is identical: the author's email
// and password hash are never even FETCHED from the database, so they cannot
// leak by us forgetting to delete a field.
//
// Note the nested `user` select. Prisma turns this into a single SQL query with
// a join rather than one query per report — which is what avoids the classic
// N+1 problem (fetch 20 reports, then fire 20 more queries to get each author).
//
// `satisfies` checks the shape against Prisma's type WITHOUT widening the
// `true` values to `boolean`, which is what lets Prisma infer the exact return
// type. A plain `const` would widen them and lose that.
// EXPORTED as of Module 5. routes/stats.ts imports this to build its "recent
// reports" list, so a report on the dashboard is byte-identical to a report
// anywhere else in the API — same 15 fields, same nested { id, name } author.
//
// The alternative was a slimmed-down "recent report" shape with just a title and
// a date. That would be a SECOND definition of what a report looks like, and two
// definitions of the same thing drift apart the moment one of them is edited.
// One shape means the frontend has one TypeScript type and one card component.
export const REPORT_SELECT = {
  id: true,
  title: true,
  description: true,
  imageUrl: true,
  category: true,
  severity: true,
  status: true,
  latitude: true,
  longitude: true,
  aiSummary: true,
  aiTags: true,
  // Added in Module 4. Every report response says where its AI enhancement got
  // to, so a client can show a spinner (PENDING), the enriched fields
  // (COMPLETED), or a Retry button (FAILED) without guessing from null columns.
  aiStatus: true,
  createdAt: true,
  updatedAt: true,
  // Only id and name. There is deliberately no separate `userId` field in the
  // response — `user.id` IS the author's id, and one representation beats two.
  user: { select: { id: true, name: true } },
} satisfies Prisma.ReportSelect;

// Read the valid enum values off Prisma's generated objects rather than
// hand-copying the lists. Add a sixth Category to schema.prisma and this
// validator updates itself; a hand-written array would silently drift.
const VALID_CATEGORIES = Object.values(Category);
const VALID_STATUSES = Object.values(Status);

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;

// A HARD CEILING on how many rows one request can ask for.
//
// `limit` is an attacker-controlled number that goes straight into a database
// query. Without a cap, `?limit=10000000` asks Postgres to materialise every
// report, Node to serialise all of it to JSON, and the process to hold it in
// memory — from one unauthenticated request. That is a denial of service that
// costs the attacker nothing.
const MAX_LIMIT = 100;

// The four bounding-box query params, kept together so the "all four or none"
// rule is expressed once.
const BOX_KEYS = ["minLat", "maxLat", "minLng", "maxLng"] as const;

// ---------------------------------------------------------------------------
// VALIDATION HELPERS
//
// Hand-written, matching the auth module. A library like Zod would be less
// repetitive and would hand us types for free — a deliberate scope decision,
// noted in the docs rather than silently skipped.
//
// Each helper returns an ERROR MESSAGE STRING, or null when the value is fine.
// That reads as `if (error) return 400` at every call site.
// ---------------------------------------------------------------------------

// For values arriving in req.body. Because req.body is real parsed JSON, types
// survive the trip: 42 arrives as a number and "42" as a string. So we can
// demand an actual number here.
//
// THIS IS THE CHECK THAT STOPS NaN. `Number("abc")` is NaN, and NaN sails
// happily into a Float column if nobody looks. Requiring `typeof === "number"`
// means a string never gets converted in the first place; Number.isFinite then
// rules out Infinity (which JSON cannot carry, but the guard is free).
function checkBodyCoordinate(
  value: unknown,
  name: string,
  limit: number
): string | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return `${name} must be a number`;
  }
  if (value < -limit || value > limit) {
    return `${name} must be between -${limit} and ${limit}`;
  }
  return null;
}

// Non-empty-after-trimming string check, used for title and description.
function checkText(value: unknown, name: string): string | null {
  if (typeof value !== "string" || value.trim() === "") {
    return `${name} is required and cannot be empty`;
  }
  return null;
}

function checkEnum(
  value: unknown,
  validValues: readonly string[],
  name: string
): string | null {
  if (typeof value !== "string" || !validValues.includes(value)) {
    return `${name} must be one of: ${validValues.join(", ")}`;
  }
  return null;
}

// Everything in req.query is a STRING (or an array, if the same key is repeated,
// or undefined). We only ever accept a single string; a repeated key is treated
// as absent rather than guessed at.
function singleQueryValue(raw: unknown): string | undefined {
  return typeof raw === "string" ? raw : undefined;
}

// For coordinates arriving as query params, where we DO have to convert.
// Returns null when the text is not a usable number.
//
// The empty-string case matters: `Number("")` is 0, not NaN. Without the guard,
// `?minLat=` would silently become a perfectly valid latitude of zero.
function parseQueryNumber(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;

  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) return null;

  return parsed;
}

// Reads ?page= and ?limit=, shared by GET / and GET /mine.
//
// Returns either the parsed values or an error message. Non-numeric, zero and
// negative values are REJECTED rather than silently falling back to the default,
// because `?page=-1` is a bug in the caller and hiding it helps nobody.
//
// `limit` above the cap is the one exception: it is CLAMPED, not rejected.
// Asking for more than we will give is not a client error — "as many as you can"
// is a reasonable request, and 100 is a reasonable answer to it.
function parsePagination(
  query: Request["query"]
): { page: number; limit: number } | { error: string } {
  let page = DEFAULT_PAGE;
  let limit = DEFAULT_LIMIT;

  const rawPage = singleQueryValue(query.page);
  if (rawPage !== undefined) {
    const parsed = parseQueryNumber(rawPage);
    if (parsed === null || !Number.isInteger(parsed) || parsed < 1) {
      return { error: "page must be a whole number of 1 or more" };
    }
    page = parsed;
  }

  const rawLimit = singleQueryValue(query.limit);
  if (rawLimit !== undefined) {
    const parsed = parseQueryNumber(rawLimit);
    if (parsed === null || !Number.isInteger(parsed) || parsed < 1) {
      return { error: "limit must be a whole number of 1 or more" };
    }
    limit = Math.min(parsed, MAX_LIMIT);
  }

  return { page, limit };
}

// ---------------------------------------------------------------------------
// SHARED QUERY — used by GET / and GET /mine
// ---------------------------------------------------------------------------
//
// Runs the list query and builds the paginated envelope.
//
// The IMPORTANT detail is that findMany and count receive the SAME `where`
// object. If the two ever drifted apart, `total` would describe a different set
// of rows than `data`, and the client's page count would be quietly wrong.
//
// Promise.all runs them concurrently — they are independent queries, so there is
// no reason to wait for one before starting the other.
async function listReports(
  where: Prisma.ReportWhereInput,
  page: number,
  limit: number
) {
  const [data, total] = await Promise.all([
    prisma.report.findMany({
      where,
      select: REPORT_SELECT,
      // Newest first. A stable, explicit order matters for pagination: without
      // orderBy, Postgres makes no promise about row order at all, and the same
      // row could appear on two different pages.
      orderBy: { createdAt: "desc" },
      // skip -> SQL OFFSET, take -> SQL LIMIT.
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.report.count({ where }),
  ]);

  return {
    data,
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  };
}

// ---------------------------------------------------------------------------
// POST /api/reports   (protected)   -> 201
// ---------------------------------------------------------------------------
router.post(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    // WE DESTRUCTURE ONLY THE FIELDS WE ACCEPT. This is not a style choice — it
    // is the security control.
    //
    // Anything else the client sends (userId, severity, status, aiSummary,
    // aiTags) is simply never read, so ignoring it is automatic rather than
    // something we have to remember at every use site. The dangerous
    // alternative, `data: { ...req.body, userId }`, would hand the client a
    // direct line into the database — a mass-assignment vulnerability.
    const { title, description, category, latitude, longitude, imageUrl } =
      req.body;

    const titleError = checkText(title, "title");
    if (titleError) return res.status(400).json({ error: titleError });

    const descriptionError = checkText(description, "description");
    if (descriptionError)
      return res.status(400).json({ error: descriptionError });

    const categoryError = checkEnum(category, VALID_CATEGORIES, "category");
    if (categoryError) return res.status(400).json({ error: categoryError });

    const latError = checkBodyCoordinate(latitude, "latitude", 90);
    if (latError) return res.status(400).json({ error: latError });

    const lngError = checkBodyCoordinate(longitude, "longitude", 180);
    if (lngError) return res.status(400).json({ error: lngError });

    // Optional. Accepted only as a string; no upload here, the client sends a
    // URL (Cloudinary comes later).
    if (imageUrl !== undefined && imageUrl !== null) {
      if (typeof imageUrl !== "string") {
        return res.status(400).json({ error: "imageUrl must be a string" });
      }
    }

    const report = await prisma.report.create({
      data: {
        title: title.trim(),
        description: description.trim(),
        category,
        latitude,
        longitude,
        imageUrl: imageUrl ?? null,

        // ---- THE MOST IMPORTANT LINE IN THIS FILE ------------------------
        // The author comes from req.userId, which requireAuth derived from a
        // cryptographically verified JWT. It NEVER comes from req.body.
        //
        // req.body.userId is not "the user's id" — it is a string the client
        // typed. Trusting it would let any logged-in user file reports in
        // someone else's name, and then pass the ownership check on a report
        // they do not own. It turns every authorisation check in the entire
        // application into a polite suggestion.
        //
        // `!` is safe because requireAuth guarantees userId is set; the route
        // is unreachable otherwise.
        userId: req.userId!,

        // severity, aiSummary and aiTags are deliberately absent — they are
        // nullable and stay null until the AI pipeline below fills them.
        // status is absent too, so the database's @default(OPEN) applies, and
        // aiStatus is absent for the same reason: @default(PENDING) supplies it.
      },
      select: REPORT_SELECT,
    });

    // ---- FIRE AND FORGET: THE WHOLE POINT OF MODULE 4 --------------------
    //
    // NOTE THE MISSING `await`. That is not an oversight, it is the feature.
    //
    // An async function starts executing immediately and returns a promise;
    // `await` is what suspends the CALLER until that promise settles. Leave it
    // out and this line kicks off the Groq call and returns instantly, so
    // execution falls straight through to res.json() below. The 201 is on the
    // wire in milliseconds while Groq is still thinking.
    //
    // That is how the code ENFORCES "AI is an enhancement, never a dependency":
    // the response path never touches the AI call's result, so it cannot be
    // slowed by it and cannot fail because of it. If Groq is down, rate-limited
    // or takes 10 seconds, this endpoint still returns 201 just as fast.
    //
    // THE DANGER THIS CREATES: a promise nobody awaits that REJECTS becomes an
    // unhandled promise rejection, and Node's default since v15 is to terminate
    // the process — the entire server, not just this request. enhanceReport is
    // written so it can never reject (every path inside it is caught, including
    // the write inside its own catch block).
    //
    // The .catch() here is defence in depth. It should never fire — the
    // guarantee lives in enhanceReport — but it makes the requirement visible at
    // the call site and survives someone later editing that function badly.
    enhanceReport(report.id, report.title, report.description).catch((error) => {
      console.error("[ai] unexpected rejection escaped enhanceReport", error);
    });

    // 201 Created — a new resource now exists. aiStatus on it is "PENDING".
    return res.status(201).json({ report });
  })
);

// ---------------------------------------------------------------------------
// GET /api/reports/mine   (protected)   -> 200
// ---------------------------------------------------------------------------
//
// !!! THIS MUST BE REGISTERED BEFORE "/:id" !!!
//
// Express keeps routes in an ORDERED LIST and takes the FIRST match. It does not
// look for the best match, and it does not prefer a literal segment over a
// parameter. "/:id" means "match any single path segment" — and "mine" is a
// single path segment.
//
// Registered the other way round, GET /api/reports/mine would hit "/:id" with
// req.params.id === "mine", Prisma would look for a report whose id is the
// literal string "mine", find nothing, and return a completely plausible 404
// that sends you debugging in entirely the wrong place.
//
// Rule: specific routes above general ones. Express has no route-ranking layer.
router.get(
  "/mine",
  requireAuth,
  asyncHandler(async (req, res) => {
    const pagination = parsePagination(req.query);
    if ("error" in pagination) {
      return res.status(400).json({ error: pagination.error });
    }

    const result = await listReports(
      { userId: req.userId! },
      pagination.page,
      pagination.limit
    );

    return res.status(200).json(result);
  })
);

// ---------------------------------------------------------------------------
// GET /api/reports   (PUBLIC)   -> 200
// ---------------------------------------------------------------------------
//
// No requireAuth. Reads are public on purpose: civic issues are public
// information, and the whole point of the platform is that a citizen can see
// that eleven neighbours reported the same pothole. Writes are still protected —
// "anyone may look, only the author may change" is the entire permission model.
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const pagination = parsePagination(req.query);
    if ("error" in pagination) {
      return res.status(400).json({ error: pagination.error });
    }

    // Built up one filter at a time. Every key present on this object is
    // combined with AND by Prisma, which is exactly the behaviour we want.
    const where: Prisma.ReportWhereInput = {};

    const category = singleQueryValue(req.query.category);
    if (category !== undefined) {
      const error = checkEnum(category, VALID_CATEGORIES, "category");
      if (error) return res.status(400).json({ error });
      where.category = category as Category;
    }

    const status = singleQueryValue(req.query.status);
    if (status !== undefined) {
      const error = checkEnum(status, VALID_STATUSES, "status");
      if (error) return res.status(400).json({ error });
      where.status = status as Status;
    }

    // Case-insensitive substring match across title OR description.
    //
    // `mode: "insensitive"` is a Prisma feature specific to PostgreSQL — it
    // emits SQL's ILIKE instead of LIKE. Doing it in the database rather than
    // lowercasing in JavaScript matters: JS filtering would require fetching
    // every row first, which defeats the point of pagination entirely.
    //
    // A whitespace-only search is treated as ABSENT, not as a filter that
    // matches nothing. `?search=` from an empty input box should show
    // everything, not an empty list.
    const rawSearch = singleQueryValue(req.query.search);
    if (rawSearch !== undefined && rawSearch.trim() !== "") {
      const search = rawSearch.trim();
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }

    // ---- BOUNDING BOX ----------------------------------------------------
    // Two plain range comparisons on two Float columns — a RECTANGLE in
    // coordinate space, which is exactly what a map viewport is.
    //
    // It is NOT a radius: the corners of the box are ~41% further out than a
    // circle of the same width, so "nearby" via a box over-selects. It also
    // distorts with latitude, because a degree of longitude shrinks from ~111km
    // at the equator to nothing at the poles. Both are accepted tradeoffs —
    // PostGIS is an explicit v1 non-goal.
    //
    // ALL FOUR or none. Three of the four describes no region at all, so
    // silently ignoring the partial set would return results the caller did not
    // ask for while looking like it worked.
    const providedBoxKeys = BOX_KEYS.filter(
      (key) => req.query[key] !== undefined
    );

    if (providedBoxKeys.length > 0 && providedBoxKeys.length < 4) {
      return res.status(400).json({
        error:
          "A bounding box needs all four of minLat, maxLat, minLng, maxLng",
      });
    }

    if (providedBoxKeys.length === 4) {
      const box: Record<string, number> = {};

      for (const key of BOX_KEYS) {
        const raw = singleQueryValue(req.query[key]);
        const parsed = raw === undefined ? null : parseQueryNumber(raw);
        const limit = key.includes("Lat") ? 90 : 180;

        if (parsed === null) {
          return res.status(400).json({ error: `${key} must be a number` });
        }
        if (parsed < -limit || parsed > limit) {
          return res
            .status(400)
            .json({ error: `${key} must be between -${limit} and ${limit}` });
        }

        box[key] = parsed;
      }

      where.latitude = { gte: box.minLat, lte: box.maxLat };
      where.longitude = { gte: box.minLng, lte: box.maxLng };
    }

    const result = await listReports(where, pagination.page, pagination.limit);

    return res.status(200).json(result);
  })
);

// ---------------------------------------------------------------------------
// GET /api/reports/:id   (PUBLIC)   -> 200
// ---------------------------------------------------------------------------
//
// req.params.id is the piece of the PATH that "/:id" captured. Params identify
// WHICH resource; query params say how to view a collection; the body carries
// content. A GET has no body by convention, which is precisely why all the
// filtering above lives in the query string.
router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const report = await prisma.report.findUnique({
      where: { id: req.params.id },
      select: REPORT_SELECT,
    });

    if (!report) {
      return res.status(404).json({ error: "Report not found" });
    }

    return res.status(200).json({ report });
  })
);

// ---------------------------------------------------------------------------
// PATCH /api/reports/:id   (protected + ownership)   -> 200
// ---------------------------------------------------------------------------
//
// PATCH, not PUT. PUT means "replace the whole resource with what I send" — a
// missing field should be wiped. PATCH means "apply these changes", so any
// subset of fields is valid and everything unmentioned is left alone. That is
// what an edit form that only changed the title actually wants.
//
// THE THREE-STEP LADDER, in this exact order:
//   401 (requireAuth)  -> I do not know who you are.
//   404                -> The report does not exist.
//   403                -> I know exactly who you are, and you still may not.
//
// 401 vs 403 is the authentication/authorisation split. 401 is a reason to log
// in; 403 is not — logging in again changes nothing about the answer.
router.patch(
  "/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    // Fetch only the one field the permission decision needs.
    //
    // Why a separate read instead of one clever `updateMany({ where: { id,
    // userId } })`: that would be a single round trip, but it returns
    // { count: 0 } for BOTH "does not exist" and "not yours", so it physically
    // cannot tell 404 from 403. Two queries, one unambiguous answer.
    const existing = await prisma.report.findUnique({
      where: { id: req.params.id },
      select: { userId: true },
    });

    if (!existing) {
      return res.status(404).json({ error: "Report not found" });
    }

    // ---- THE OWNERSHIP CHECK ---------------------------------------------
    // Compare the row's author against the id from the VERIFIED TOKEN. This one
    // line is the whole authorisation model of the application.
    if (existing.userId !== req.userId) {
      return res
        .status(403)
        .json({ error: "You can only edit your own reports" });
    }

    // Build the update from an explicit allowlist of seven fields. id, userId,
    // createdAt, updatedAt, severity, aiSummary and aiTags are never read from
    // the body, so attempts to change them are ignored without any special
    // handling — the same mass-assignment defence used in POST.
    const data: Prisma.ReportUpdateInput = {};

    if (req.body.title !== undefined) {
      const error = checkText(req.body.title, "title");
      if (error) return res.status(400).json({ error });
      data.title = req.body.title.trim();
    }

    if (req.body.description !== undefined) {
      const error = checkText(req.body.description, "description");
      if (error) return res.status(400).json({ error });
      data.description = req.body.description.trim();
    }

    if (req.body.category !== undefined) {
      const error = checkEnum(req.body.category, VALID_CATEGORIES, "category");
      if (error) return res.status(400).json({ error });
      data.category = req.body.category;
    }

    // Owner-updatable for now. In a real municipal system moving a report to
    // RESOLVED would be a staff action, not something the reporter can do to
    // their own complaint — documented as a known v1 compromise, since v1 has
    // no admin role at all.
    if (req.body.status !== undefined) {
      const error = checkEnum(req.body.status, VALID_STATUSES, "status");
      if (error) return res.status(400).json({ error });
      data.status = req.body.status;
    }

    if (req.body.latitude !== undefined) {
      const error = checkBodyCoordinate(req.body.latitude, "latitude", 90);
      if (error) return res.status(400).json({ error });
      data.latitude = req.body.latitude;
    }

    if (req.body.longitude !== undefined) {
      const error = checkBodyCoordinate(req.body.longitude, "longitude", 180);
      if (error) return res.status(400).json({ error });
      data.longitude = req.body.longitude;
    }

    // null is accepted here specifically to CLEAR an image. Without that there
    // would be no way to remove a photo once one had been attached.
    if (req.body.imageUrl !== undefined) {
      if (req.body.imageUrl !== null && typeof req.body.imageUrl !== "string") {
        return res
          .status(400)
          .json({ error: "imageUrl must be a string or null" });
      }
      data.imageUrl = req.body.imageUrl;
    }

    // Nothing updatable was sent. A PATCH that changes nothing is almost
    // certainly a mistake in the caller, so we say so rather than performing a
    // pointless write that bumps updatedAt for no reason.
    if (Object.keys(data).length === 0) {
      return res.status(400).json({
        error:
          "Provide at least one of: title, description, category, status, latitude, longitude, imageUrl",
      });
    }

    const report = await prisma.report.update({
      where: { id: req.params.id },
      data,
      select: REPORT_SELECT,
    });

    return res.status(200).json({ report });
  })
);

// ---------------------------------------------------------------------------
// DELETE /api/reports/:id   (protected + ownership)   -> 204
// ---------------------------------------------------------------------------
//
// 204 No Content rather than 200 with a message, because there is genuinely
// nothing to return: the resource is gone, so any body would be filler the
// client has no use for. 204 is defined as "success, and deliberately no body",
// so a client can stop parsing immediately. Sending `200 { message: "Deleted" }`
// invites a frontend to call `await res.json()` on every response — which then
// throws the moment an endpoint legitimately returns nothing.
router.delete(
  "/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    // Identical ladder to PATCH.
    const existing = await prisma.report.findUnique({
      where: { id: req.params.id },
      select: { userId: true },
    });

    if (!existing) {
      return res.status(404).json({ error: "Report not found" });
    }

    if (existing.userId !== req.userId) {
      return res
        .status(403)
        .json({ error: "You can only delete your own reports" });
    }

    await prisma.report.delete({ where: { id: req.params.id } });

    // .end() rather than .json() — a 204 must not carry a body.
    return res.status(204).end();
  })
);

// ---------------------------------------------------------------------------
// POST /api/reports/:id/enhance   (protected + ownership)   -> 200
// ---------------------------------------------------------------------------
//
// Manually re-run the AI pipeline on a report. This is the mitigation for every
// way enhancement can be lost: Groq was down, the key was wrong, the model
// returned nonsense, or the server restarted mid-call and the in-memory promise
// died with it. It is also the only way to enhance the reports that existed
// before Module 4, which are stranded at PENDING because nothing will ever
// trigger them.
//
// ---- DOES ROUTE ORDER MATTER HERE? NO — AND THE REASON IS WORTH KNOWING ----
//
// "/mine" had to be registered above "/:id" because both are ONE path segment,
// so "/:id" matched "mine" first and returned a plausible 404.
//
// "/:id/enhance" is TWO segments, and the only other POST route is "/". A
// two-segment path can never match a one-segment pattern, so no collision is
// possible and the order is free. Collisions only happen between patterns with
// the SAME segment count where one has a literal where the other has a param.
//
// It sits here purely for readability, grouped with the other "/:id" routes —
// a style choice, not a correctness requirement.
router.post(
  "/:id/enhance",
  requireAuth,
  asyncHandler(async (req, res) => {
    // Same ladder as PATCH and DELETE — 401 (requireAuth) -> 404 -> 403 — with
    // one extra rung for state. We select the text too, so enhanceReport can be
    // called without a second read.
    const existing = await prisma.report.findUnique({
      where: { id: req.params.id },
      select: {
        userId: true,
        aiStatus: true,
        title: true,
        description: true,
      },
    });

    if (!existing) {
      return res.status(404).json({ error: "Report not found" });
    }

    if (existing.userId !== req.userId) {
      return res
        .status(403)
        .json({ error: "You can only enhance your own reports" });
    }

    // 409 Conflict — the request is valid and you are allowed to make it, but it
    // conflicts with the current STATE of the resource. That is exactly what 409
    // is for, and it is the right code rather than 400: nothing about the request
    // is malformed, and re-sending it will keep failing until the state changes.
    //
    // Re-running on a COMPLETED report is blocked because it would spend money
    // and quota to overwrite good data with a probably-identical answer. PENDING
    // and FAILED both proceed.
    if (existing.aiStatus === "COMPLETED") {
      return res
        .status(409)
        .json({ error: "This report has already been enhanced" });
    }

    // ---- HERE WE DO await, AND THAT IS THE RIGHT CALL ---------------------
    //
    // The contrast with POST / is the whole lesson. There, the AI call is a SIDE
    // EFFECT of a different operation — the user asked to file a report, and
    // making them wait on a third party for something they never asked for is
    // exactly the coupling this module exists to prevent.
    //
    // Here, enhancement IS the operation the user requested. Waiting for the
    // thing you asked for is just how a request works, and returning 202
    // immediately would only force the client to poll to discover an outcome we
    // already have in hand. The 10-second timeout inside enhanceReport bounds
    // the worst case.
    //
    // Note there is no unhandled-rejection risk on this path anyway: this await
    // sits inside asyncHandler, which routes any rejection to errorHandler. The
    // danger is specific to the un-awaited call in POST /.
    await enhanceReport(req.params.id, existing.title, existing.description);

    // enhanceReport never throws, so success and failure look identical from
    // here. The outcome lives in the row, which is why we re-read it.
    const report = await prisma.report.findUnique({
      where: { id: req.params.id },
      select: REPORT_SELECT,
    });

    // Deleted by its owner while the enhancement was running. Narrow, but real.
    if (!report) {
      return res.status(404).json({ error: "Report not found" });
    }

    // ---- 200 EVEN WHEN aiStatus IS "FAILED" -------------------------------
    //
    // Deliberate, and 502 Bad Gateway was the alternative considered.
    //
    // 200 wins because this module's entire architecture rests on AI failure
    // being a NORMAL, EXPECTED STATE OF A REPORT rather than an error in our
    // service — that is precisely why the aiStatus column exists. Our server did
    // its job: it ran the attempt, recorded the result, and is returning the
    // honest current state of the resource. 502 would claim we are a gateway
    // that got a bad response from upstream, which mischaracterises us as a
    // pass-through to Groq and contradicts the design. It would also push the
    // client into an error branch for something that is not an error.
    //
    // THE COST, STATED PLAINLY: a caller that only looks at the HTTP status will
    // think it worked. The outcome is in the body — callers must read aiStatus.
    return res.status(200).json({ report });
  })
);

export default router;
