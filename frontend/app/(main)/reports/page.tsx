import type { Metadata } from "next";
import Link from "next/link";

import { ReportFilters } from "@/components/reports/report-filters";
import { ReportList } from "@/components/reports/report-list";
import { ReportMap } from "@/components/map/report-map";
import { Pager } from "@/components/reports/pager";
import { RuleHeading } from "@/components/design/rule-heading";
import { reports as reportsApi } from "@/lib/api";
import { CATEGORY_LABEL, STATUS_LABEL } from "@/lib/format";
import type { Category, Paginated, Report, Status } from "@/lib/types";

export const metadata: Metadata = {
  title: "All reports — JAN-AI",
};

// PUBLIC, and a SERVER component.
//
// GET /api/reports needs no cookie, so this page needs no session, ships no
// data-fetching JavaScript, and has its results in the initial HTML. This is
// where server rendering actually pays — unlike the protected pages, which are
// user-specific and gain very little from it.
//
// The interactive parts — the filter controls and the list's motion — are small
// client components nested inside. Server by default, client only where the
// browser is genuinely required.

const VALID_CATEGORIES = Object.keys(CATEGORY_LABEL) as Category[];
const VALID_STATUSES = Object.keys(STATUS_LABEL) as Status[];

/**
 * Reads one query param, and drops anything the backend would reject.
 *
 * Query strings are user input — someone can type `?category=BANANA` into the
 * address bar. The backend answers that with a 400, which would turn a typo in
 * a URL into an error page. Validating here means an unrecognised value is
 * simply ignored and the list still renders.
 *
 * A repeated key (`?category=A&category=B`) arrives as an array; that is
 * treated as absent rather than guessed at, matching the backend's own rule.
 */
function readEnum<T extends string>(
  raw: string | string[] | undefined,
  valid: T[]
): T | undefined {
  if (typeof raw !== "string") return undefined;
  return valid.includes(raw as T) ? (raw as T) : undefined;
}

function readPage(raw: string | string[] | undefined): number {
  if (typeof raw !== "string") return 1;
  const parsed = Number(raw);
  // Same rule as the backend: a whole number of 1 or more. Anything else falls
  // back to page 1 rather than producing a 400.
  return Number.isInteger(parsed) && parsed >= 1 ? parsed : 1;
}

export default async function ReportsPage(props: PageProps<"/reports">) {
  // Awaited — searchParams is a promise in Next 16.
  const sp = await props.searchParams;

  const category = readEnum(sp.category, VALID_CATEGORIES);
  const status = readEnum(sp.status, VALID_STATUSES);
  const search = typeof sp.search === "string" ? sp.search : undefined;
  const page = readPage(sp.page);

  let result: Paginated<Report> | null = null;
  let failed = false;

  try {
    result = await reportsApi.list(
      { category, status, search, page },
      // Fetched per request rather than at build time. Without this Next would
      // prerender the page during `next build`, making the build depend on the
      // backend being up and then freezing whatever list it got.
      { cache: "no-store" }
    );
  } catch {
    // The backend being unreachable is a state to render, not a crash. Details
    // go nowhere near the user — there is nothing they could do with them.
    failed = true;
  }

  /** Preserves the active filters when changing page. */
  function hrefForPage(target: number) {
    const params = new URLSearchParams();
    if (category) params.set("category", category);
    if (status) params.set("status", status);
    if (search) params.set("search", search);
    if (target > 1) params.set("page", String(target));
    const qs = params.toString();
    return qs ? `/reports?${qs}` : "/reports";
  }

  const hasFilters = Boolean(category || status || search);

  return (
    <div className="space-y-10">
      <header className="space-y-3">
        <p className="docket">The register</p>
        <h1 className="display-wide text-h1 text-ink">All reports</h1>
        <p className="max-w-prose text-ink-muted">
          Every civic issue filed on this platform. Readable by anyone —
          you only need an account to file one.
        </p>
      </header>

      <ReportFilters />

      {failed ? (
        <div className="border-l-2 border-destructive bg-destructive/5 px-4 py-3">
          <p className="text-ink">Couldn&apos;t load reports.</p>
          <p className="mt-1 text-sm text-ink-muted">
            The server isn&apos;t responding. Refresh to try again.
          </p>
        </div>
      ) : result && result.data.length === 0 ? (
        <div className="border-t border-rule py-14 text-center">
          <p className="display-wide text-h3 text-ink">
            {hasFilters ? "Nothing matches those filters" : "No reports yet"}
          </p>
          <p className="mx-auto mt-2 max-w-sm text-ink-muted">
            {hasFilters
              ? "Try a broader search, or clear the filters to see everything."
              : "The register is empty. The first report will appear here."}
          </p>
          {!hasFilters && (
            <Link
              href="/reports/new"
              className="docket mt-6 inline-block py-1.5 text-signal-ink underline underline-offset-4"
            >
              File the first report
            </Link>
          )}
        </div>
      ) : (
        result && (
          <div className="space-y-6">
            {/* The map shows exactly this page of results, so filtering moves
                both views together — one fetch, two readings of it.

                Passing server-fetched data straight into a client component:
                `reports` is plain JSON, so it serialises across the boundary
                without ceremony. See components/map/report-map.tsx for why
                there are two client layers rather than one. */}
            <ReportMap reports={result.data} />

            <RuleHeading as="h2" count={`${result.total} total`}>
              {hasFilters ? "Filtered" : "Newest first"}
            </RuleHeading>

            <ReportList reports={result.data} />

            <Pager
              page={result.page}
              totalPages={result.totalPages}
              total={result.total}
              buildHref={hrefForPage}
            />
          </div>
        )
      )}
    </div>
  );
}
