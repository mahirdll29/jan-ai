import express, { Request } from "express";
import { Category, Status, Severity, AiStatus } from "@prisma/client";

import { prisma } from "../lib/prisma";
import { asyncHandler } from "../utils/asyncHandler";
import { REPORT_SELECT } from "./reports";

// Same pattern as routes/auth.ts and routes/reports.ts: a Router is a mini
// Express app, and index.ts mounts the whole thing with
// `app.use("/api/stats", statsRoutes)`. So "/" below is served at "/api/stats".
const router = express.Router();

// ---------------------------------------------------------------------------
// CONSTANTS
// ---------------------------------------------------------------------------

// The valid values for each enum, read off Prisma's GENERATED runtime objects
// rather than hand-copied arrays. Add a sixth Category to schema.prisma and
// these lists update themselves; a hand-written array would silently drift and
// the dashboard would quietly stop showing a whole category.
//
// Same rule Modules 3 and 4 use for validation. Here it does something slightly
// different — it defines the SHAPE OF THE RESPONSE (see the groupBy note below).
const VALID_CATEGORIES = Object.values(Category);
const VALID_STATUSES = Object.values(Status);
const VALID_AI_STATUSES = Object.values(AiStatus);

// severity is NULLABLE in the schema — it stays null until the AI pipeline
// fills it in, and stays null forever if the AI failed. So its buckets are the
// three real values PLUS a null bucket for "not yet assessed".
//
// This is Module 1's most important design decision (severity nullable, category
// required, because AI is an enhancement and never a dependency) showing up in
// the analytics layer. The null bucket is not a gap in the data — it is a real,
// meaningful count, and hiding it would misrepresent the dataset.
const SEVERITY_BUCKETS = [...Object.values(Severity), null];

const DEFAULT_TREND_DAYS = 30;
const MAX_TREND_DAYS = 90;

// How many reports the "recent" list contains. Deliberately not configurable —
// nothing needs it to be, and every query parameter is another thing to
// validate and another thing that can be abused.
const RECENT_LIMIT = 5;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// QUERY HELPERS
//
// These two are COPIED from routes/reports.ts rather than extracted into a
// shared utils/query.ts. That is a deliberate choice: they are about ten lines
// total, and a shared module that exists to serve exactly two call sites adds an
// indirection to chase for no real gain.
//
// The point at which extracting becomes the right call is a THIRD consumer —
// that is when "changed in one place, forgotten in the others" becomes a real
// risk rather than a theoretical one.
// ---------------------------------------------------------------------------

// Everything in req.query is a STRING (or an array, if the same key is repeated,
// or undefined). We only ever accept a single string; a repeated key is treated
// as absent rather than guessed at.
function singleQueryValue(raw: unknown): string | undefined {
  return typeof raw === "string" ? raw : undefined;
}

// Query params are always text, so unlike req.body we DO have to convert.
// Returns null when the text is not a usable number.
//
// The empty-string case is the one that bites: `Number("")` is 0, not NaN.
// Without this guard `?days=` would silently become a perfectly valid 0.
function parseQueryNumber(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;

  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) return null;

  return parsed;
}

// Reads ?days=, the width of the trend window.
//
// Returns either the value or an error message, the same shape parsePagination
// uses in reports.ts — which reads as `if ("error" in result) return 400` at the
// call site.
//
// The clamp-vs-reject split is copied deliberately from `limit` in Module 3, and
// for the same reason: asking for MORE days than we will give is a reasonable
// request with a reasonable answer, so it is clamped. `-1` and `abc` are
// meaningless, so those are a 400 — silently falling back to the default would
// hide a bug in the caller.
function parseDays(query: Request["query"]): { days: number } | { error: string } {
  const raw = singleQueryValue(query.days);
  if (raw === undefined) return { days: DEFAULT_TREND_DAYS };

  const parsed = parseQueryNumber(raw);
  if (parsed === null || !Number.isInteger(parsed) || parsed < 1) {
    return { error: "days must be a whole number of 1 or more" };
  }

  return { days: Math.min(parsed, MAX_TREND_DAYS) };
}

// ---------------------------------------------------------------------------
// AGGREGATION HELPERS
// ---------------------------------------------------------------------------

// Turns a Prisma groupBy result into a plain lookup: value -> count.
//
// A groupBy row looks like { category: "POTHOLE", _count: 4 }. The field name
// differs per dimension (category / status / severity / aiStatus), so we read it
// by name. The cast is needed because each groupBy returns a differently-shaped
// row type and we want ONE helper rather than four near-identical ones.
function countLookup(
  rows: { _count: number }[],
  field: string
): Map<string | null, number> {
  const map = new Map<string | null, number>();

  for (const row of rows) {
    const value = (row as Record<string, unknown>)[field] as string | null;
    map.set(value, row._count);
  }

  return map;
}

// Counts reports into one bucket per UTC day.
//
// WHY THIS IS DONE IN JAVASCRIPT AND NOT IN SQL — worth knowing cold:
//
// Prisma's groupBy CANNOT truncate a timestamp to a day. `createdAt` is a full
// timestamp, so `by: ["createdAt"]` would produce one group per distinct
// millisecond — as many groups as there are rows, which is useless. The ORM has
// no DATE_TRUNC. So the choice is raw SQL (`$queryRaw` with
// `DATE_TRUNC('day', "createdAt")`) or the application, and we chose the
// application: no raw SQL, no untyped result rows, no timezone parameter to get
// wrong.
//
// THE TRADEOFF, STATED HONESTLY: this reads one row per report in the window
// into Node, so it is O(reports) rather than O(days). Entirely fine at our
// volume; the wrong answer at 500,000 rows, where $queryRaw returns ~30 rows
// regardless of how many reports there are. That is the documented upgrade path.
//
// ZERO-DAYS: every bucket is created up front and initialised to 0, THEN
// incremented. This is why the chart can never have a hole. Note that raw SQL
// would not have fixed this for free either — Postgres cannot return a row for a
// day that has no rows to group, so a SQL version needs a generate_series join.
//
// TIMEZONE, NAMED RATHER THAN HIDDEN: buckets are UTC days. A report filed at
// 02:00 IST lands in the previous UTC day's bucket. Accepted for v1; the
// alternative is a timezone parameter and per-user offsets.
function buildTrend(
  createdDates: { createdAt: Date }[],
  windowStartMs: number,
  days: number
): { date: string; count: number }[] {
  const buckets: { date: string; count: number }[] = [];

  // Position of each date string within `buckets`, so counting below is a map
  // lookup rather than a scan of the array for every report.
  const positions = new Map<string, number>();

  for (let i = 0; i < days; i++) {
    // "2026-08-15" — the first 10 characters of an ISO string are the UTC date.
    const key = new Date(windowStartMs + i * MS_PER_DAY)
      .toISOString()
      .slice(0, 10);

    positions.set(key, buckets.length);
    buckets.push({ date: key, count: 0 });
  }

  for (const row of createdDates) {
    const key = row.createdAt.toISOString().slice(0, 10);
    const position = positions.get(key);

    // Guarded rather than asserted. The `where` clause bounds these rows to the
    // window, so a miss should be impossible — but a report created in the same
    // millisecond the request is served could land a tick past the last bucket,
    // and a crash on the dashboard is a bad trade for a saved line.
    if (position !== undefined) {
      buckets[position].count += 1;
    }
  }

  return buckets;
}

// Midnight UTC on the day `date` falls in, as a millisecond timestamp.
function startOfUtcDayMs(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

// ---------------------------------------------------------------------------
// GET /api/stats   (PUBLIC)   -> 200
// ---------------------------------------------------------------------------
//
// WHY PUBLIC, with no requireAuth:
//
// GET /api/reports is already public — civic issues are public information, and
// that is the premise of the product. An AGGREGATE of public data cannot be more
// sensitive than the data it aggregates: anyone could page through the reports
// list and count the categories themselves. Requiring a cookie here would be
// security theatre, and it would break a logged-out landing page.
//
// The honest consequence: this is a second unauthenticated database endpoint,
// and a heavier one than GET /api/reports — seven Prisma calls per request
// rather than two. Nothing rate-limits it. Recorded with the project's existing
// "no rate limiting" gap rather than pretended away.
//
// WHY ONE ENDPOINT AND NOT THREE:
//
// The dashboard renders all of this on one screen, at once. Three endpoints
// would mean three round trips, three loading states and three error states in
// the UI, for data that is always wanted together. One endpoint means one fetch,
// one skeleton, one failure path. The cost — the pieces cannot be refetched
// independently — would matter if they had different refresh rates. They do not.
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const parsedDays = parseDays(req.query);
    if ("error" in parsedDays) {
      return res.status(400).json({ error: parsedDays.error });
    }
    const { days } = parsedDays;

    // The window is `days` whole UTC days ENDING WITH TODAY. days=30 means today
    // plus the 29 before it, so the chart's last bucket is always the current
    // day rather than yesterday.
    //
    // Computed once, here, and used for BOTH the database filter and the bucket
    // generation. If the two were computed separately they could disagree across
    // a midnight boundary, and reports would be fetched that had no bucket to
    // land in.
    const windowStartMs = startOfUtcDayMs(new Date()) - (days - 1) * MS_PER_DAY;
    const windowStart = new Date(windowStartMs);

    // ---- SEVEN QUERIES, ALL AT ONCE --------------------------------------
    //
    // THE SINGLE BIGGEST PERFORMANCE DECISION IN THIS MODULE.
    //
    // Promise.all starts every query immediately and waits for all of them, so
    // the total cost is the SLOWEST query, not the sum. That matters enormously
    // here: our Neon database is in AWS us-east-2 and this machine is not, so
    // every round trip costs roughly half a second (measured in Module 4).
    // Concurrent: ~0.5s. Written as seven sequential `await`s: ~3.5s.
    //
    // WHY NOT prisma.$transaction([...]), which would give a consistent snapshot
    // of all seven: Prisma's array form runs the queries SEQUENTIALLY inside one
    // transaction. It would trade 0.5s for 3.5s to buy consistency.
    //
    // THE COST OF CHOOSING CONCURRENCY, STATED PLAINLY: these seven queries
    // observe seven slightly different instants. A report created mid-request
    // can make totalReports disagree with the sum of byCategory by one. On a
    // dashboard refreshed by reloading a page, an off-by-one that corrects
    // itself on the next load is not worth a 7x latency penalty.
    //
    // ---- WHAT groupBy ACTUALLY IS ----------------------------------------
    //
    // `groupBy({ by: ["category"], _count: true })` compiles to, essentially:
    //
    //     SELECT "category", COUNT(*) FROM "Report" GROUP BY "category";
    //
    // One query where five separate `count({ where: { category } })` calls would
    // be five, and one table scan instead of five. More importantly, five
    // hand-written counts are five places to forget when a sixth category is
    // added to the schema.
    const [
      totalReports,
      categoryRows,
      statusRows,
      severityRows,
      aiStatusRows,
      trendRows,
      recent,
    ] = await Promise.all([
      // No `where` — SELECT COUNT(*) over the whole table.
      prisma.report.count(),

      prisma.report.groupBy({ by: ["category"], _count: true }),
      prisma.report.groupBy({ by: ["status"], _count: true }),
      // On a nullable column this returns a row where severity is null.
      prisma.report.groupBy({ by: ["severity"], _count: true }),
      prisma.report.groupBy({ by: ["aiStatus"], _count: true }),

      // ONE COLUMN ONLY. We need nothing but the timestamp to bucket by day, and
      // selecting the full row would drag titles, descriptions and AI summaries
      // across the network to be immediately thrown away.
      prisma.report.findMany({
        where: { createdAt: { gte: windowStart } },
        select: { createdAt: true },
      }),

      // The five newest reports, in EXACTLY the shape every other report
      // endpoint returns — same 15 fields, same nested { id, name } author, no
      // email. That is the whole reason REPORT_SELECT is imported rather than
      // redefined here.
      prisma.report.findMany({
        orderBy: { createdAt: "desc" },
        take: RECENT_LIMIT,
        select: REPORT_SELECT,
      }),
    ]);

    // ---- NORMALISING THE BREAKDOWNS --------------------------------------
    //
    // THE GOTCHA WORTH KNOWING COLD: groupBy only returns rows for values that
    // ACTUALLY OCCUR IN THE DATA. If no report is RESOLVED, there is no RESOLVED
    // row — not a row with a count of zero, no row at all. A chart driven
    // straight off a groupBy result silently loses a whole category.
    //
    // That is not a Prisma quirk, it is what SQL's GROUP BY does: it groups the
    // rows that exist, and it has no way of knowing what values you EXPECTED.
    //
    // So we map over the enum's valid values (not over the query result) and
    // default each missing one to 0. The response therefore ALWAYS contains
    // exactly 5 categories, 3 statuses, 4 severity buckets and 3 AI statuses,
    // whatever the data looks like.
    //
    // Doing this on the SERVER rather than in the chart component means the
    // frontend needs no branching at all, and an empty database returns the full
    // shape with every count at 0 — so "the chart must not crash on a brand-new
    // account" is satisfied by construction rather than by a guard clause.
    const categoryCounts = countLookup(categoryRows, "category");
    const byCategory = VALID_CATEGORIES.map((category) => ({
      category,
      count: categoryCounts.get(category) ?? 0,
    }));

    const statusCounts = countLookup(statusRows, "status");
    const byStatus = VALID_STATUSES.map((status) => ({
      status,
      count: statusCounts.get(status) ?? 0,
    }));

    const severityCounts = countLookup(severityRows, "severity");
    const bySeverity = SEVERITY_BUCKETS.map((severity) => ({
      severity,
      count: severityCounts.get(severity) ?? 0,
    }));

    const aiStatusCounts = countLookup(aiStatusRows, "aiStatus");
    const byAiStatus = VALID_AI_STATUSES.map((aiStatus) => ({
      aiStatus,
      count: aiStatusCounts.get(aiStatus) ?? 0,
    }));

    // A useful invariant this preserves, and worth checking by hand once: the
    // counts in EACH of the four breakdowns sum to totalReports. Every report
    // has exactly one category, one status, one aiStatus, and exactly one
    // severity bucket — including the null one.
    //
    // Flat top level, with no { stats: ... } wrapper. The { user } and { report }
    // wrappers elsewhere exist to NAME a single resource; this response is not
    // one resource, so there is nothing to name.
    //
    // Arrays rather than objects keyed by enum value, because every charting
    // library takes an array of row objects — `{ POTHOLE: 4 }` would have to be
    // run through Object.entries in the component. Arrays also have a guaranteed
    // order; object key order is not something to rely on.
    return res.status(200).json({
      totalReports,
      byCategory,
      byStatus,
      bySeverity,
      byAiStatus,
      trendDays: days,
      trend: buildTrend(trendRows, windowStartMs, days),
      recent,
    });
  })
);

export default router;
