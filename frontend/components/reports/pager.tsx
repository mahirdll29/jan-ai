import Link from "next/link";
import { cn } from "@/lib/utils";

// A NUMBERED pager, not infinite scroll.
//
// This is why the backend chose offset pagination (skip/take) over cursor
// pagination. Cursors are faster at depth and immune to rows shifting between
// requests — but they cannot tell you how many pages exist, because there is no
// count. Knowing you are on page 3 of 11 requires `total`, and `total` is what
// the envelope returns.
//
// Infinite scroll would also have been wrong here for a reason beyond taste: it
// destroys the back button. Tap a report, press back, and you are at the top of
// a list that has forgotten the forty rows you had scrolled through.

/**
 * Which page numbers to show, with gaps.
 *
 * Rendering all of them is fine at 11 pages and unusable at 400. This keeps the
 * first, the last, and a window around the current page:
 *
 *   1 … 4 [5] 6 … 40
 *
 * `null` marks a gap. Using a sorted Set means the windows can overlap near the
 * start or end without producing duplicates, so pages 1–7 render as a plain run
 * of numbers with no stray ellipsis.
 */
function pageNumbers(current: number, total: number): (number | null)[] {
  const wanted = new Set<number>([1, total, current]);
  for (const offset of [-1, 1]) {
    const page = current + offset;
    if (page >= 1 && page <= total) wanted.add(page);
  }

  const sorted = [...wanted].sort((a, b) => a - b);
  const out: (number | null)[] = [];

  sorted.forEach((page, i) => {
    // A gap only earns an ellipsis if it hides more than one page. If exactly
    // one is missing, print it — "1 … 3" is more characters than "1 2 3".
    if (i > 0 && page - sorted[i - 1] > 1) {
      out.push(page - sorted[i - 1] === 2 ? page - 1 : null);
    }
    out.push(page);
  });

  return out;
}

export function Pager({
  page,
  totalPages,
  total,
  buildHref,
}: {
  page: number;
  totalPages: number;
  total: number;
  /** Given a page number, produce its URL. Owned by the caller, because
      /reports carries filters in the query string and /reports/mine does not. */
  buildHref: (page: number) => string;
}) {
  if (totalPages <= 1) {
    return (
      <p className="docket tnum border-t border-rule pt-4">
        {total} {total === 1 ? "report" : "reports"}
      </p>
    );
  }

  const pages = pageNumbers(page, totalPages);

  return (
    <nav
      aria-label="Pagination"
      className="flex flex-wrap items-center justify-between gap-4 border-t border-rule pt-4"
    >
      <p className="docket tnum">
        Page {page} of {totalPages} · {total} reports
      </p>

      <ul className="flex items-center gap-1">
        <li>
          <PagerLink
            href={buildHref(page - 1)}
            disabled={page <= 1}
            label="Previous page"
          >
            ←
          </PagerLink>
        </li>

        {pages.map((p, i) =>
          p === null ? (
            // aria-hidden: an ellipsis is a visual shorthand for "more pages",
            // not something worth announcing between two numbers.
            <li key={`gap-${i}`} aria-hidden="true" className="docket px-1">
              …
            </li>
          ) : (
            <li key={p}>
              <PagerLink
                href={buildHref(p)}
                current={p === page}
                label={`Page ${p}`}
              >
                {p}
              </PagerLink>
            </li>
          )
        )}

        <li>
          <PagerLink
            href={buildHref(page + 1)}
            disabled={page >= totalPages}
            label="Next page"
          >
            →
          </PagerLink>
        </li>
      </ul>
    </nav>
  );
}

function PagerLink({
  href,
  children,
  label,
  current,
  disabled,
}: {
  href: string;
  children: React.ReactNode;
  label: string;
  current?: boolean;
  disabled?: boolean;
}) {
  const shared =
    "flex min-h-9 min-w-9 items-center justify-center rounded-sm px-2 tnum text-sm transition-colors";

  if (disabled) {
    // A <span>, not a disabled <a>. There is no `disabled` attribute on an
    // anchor — adding one does nothing, and the link stays clickable. Removing
    // the element from the tab order entirely is the honest way to say "this
    // does not go anywhere".
    return (
      <span aria-hidden="true" className={cn(shared, "text-ink-muted/40")}>
        {children}
      </span>
    );
  }

  return (
    <Link
      href={href}
      aria-label={label}
      // aria-current="page" is how a screen reader announces which page you are
      // on. The bold-and-boxed styling is the visual half of the same statement.
      aria-current={current ? "page" : undefined}
      className={cn(
        shared,
        current
          ? "bg-ink text-paper"
          : "text-ink hover:bg-paper-sunk hover:text-signal-ink"
      )}
    >
      {children}
    </Link>
  );
}
