import type { AiStatus, Category, Report, Severity, Status } from "./types";

// ===========================================================================
// FORMATTING AND DISPLAY VOCABULARY
//
// Everything that turns API data into something a person reads. Kept in one
// place so the same value is never worded two different ways in two components.
// ===========================================================================

// ---------------------------------------------------------------------------
// AI TAGS
// ---------------------------------------------------------------------------

/**
 * Turns the `aiTags` column into an array.
 *
 * THE TRAP THIS EXISTS TO CLOSE: `aiTags` looks like a list and is NOT one. The
 * database column is a plain String holding comma-separated values, e.g.
 *   "sewage,healthhazard,street,children,odor"
 *
 * Calling .map() on it is a runtime crash, and calling .split(",") on it
 * directly is a crash whenever it is null — which is the normal state of any
 * report the AI has not enhanced yet.
 *
 * Every component goes through this function. Nothing splits that field inline.
 *
 * The filter matters as much as the split: "a,,b" and a stored empty string
 * both produce empty entries, which would render as blank tag pills. Trimming
 * and dropping empties makes the output safe to render directly.
 */
export function splitTags(aiTags: string | null): string[] {
  if (!aiTags) return [];

  return aiTags
    .split(",")
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);
}

// ---------------------------------------------------------------------------
// LABELS
//
// Enum values are SCREAMING_SNAKE_CASE because that is how they are stored.
// Nobody should ever see "IN_PROGRESS" in the interface.
// ---------------------------------------------------------------------------

export const CATEGORY_LABEL: Record<Category, string> = {
  POTHOLE: "Pothole",
  GARBAGE: "Garbage",
  DRAINAGE: "Drainage",
  STREETLIGHT: "Streetlight",
  OTHER: "Other",
};

export const STATUS_LABEL: Record<Status, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In progress",
  RESOLVED: "Resolved",
};

/**
 * Severity labels, INCLUDING the null case.
 *
 * "Not assessed" rather than "Unknown" or an empty cell. The distinction is
 * deliberate: null does not mean the severity is unknowable, it means the AI
 * has not assigned one — and because AI is an enhancement and never a
 * dependency, that is a perfectly valid state for a complete report to be in.
 * The wording should not imply something is missing or broken.
 */
export function severityLabel(severity: Severity | null): string {
  if (severity === null) return "Not assessed";
  return { LOW: "Low", MEDIUM: "Medium", HIGH: "High" }[severity];
}

/**
 * How the AI pipeline's state is worded in the interface.
 *
 * FAILED is shown as "AI unavailable", not "AI failed". The report itself is
 * complete and useful either way — the citizen wrote a title, a description, a
 * category and a location, and none of that depends on the model. Wording it as
 * a failure would tell the user their report is broken when it is not.
 */
export const AI_STATUS_LABEL: Record<AiStatus, string> = {
  PENDING: "AI pending",
  COMPLETED: "AI complete",
  FAILED: "AI unavailable",
};

// ---------------------------------------------------------------------------
// THE DOCKET LINE — the signature element
// ---------------------------------------------------------------------------

/** Three-letter category codes, in the manner of a real municipal case file. */
const CATEGORY_CODE: Record<Category, string> = {
  POTHOLE: "POT",
  GARBAGE: "GRB",
  DRAINAGE: "DRN",
  STREETLIGHT: "STL",
  OTHER: "OTH",
};

/**
 * Crockford's base32 alphabet.
 *
 * Note what is MISSING: I, L, O and U. The first three are excluded because
 * they are indistinguishable from 1, 1 and 0 when read aloud, written by hand,
 * or set in most typefaces. U is excluded so the encoding cannot accidentally
 * spell obscenities.
 */
const REF_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/**
 * A short, stable, speakable reference derived from the report's id.
 *
 * A real municipal complaint has a sequential case number. We do not have one —
 * ids are cuids, deliberately random so a URL cannot be walked to enumerate
 * every report — and inventing a sequence would mean printing a number that
 * matches nothing in the database.
 *
 * ---- WHY THIS IS HASHED AND NOT JUST id.slice(-5) ------------------------
 *
 * That was the first implementation, and rendering it exposed the flaw
 * immediately: a cuid ending in "fo900o" produced the reference "O900O".
 * Letter-O, nine, zero, zero, letter-O. Unreadable, and impossible to dictate
 * over a phone — which was the entire justification for having a short
 * reference in the first place.
 *
 * So the id is hashed (djb2, a small classic string hash) and re-encoded in the
 * alphabet above, which contains no character that can be confused with
 * another. "O900O" becomes something like "H7K2P".
 *
 * IMPORTANT, AND WORTH BEING CLEAR ABOUT: this is a DISPLAY reference, not an
 * identifier. Five characters is ~33 million combinations, so collisions are
 * possible in principle. Nothing looks a report up by this string — every URL
 * and every API call uses the real `id`. This exists to be read by a human,
 * and it is sized for that job rather than for uniqueness.
 */
export function reportRef(id: string): string {
  // djb2: hash = hash * 33 XOR char. The >>> 0 forces the result back to an
  // unsigned 32-bit integer after each step, because JavaScript's bitwise
  // operators produce SIGNED 32-bit values and a negative number would break
  // the modulo below.
  let hash = 5381;
  for (let i = 0; i < id.length; i++) {
    hash = ((hash * 33) ^ id.charCodeAt(i)) >>> 0;
  }

  let ref = "";
  for (let i = 0; i < 5; i++) {
    ref = REF_ALPHABET[hash % 32] + ref;
    hash = Math.floor(hash / 32);
  }
  return ref;
}

/**
 * Coordinates in the convention maps and surveys actually use: unsigned degrees
 * with a hemisphere letter, rather than a minus sign.
 *
 * Four decimal places is about 11 metres at the equator — enough to identify a
 * specific drain, and honest about the precision a phone's GPS actually has.
 * More digits would imply accuracy that is not there.
 */
export function formatCoordinates(latitude: number, longitude: number): string {
  const lat = `${Math.abs(latitude).toFixed(4)} ${latitude >= 0 ? "N" : "S"}`;
  const lng = `${Math.abs(longitude).toFixed(4)} ${longitude >= 0 ? "E" : "W"}`;
  return `${lat}  ${lng}`;
}

/**
 * Builds the docket line — the reference string that gives a report one stable
 * printed identity in the list, on the detail page and in the map popup.
 *
 *   JAN·DRN·N3UD · 23.0225 N  72.5714 E · FILED 13 AUG 2026 · AI COMPLETE
 *
 * Every segment carries real data, which is what makes this structure rather
 * than decoration: the segments are not there to look official, they are the
 * fastest way to identify and locate one report among many.
 */
export function buildDocket(report: Report): string {
  return [
    `JAN·${CATEGORY_CODE[report.category]}·${reportRef(report.id)}`,
    formatCoordinates(report.latitude, report.longitude),
    `Filed ${formatDateShort(report.createdAt)}`,
    AI_STATUS_LABEL[report.aiStatus],
  ].join("  ·  ");
}

// ---------------------------------------------------------------------------
// DATES
//
// Every date arrives as an ISO string, because JSON has no date type.
//
// A NOTE ON TIMEZONES: these format in the VIEWER's local timezone, which is
// what a person expects for "when was this filed". The dashboard's trend
// buckets are UTC days, computed on the server — so on rare occasions a report
// filed late at night can appear under today's date here and yesterday's bucket
// on the chart. Documented rather than hidden.
// ---------------------------------------------------------------------------

/** "13 Aug 2026" — unambiguous, avoids the DD/MM vs MM/DD trap entirely. */
export function formatDateShort(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** "13 August 2026 at 02:36" — for the detail page, where space allows. */
export function formatDateLong(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * "3 days ago" — for the recent list, where elapsed time reads faster than a
 * date.
 *
 * Intl.RelativeTimeFormat is built into the browser, so this needs no date
 * library. Picking the largest unit that fits is what turns "72 hours ago" into
 * "3 days ago"; a raw hours figure is technically accurate and much harder to
 * read at a glance.
 */
export function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const seconds = Math.round((then - Date.now()) / 1000);

  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 60 * 60 * 24 * 365],
    ["month", 60 * 60 * 24 * 30],
    ["day", 60 * 60 * 24],
    ["hour", 60 * 60],
    ["minute", 60],
  ];

  const formatter = new Intl.RelativeTimeFormat("en-GB", { numeric: "auto" });

  for (const [unit, secondsInUnit] of units) {
    if (Math.abs(seconds) >= secondsInUnit) {
      return formatter.format(Math.round(seconds / secondsInUnit), unit);
    }
  }

  return "just now";
}
