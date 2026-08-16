// The backend contract, mirrored in TypeScript.
//
// This file is the single place the frontend describes what the API returns.
// It is hand-written to match docs/architecture.md exactly — every field, every
// nullability. If the two ever disagree, this file is wrong.
//
// ---- WHY HAND-WRITTEN AND NOT GENERATED ------------------------------------
//
// The backend uses Prisma, so the "clever" option is to share Prisma's
// generated types with the frontend. That would be wrong here, and knowing why
// is worth more than the convenience:
//
//   1. Prisma's Report type includes `userId` and the full `user` relation with
//      email and password hash. The API deliberately returns NEITHER — it uses
//      a select allowlist. Importing Prisma's type would tell the frontend that
//      fields exist which it can never actually receive.
//   2. `createdAt` is a Date object in Prisma and a STRING here, because JSON
//      has no date type. Sharing the type would lie about that, and the bug
//      only appears at runtime when something calls .getTime() on a string.
//
// The types below describe THE WIRE FORMAT, which is a different thing from the
// database schema. Keeping them separate is the honest modelling.

/** Chosen by the citizen at creation. Never modified by the AI. */
export type Category =
  | "POTHOLE"
  | "GARBAGE"
  | "DRAINAGE"
  | "STREETLIGHT"
  | "OTHER";

/** Assigned by the AI pipeline AFTER creation, which is why it is nullable. */
export type Severity = "LOW" | "MEDIUM" | "HIGH";

export type Status = "OPEN" | "IN_PROGRESS" | "RESOLVED";

/**
 * The AI pipeline's state for one report.
 *
 * The success value is COMPLETED — not DONE, not SUCCESS. Getting this wrong
 * produces a comparison that is always false, which fails silently: the UI
 * simply shows a spinner forever on a report that finished fine.
 */
export type AiStatus = "PENDING" | "COMPLETED" | "FAILED";

/**
 * A report, exactly as every endpoint returns it.
 *
 * There is deliberately NO top-level `userId`. The author's id is `user.id` —
 * the backend returns one representation rather than two that can disagree.
 */
export type Report = {
  id: string;
  title: string;
  description: string;
  imageUrl: string | null;

  category: Category;

  /**
   * NULL until the AI enhances the report — and null forever if it failed.
   *
   * This nullability is the schema's central design decision, not an
   * inconvenience to code around: AI is an enhancement layer, never a
   * dependency, so a report with no severity is a valid, complete report. Every
   * component that renders severity must handle null as a first-class state,
   * not as missing data.
   */
  severity: Severity | null;

  status: Status;
  latitude: number;
  longitude: number;

  aiSummary: string | null;

  /**
   * A COMMA-SEPARATED STRING, not an array. Real example:
   *   "sewage,healthhazard,street,children,odor"
   *
   * The database column is a plain String. Calling .map() on this is a runtime
   * crash, and TypeScript will catch it here precisely because the type is
   * honest about it. Use splitTags() from lib/format.ts — never split it inline.
   */
  aiTags: string | null;

  aiStatus: AiStatus;

  /** ISO 8601 strings. JSON has no date type — these are NOT Date objects. */
  createdAt: string;
  updatedAt: string;

  /** The author. Only id and name are ever exposed — never the email. */
  user: {
    id: string;
    name: string;
  };
};

/** The authenticated user, as returned by the auth endpoints. */
export type User = {
  id: string;
  email: string;
  name: string;
  createdAt: string;
};

/**
 * The list envelope shared by GET /api/reports and GET /api/reports/mine.
 *
 * `total` and `totalPages` are what make a NUMBERED pager possible — the
 * backend chose offset pagination over cursor pagination specifically so this
 * information exists. Cursor pagination is faster at scale but cannot tell you
 * how many pages there are, which rules out the UI we want.
 */
export type Paginated<T> = {
  data: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

/**
 * GET /api/stats — the dashboard aggregate (Module 5).
 *
 * Every breakdown array is ALWAYS complete: 5 categories, 3 statuses, 4
 * severity buckets (including null), 3 AI statuses — even when a count is zero
 * and even on an empty database. The backend normalises this on the server, so
 * no chart component needs a guard clause or an empty-state branch.
 */
export type Stats = {
  totalReports: number;

  byCategory: { category: Category; count: number }[];
  byStatus: { status: Status; count: number }[];

  /** The `null` entry is reports the AI has not successfully assessed. */
  bySeverity: { severity: Severity | null; count: number }[];

  byAiStatus: { aiStatus: AiStatus; count: number }[];

  /** Width of the trend window in days. */
  trendDays: number;

  /**
   * Exactly `trendDays` entries, ascending, with no gaps — days with no
   * reports are present with `count: 0`. Dates are UTC, formatted YYYY-MM-DD.
   */
  trend: { date: string; count: number }[];

  /** The 5 newest reports, in the same shape as every other report response. */
  recent: Report[];
};

/** Query parameters accepted by GET /api/reports. All optional, ANDed together. */
export type ReportFilters = {
  category?: Category;
  status?: Status;
  search?: string;
  /**
   * Bounding box. ALL FOUR OR NONE — sending one to three of them is a 400
   * from the backend. The map viewport in Phase 5 feeds these.
   */
  minLat?: number;
  maxLat?: number;
  minLng?: number;
  maxLng?: number;
  page?: number;
  /** Backend default 20, hard cap 100. Values above 100 are clamped, not rejected. */
  limit?: number;
};
