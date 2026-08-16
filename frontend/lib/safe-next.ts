/** Where a signed-in user lands when there is no specific page to return to. */
export const DEFAULT_AFTER_LOGIN = "/reports";

/**
 * Validates a `?next=` return-to path before we navigate to it.
 *
 * ---- WHY THIS FUNCTION EXISTS: THE OPEN REDIRECT --------------------------
 *
 * When the guard bounces someone to /login it records where they were going, so
 * they can be returned there afterwards:
 *
 *     /login?next=/dashboard
 *
 * That value comes from the URL, which means it comes from whoever wrote the
 * link — and if we navigate to it unchecked, an attacker can write:
 *
 *     https://our-real-site.com/login?next=https://evil.example
 *
 * The victim sees OUR domain in the link, trusts it, signs in, and is silently
 * forwarded to a page the attacker controls — typically a pixel-perfect copy of
 * our login screen asking them to "try again". The credibility of the phishing
 * page is borrowed entirely from our domain appearing in the original link.
 * That is an OPEN REDIRECT, and it is our bug, not the browser's.
 *
 * ---- THE CASE ALMOST EVERYONE MISSES --------------------------------------
 *
 * The obvious guard is `next.startsWith("/")`, and it is not enough:
 *
 *     //evil.example
 *
 * starts with "/" and passes. It is a PROTOCOL-RELATIVE URL — the browser reads
 * a leading `//` as "same scheme, new host" and navigates straight off our site.
 * So the test has to be "starts with exactly one slash": a leading `/` AND not a
 * second one.
 *
 * `/\evil.example` is rejected for the same reason — some browsers historically
 * normalised a backslash to a forward slash, which makes it another way to
 * smuggle a host past a naive check.
 *
 * Anything that fails falls back to the default rather than throwing. A
 * malformed return-to is not worth interrupting a successful login over.
 */
export function safeNextPath(next: string | null | undefined): string {
  if (!next) return DEFAULT_AFTER_LOGIN;

  // Must be a path on this site: exactly one leading slash.
  if (!next.startsWith("/")) return DEFAULT_AFTER_LOGIN;
  if (next.startsWith("//")) return DEFAULT_AFTER_LOGIN;
  if (next.startsWith("/\\")) return DEFAULT_AFTER_LOGIN;

  return next;
}
