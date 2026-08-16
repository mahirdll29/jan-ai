import { cn } from "@/lib/utils";
import { buildDocket } from "@/lib/format";
import type { Report } from "@/lib/types";

// THE SIGNATURE ELEMENT.
//
// Every report carries a typeset reference line, the way a real municipal
// complaint carries a case number:
//
//   JAN·DRN·N3UD  ·  23.0225 N  72.5714 E  ·  Filed 13 Aug 2026  ·  AI complete
//
// It renders identically in the list row, at the head of the detail page and in
// the map popup, so a report has ONE STABLE PRINTED IDENTITY everywhere it
// appears. Recognising the same string in three places is what makes a set of
// records feel like a register rather than a feed.
//
// ---- WHY THIS IS STRUCTURE AND NOT DECORATION ------------------------------
//
// Because every segment carries real data — category code, id-derived
// reference, coordinates, filing date, AI state — and each one answers a
// question someone actually asks: which report is this, where is it, when was
// it filed, has the AI run. Numbered markers and eyebrow labels added purely
// for visual rhythm are the opposite of this, and they are one of the tells of
// a generated design.
//
// ---- WHY IT IS SET IN PUBLIC SANS AND NOT A MONOSPACE ----------------------
//
// A monospace would be the obvious choice for a reference code, and it is
// wrong here: monospace reads "developer tool" or "terminal output". Wide-
// tracked uppercase in the UI face reads "printed notice", which is the
// register this product wants. It also holds the two-typeface limit — the
// tabular figures come from font-variant-numeric, not from a third family.

export function DocketLine({
  report,
  className,
}: {
  report: Report;
  className?: string;
}) {
  return (
    <p className={cn("docket", className)}>
      {/* The whole line is one string so it wraps as continuous text on a
          narrow screen rather than breaking into a ragged column of fragments. */}
      {buildDocket(report)}
    </p>
  );
}

/**
 * The docket line with a hairline rule above it.
 *
 * Used at the head of the detail page, where it acts as a masthead. The rule is
 * a 1px border rather than a shadow — separation in this design is always drawn
 * with a line, never faked with elevation.
 */
export function DocketMasthead({
  report,
  className,
}: {
  report: Report;
  className?: string;
}) {
  return (
    <div className={cn("border-t border-rule pt-3", className)}>
      <DocketLine report={report} />
    </div>
  );
}
