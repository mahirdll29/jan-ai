"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { Stats } from "@/lib/types";

// Reports per day over the trend window.
//
// ---- THE ONLY CHART IN THIS DASHBOARD THAT USES A LIBRARY -----------------
//
// The four breakdowns are five labelled rows with a percentage width — plain
// HTML, about ten lines each. Pulling in a charting library to draw a <div>
// with a width would be a poor trade for the bundle.
//
// This one earns it: thirty points on a time axis, values that are not printed
// (so a hover tooltip is genuinely the only way to read an individual day),
// and responsive resizing. That is what a chart library is actually for.
//
// A CLIENT component, because Recharts measures the DOM to size itself.

/** Formats "2026-08-16" as "16 Aug" for the axis. */
function shortDay(iso: string): string {
  // Parsed as UTC — the backend's buckets are UTC days, so reading them in
  // local time could shift a label by one day near midnight.
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value?: number }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  const count = payload[0].value ?? 0;

  return (
    // Built by hand rather than styled through Recharts' props, so it uses the
    // same tokens as every other surface in the app: 1px rule, no shadow.
    <div className="border border-rule bg-paper px-3 py-2">
      <p className="docket">{label ? shortDay(label) : ""}</p>
      <p className="tnum mt-0.5 text-ink">
        {count} {count === 1 ? "report" : "reports"}
      </p>
    </div>
  );
}

export function TrendChart({ stats }: { stats: Stats }) {
  const data = stats.trend;
  const busiest = Math.max(...data.map((d) => d.count), 0);

  return (
    <div className="space-y-3">
      {/* ResponsiveContainer measures its PARENT. A parent with no height
          collapses it to zero and the chart silently disappears — the same
          class of bug as a Leaflet container with no height. Hence an explicit
          height here. */}
      <div className="h-56 w-full sm:h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{ top: 8, right: 8, bottom: 0, left: -20 }}
          >
            {/* Recessive grid: horizontal lines only. Vertical gridlines on a
                30-point time axis produce a picket fence that competes with
                the data. */}
            <CartesianGrid
              stroke="var(--rule)"
              strokeDasharray="2 4"
              vertical={false}
            />

            <XAxis
              dataKey="date"
              tickFormatter={shortDay}
              // Roughly weekly labels. Every day would overlap into mush at
              // this width, and Recharts' auto-thinning is not reliable across
              // breakpoints.
              interval={Math.max(Math.floor(data.length / 5) - 1, 0)}
              tick={{ fill: "var(--ink-muted)", fontSize: 11 }}
              stroke="var(--rule)"
              tickLine={false}
            />

            <YAxis
              // Whole numbers only — half a report does not exist, and Recharts
              // will happily label an axis 0, 0.5, 1 when the maximum is small.
              allowDecimals={false}
              // Keeps a flat/empty series from rendering as a single line
              // hugging the top of the plot.
              domain={[0, Math.max(busiest, 1)]}
              tick={{ fill: "var(--ink-muted)", fontSize: 11 }}
              stroke="var(--rule)"
              tickLine={false}
              width={40}
            />

            <Tooltip
              content={<ChartTooltip />}
              // The crosshair. Recharts' default is a filled grey block, which
              // reads as a selection rather than a pointer.
              cursor={{ stroke: "var(--ink-muted)", strokeWidth: 1 }}
            />

            <Area
              type="monotone"
              dataKey="count"
              // ONE saturated colour, the app's accent — a single series needs
              // no palette, and no legend either, because the panel heading
              // already names it.
              stroke="var(--signal)"
              strokeWidth={2}
              // A FLAT fill at low opacity. The brief rules out gradient fills,
              // and rightly: a gradient implies the value means something
              // different at the top of the band than the bottom, which it
              // does not.
              fill="var(--signal)"
              fillOpacity={0.12}
              // No dot per point — 30 dots is noise. The tooltip's crosshair
              // does the job of pointing at one.
              dot={false}
              activeDot={{ r: 4, fill: "var(--signal)", stroke: "var(--paper)", strokeWidth: 2 }}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* ---- THE SAME DATA, REACHABLE WITHOUT A POINTER --------------------
          The chart's per-day values only exist on hover, which makes them
          unavailable to anyone using a keyboard or a screen reader. An SVG plot
          is not self-describing.

          A visually-hidden table is the plain fix: identical numbers, real
          table semantics, no duplicated source of truth (it maps the same
          array). Cheaper and more robust than trying to make thirty SVG paths
          individually focusable. */}
      {/* ---- sr-only GOES ON THE WRAPPER, NOT THE TABLE ------------------
          Measured: with `sr-only` on the <table> itself, this pushed the page
          into horizontal scroll at 320px (320 -> 335).

          Tailwind's `sr-only` works by setting width:1px, height:1px and
          clipping. That contains a <div>. It does NOT contain a <table>: a
          table sizes itself to its content and ignores a width smaller than
          that, so the element stayed 312px wide and — being absolutely
          positioned — still contributed to the document's scrollable width.

          Wrapping instead puts the 1px clip on a plain block, which does obey
          it, and the table is clipped inside. Same content for a screen
          reader, no effect on layout.

          Worth remembering as a general rule: visually-hidden utilities assume
          a normal block box, and replaced or table-layout elements do not
          behave like one. */}
      <div className="sr-only">
        <table>
          <caption>
            Reports filed per day over the last {stats.trendDays} days
          </caption>
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col">Reports</th>
            </tr>
          </thead>
          <tbody>
            {data.map((day) => (
              <tr key={day.date}>
                <th scope="row">{shortDay(day.date)}</th>
                <td>{day.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
