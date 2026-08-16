import type { Stats } from "@/lib/types";

// The headline figures.
//
// DELIBERATELY NOT A CHART. Three numbers with labels answer "how much?"
// faster and more precisely than any plot of three numbers could — a chart
// would be decoration wrapped around data that is already one glance wide.
//
// Reaching for a chart because the page is called a dashboard is the most
// common way dashboards get worse.

function Tile({
  value,
  label,
  note,
}: {
  value: number;
  label: string;
  note?: string;
}) {
  return (
    <div className="border-t border-rule pt-4">
      {/* tnum so the figures line up across the row and a changing number
          does not shift the label under it. */}
      <p className="display-wide tnum text-display text-ink">
        {value.toLocaleString("en-GB")}
      </p>
      <p className="docket mt-1">{label}</p>
      {note && <p className="mt-1 text-sm text-ink-muted">{note}</p>}
    </div>
  );
}

export function StatTiles({ stats }: { stats: Stats }) {
  // Derived here rather than asked of the backend: the trend array already
  // contains exactly this window, so summing it costs nothing and avoids a
  // second endpoint that could disagree with the first.
  const inWindow = stats.trend.reduce((sum, day) => sum + day.count, 0);

  const open = stats.byStatus.find((s) => s.status === "OPEN")?.count ?? 0;

  return (
    <div className="grid gap-6 sm:grid-cols-3">
      <Tile value={stats.totalReports} label="Reports filed" note="All time" />
      <Tile
        value={inWindow}
        label={`Last ${stats.trendDays} days`}
        // Labelled honestly. The backend's window is a rolling 30 days, which
        // is not the same thing as "this month" — saying the rounder word would
        // be a small lie.
        note="Rolling window"
      />
      <Tile value={open} label="Still open" note="Not yet resolved" />
    </div>
  );
}
