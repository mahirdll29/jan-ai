import type {
  Paginated,
  Report,
  ReportFilters,
  Stats,
  User,
} from "./types";

// ===========================================================================
// THE API CLIENT
//
// One wrapper around fetch. Every rule about talking to the backend lives here
// and nowhere else, so no component has to remember any of them.
// ===========================================================================

const BASE_URL = process.env.NEXT_PUBLIC_API_URL;

// process.env values are string | undefined. Failing here, at module load,
// gives a clear error instead of a confusing "fetch failed to parse URL
// undefined/api/reports" on the first request.
//
// NEXT_PUBLIC_ is not decoration: Next.js only exposes variables with that
// prefix to browser code. It is a deliberate opt-in, because everything in the
// client bundle is public. A secret must never carry this prefix — the backend
// keeps GROQ_API_KEY and JWT_SECRET precisely because those must never be here.
if (!BASE_URL) {
  throw new Error(
    "NEXT_PUBLIC_API_URL is not set. Copy .env.example to .env.local."
  );
}

/**
 * An error carrying the HTTP status alongside the message.
 *
 * The status is the point. The backend distinguishes 401 (not logged in), 403
 * (logged in, not yours), 404 (no such report) and 409 (already enhanced), and
 * each needs a different response in the UI. Throwing a plain Error would force
 * callers to string-match the message, which breaks the moment anyone reworks
 * the wording of an error.
 */
export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,

    // ---- THE SINGLE MOST IMPORTANT LINE IN THIS FILE --------------------
    //
    // Our auth cookie is httpOnly, so JavaScript cannot read it or attach it
    // by hand — which is exactly the point, because it means an XSS payload
    // cannot steal it either. The browser attaches it automatically, but ONLY
    // if the request opts in with credentials: "include".
    //
    // By default fetch sends NO cookies on a cross-origin request. localhost:3000
    // and localhost:5000 are different origins (a different port is a different
    // origin), so without this line the cookie is silently omitted.
    //
    // The failure mode is nasty because login appears to work: the server sets
    // the cookie, the browser stores it, and then every subsequent request
    // arrives with no cookie and comes back 401. Nothing errors, nothing logs —
    // the user is just never logged in.
    //
    // BOTH SIDES MUST AGREE. This is only half of it; the server also has to
    // send Access-Control-Allow-Credentials: true, which it does via
    // cors({ credentials: true }) with an exact origin from FRONTEND_URL. A
    // wildcard origin is illegal once credentials are enabled — browsers reject
    // that combination outright.
    credentials: "include",

    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  // ---- 204 NO CONTENT MUST RETURN BEFORE PARSING -------------------------
  //
  // DELETE /api/reports/:id returns 204 with a ZERO-BYTE body. Calling
  // res.json() on an empty body throws "Unexpected end of JSON input".
  //
  // This is the exact trap the backend was designed to expose early: it returns
  // 204 rather than 200 { message: "Deleted" } specifically so a client cannot
  // fall into the habit of parsing every response. Handling it once, here,
  // means it can never surprise a component.
  if (res.status === 204) {
    return undefined as T;
  }

  if (!res.ok) {
    // The backend's error shape is always { error: "<message>" }. Reading it is
    // wrapped in try/catch because a failure that never reached our Express app
    // — a proxy timeout, the server being down — returns HTML or nothing at
    // all, and a JSON parse error would then mask the real status code.
    let message = `Request failed with status ${res.status}`;
    try {
      const body = await res.json();
      if (body && typeof body.error === "string") {
        message = body.error;
      }
    } catch {
      // Keep the generic message.
    }
    throw new ApiError(res.status, message);
  }

  return res.json() as Promise<T>;
}

/** Serialises filters into a query string, dropping anything undefined or empty. */
function toQuery(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    // An empty search box must mean "no filter", not "match nothing". The
    // backend treats a whitespace-only `search` as absent too, so this only
    // avoids sending a pointless parameter.
    if (typeof value === "string" && value.trim() === "") continue;
    search.set(key, String(value));
  }

  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

// ---------------------------------------------------------------------------
// AUTH
// ---------------------------------------------------------------------------

export const auth = {
  register: (body: { email: string; password: string; name: string }) =>
    request<{ user: User }>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  login: (body: { email: string; password: string }) =>
    request<{ user: User }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  logout: () =>
    request<{ message: string }>("/api/auth/logout", { method: "POST" }),

  /**
   * Throws ApiError(401) when not logged in. That is the normal, expected
   * result for a signed-out visitor — not an exceptional condition — so
   * callers catch it rather than letting it bubble.
   */
  me: () => request<{ user: User }>("/api/auth/me"),
};

// ---------------------------------------------------------------------------
// REPORTS
// ---------------------------------------------------------------------------

export const reports = {
  /**
   * @param init extra fetch options. SERVER components pass
   *   `{ cache: "no-store" }` so the list is fetched per request instead of
   *   being baked in at build time — see the note on `stats.get` below.
   */
  list: (filters: ReportFilters = {}, init?: RequestInit) =>
    request<Paginated<Report>>(`/api/reports${toQuery({ ...filters })}`, init),

  /**
   * GET /api/reports/mine supports page and limit ONLY.
   *
   * The parameter type is narrowed here to make that a compile error rather
   * than a silently ignored filter — the backend does not reject the extra
   * params, it just does not apply them, which would look like a broken filter
   * in the UI with nothing in the network tab to explain it.
   */
  mine: (params: { page?: number; limit?: number } = {}) =>
    request<Paginated<Report>>(`/api/reports/mine${toQuery({ ...params })}`),

  get: (id: string, init?: RequestInit) =>
    request<{ report: Report }>(`/api/reports/${id}`, init),

  create: (body: {
    title: string;
    description: string;
    category: Report["category"];
    // Real JSON numbers. The backend rejects strings outright rather than
    // coercing them, because Number("abc") is NaN and NaN would otherwise land
    // in a Float column unnoticed.
    latitude: number;
    longitude: number;
    imageUrl?: string;
  }) =>
    request<{ report: Report }>("/api/reports", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  /**
   * Only these seven fields can be updated. severity, aiSummary, aiTags and
   * userId are written server-side only — sending them is silently ignored, so
   * the type omits them to make that visible at the call site.
   *
   * An empty patch body is a 400.
   */
  update: (
    id: string,
    body: Partial<{
      title: string;
      description: string;
      category: Report["category"];
      status: Report["status"];
      latitude: number;
      longitude: number;
      imageUrl: string | null;
    }>
  ) =>
    request<{ report: Report }>(`/api/reports/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  /** Returns 204 with no body — hence the void return, handled above. */
  remove: (id: string) =>
    request<void>(`/api/reports/${id}`, { method: "DELETE" }),

  /**
   * Re-run the AI pipeline on a report. Owner only.
   *
   * ---- THIS IS THE ONE ENDPOINT WHERE THE HTTP STATUS LIES ---------------
   *
   * It returns 200 EVEN WHEN THE AI FAILED. That is deliberate on the backend:
   * AI failure is a normal state of a report, not an error in the service, so
   * the server ran the attempt, recorded the outcome, and is returning the
   * honest current state of the resource.
   *
   * THE CONSEQUENCE FOR THIS CLIENT: a caller that only checks `res.ok` will
   * think it succeeded. You MUST read `report.aiStatus` from the body and
   * branch on COMPLETED vs FAILED.
   *
   * Throws ApiError(409) if the report is already COMPLETED — re-running would
   * spend quota to overwrite good data with a near-identical answer.
   */
  enhance: (id: string) =>
    request<{ report: Report }>(`/api/reports/${id}/enhance`, {
      method: "POST",
    }),
};

// ---------------------------------------------------------------------------
// STATS
// ---------------------------------------------------------------------------

export const stats = {
  /**
   * @param days trend window. Default 30, clamped at 90 by the backend.
   * @param init extra fetch options — used by SERVER components to pass
   *   `{ cache: "no-store" }`.
   *
   * Why that matters: a fetch inside a server component runs during
   * `next build` as well as at request time. Without `no-store`, Next would try
   * to prerender the page at build — making a successful build depend on the
   * backend being up, and then freezing whatever it got. `no-store` opts the
   * route into dynamic rendering, so the figures are fetched per request and
   * the build never touches the network.
   */
  get: (days?: number, init?: RequestInit) =>
    request<Stats>(`/api/stats${toQuery({ days })}`, init),
};
