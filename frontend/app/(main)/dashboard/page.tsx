import type { Metadata } from "next";
import Link from "next/link";

import { RequireAuth } from "@/components/auth/require-auth";
import { BreakdownBars } from "@/components/dashboard/breakdown-bars";
import { StatTiles } from "@/components/dashboard/stat-tiles";
import { TrendChart } from "@/components/dashboard/trend-chart";
import { ReportRow } from "@/components/reports/report-row";
import { RuleHeading } from "@/components/design/rule-heading";
import { stats as statsApi } from "@/lib/api";
import {
  AI_STATUS_LABEL,
  CATEGORY_LABEL,
  STATUS_LABEL,
  severityLabel,
} from "@/lib/format";
import type { Category, Stats } from "@/lib/types";

export const metadata: Metadata = {
  title: "Dashboard — JAN-AI",
};

// A SERVER component that fetches, wrapping a CLIENT guard.
//
// `RequireAuth` receives server-rendered children as a prop, so the data is in
// the initial HTML while the sign-in check still runs in the browser — the same
// arrangement as the providers in the root layout.
//
// `GET /api/stats` is PUBLIC, so this page needs no cookie. The guard is a
// PRODUCT decision — the dashboard belongs to the signed-in navigation — not a
// data one. Nothing here would 401, and removing the guard would leak nothing.

const CATEGORY_BAR: Record<Category, string> = {
  POTHOLE: "bg-cat-pothole",
  GARBAGE: "bg-cat-garbage",
  DRAINAGE: "bg-cat-drainage",
  STREETLIGHT: "bg-cat-streetlight",
  OTHER: "bg-cat-other",
};

function Dashboard({ stats }: { stats: Stats }) {
  return (
    <div className="max-w-5xl space-y-12">
      <header className="space-y-3">
        <p className="docket">Analytics</p>
        <h1 className="display-wide text-h1 text-ink">Dashboard</h1>
        <p className="max-w-prose text-ink-muted">
          Everything on this page comes from a single request to{" "}
          <code className="text-ink">/api/stats</code>.
        </p>
      </header>

      <StatTiles stats={stats} />

      <section className="space-y-5">
        <RuleHeading as="h2" count={`${stats.trendDays} days`}>
          Reports over time
        </RuleHeading>
        <TrendChart stats={stats} />
      </section>

      <div className="grid gap-12 lg:grid-cols-2">
        <section className="space-y-5">
          <RuleHeading as="h2" count={`${stats.byCategory.length} categories`}>
            By category
          </RuleHeading>
          {/* The only breakdown that carries colour — and it is redundant
              reinforcement of the written label, not the identity channel.
              See the note at the top of breakdown-bars.tsx. */}
          <BreakdownBars
            total={stats.totalReports}
            rows={stats.byCategory.map(({ category, count }) => ({
              label: CATEGORY_LABEL[category],
              count,
              barClass: CATEGORY_BAR[category],
            }))}
          />
        </section>

        <section className="space-y-5">
          <RuleHeading as="h2">By status</RuleHeading>
          {/* No colour: status has no colour meaning anywhere else in this app
              (the map encodes it as opacity), and inventing one here would add
              a second colour language for no gain. */}
          <BreakdownBars
            total={stats.totalReports}
            rows={stats.byStatus.map(({ status, count }) => ({
              label: STATUS_LABEL[status],
              count,
            }))}
          />
        </section>

        <section className="space-y-5">
          <RuleHeading as="h2">Severity</RuleHeading>
          <BreakdownBars
            total={stats.totalReports}
            rows={stats.bySeverity.map(({ severity, count }) => ({
              // severityLabel handles null as "Not assessed" — a first-class
              // state, because a report with no severity is a complete report.
              label: severityLabel(severity),
              count,
            }))}
          />
          <p className="max-w-prose text-sm text-ink-muted">
            Severity is assigned by the AI after a report is filed. &ldquo;Not
            assessed&rdquo; means it has not run, or it failed — the report is
            complete either way.
          </p>
        </section>

        <section className="space-y-5">
          <RuleHeading as="h2">AI enhancement</RuleHeading>
          <BreakdownBars
            total={stats.totalReports}
            rows={stats.byAiStatus.map(({ aiStatus, count }) => ({
              label: AI_STATUS_LABEL[aiStatus],
              count,
            }))}
          />
          {/* This panel is the architectural claim, measured. */}
          <p className="max-w-prose text-sm text-ink-muted">
            Every report above is fully usable regardless of which bar it falls
            in. The AI is an enhancement layer, never a dependency.
          </p>
        </section>
      </div>

      <section className="space-y-5">
        <RuleHeading as="h2" count={`${stats.recent.length} shown`}>
          Recently filed
        </RuleHeading>

        {stats.recent.length === 0 ? (
          <p className="border-t border-rule py-10 text-center text-ink-muted">
            Nothing filed yet.{" "}
            <Link
              href="/reports/new"
              className="text-signal-ink underline underline-offset-4"
            >
              File the first report
            </Link>
            .
          </p>
        ) : (
          // Not a chart. The existing list row, reused unchanged — the same
          // component the register uses, so a report looks identical wherever
          // it appears.
          <div className="border-t border-rule">
            {stats.recent.map((report) => (
              <ReportRow key={report.id} report={report} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default async function DashboardPage() {
  let stats: Stats | null = null;

  try {
    // no-store: fetched per request rather than baked in at build time. See
    // the note on stats.get in lib/api.ts.
    stats = await statsApi.get(30, { cache: "no-store" });
  } catch {
    stats = null;
  }

  return (
    <RequireAuth>
      {stats ? (
        <Dashboard stats={stats} />
      ) : (
        <div className="max-w-prose space-y-3">
          <h1 className="display-wide text-h1 text-ink">Dashboard</h1>
          <div className="border-l-2 border-destructive bg-destructive/5 px-4 py-3">
            <p className="text-ink">Couldn&apos;t load the figures.</p>
            <p className="mt-1 text-sm text-ink-muted">
              The server isn&apos;t responding. Refresh to try again.
            </p>
          </div>
        </div>
      )}
    </RequireAuth>
  );
}
