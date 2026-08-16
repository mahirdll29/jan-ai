"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";

import { RequireAuth } from "@/components/auth/require-auth";
import { ReportList } from "@/components/reports/report-list";
import { Pager } from "@/components/reports/pager";
import { RuleHeading } from "@/components/design/rule-heading";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, reports as reportsApi } from "@/lib/api";
import type { Paginated, Report } from "@/lib/types";

// PROTECTED, and a CLIENT component — unlike /reports.
//
// The difference is the cookie. GET /api/reports/mine filters to the user from
// the verified token, so it needs the browser's cookie, and (as documented in
// the auth section) Next's server cannot forward that cookie in production.
// Fetching from the browser behaves identically in both environments.
//
// ---- THIS ENDPOINT TAKES page AND limit ONLY --------------------------------
//
// No category, no status, no search, no bounding box. So this page deliberately
// does NOT reuse the filter bar from /reports. Rendering filters the backend
// would silently ignore is worse than not offering them: the user would set one,
// see nothing change, and reasonably conclude the feature is broken.

function MyReports({ page }: { page: number }) {
  const [result, setResult] = useState<Paginated<Report> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    setResult(null);
    setError(null);

    reportsApi
      .mine({ page })
      .then((data) => {
        if (!ignore) setResult(data);
      })
      .catch((err) => {
        if (ignore) return;
        setError(
          err instanceof ApiError && err.status === 401
            ? "Your session expired. Sign in again."
            : "Couldn't load your reports."
        );
      });

    return () => {
      ignore = true;
    };
  }, [page]);

  return (
    <div className="space-y-10">
      <header className="space-y-3">
        <p className="docket">Your entries</p>
        <h1 className="display-wide text-h1 text-ink">My reports</h1>
        <p className="max-w-prose text-ink-muted">
          Everything you have filed, newest first.
        </p>
      </header>

      {error && (
        <div className="border-l-2 border-destructive bg-destructive/5 px-4 py-3 text-ink">
          {error}
        </div>
      )}

      {!result && !error && (
        <div className="space-y-4" aria-busy="true">
          <span className="sr-only">Loading your reports…</span>
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      )}

      {result && result.data.length === 0 && (
        <div className="border-t border-rule py-14 text-center">
          <p className="display-wide text-h3 text-ink">
            You haven&apos;t filed anything yet
          </p>
          <p className="mx-auto mt-2 max-w-sm text-ink-muted">
            When you report a pothole, a blocked drain or a dark streetlight, it
            will appear here so you can track it.
          </p>
          <Link
            href="/reports/new"
            className="docket mt-6 inline-block py-1.5 text-signal-ink underline underline-offset-4"
          >
            File your first report
          </Link>
        </div>
      )}

      {result && result.data.length > 0 && (
        <div className="space-y-6">
          <RuleHeading as="h2" count={`${result.total} total`}>
            Newest first
          </RuleHeading>

          <ReportList reports={result.data} />

          <Pager
            page={result.page}
            totalPages={result.totalPages}
            total={result.total}
            buildHref={(target) =>
              target > 1 ? `/reports/mine?page=${target}` : "/reports/mine"
            }
          />
        </div>
      )}
    </div>
  );
}

export default function MyReportsPage(props: PageProps<"/reports/mine">) {
  const sp = use(props.searchParams);
  const raw = typeof sp.page === "string" ? Number(sp.page) : 1;
  const page = Number.isInteger(raw) && raw >= 1 ? raw : 1;

  return (
    <RequireAuth>
      <MyReports page={page} />
    </RequireAuth>
  );
}
