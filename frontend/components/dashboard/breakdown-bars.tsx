import { cn } from "@/lib/utils";

// A labelled horizontal bar per row. Used for all four breakdowns.
//
// ===========================================================================
// WHY THIS FORM, AND WHY IT IS NOT A PIE CHART OR A STACKED BAR
// ===========================================================================
//
// The five category colours were run through a colour-vision validator and they
// FAIL as a categorical chart palette:
//
//   CVD separation    rust <-> moss   dE 5.3 (deuteranopia) — the classic
//                                     red/green confusion
//   Normal vision     moss <-> umber  dE 13.8, below the 15 floor
//   Chroma floor      umber, moss and slate read as grey
//
// That is a real result and it is not a mistake in the palette. Those colours
// were tuned in Phase 2 for a 4px tick sitting NEXT TO A WRITTEN LABEL, and
// measured passing at that job. Adjacent chart fills carrying identity on their
// own is a harder job, and they do not pass it.
//
// The fix is the FORM, not the colours. In a pie chart or a stacked bar, colour
// is the only thing telling one slice from the next — so a red/green pair at
// dE 5.3 makes the chart unreadable for a deuteranopic viewer, and repainting
// the palette would be the only option.
//
// Here, every row carries its own written label and its own printed number.
// Identity comes from the text; colour only ties the row to the same category's
// map pin and list tick. No two fills are ever adjacent needing to be told
// apart, so the CVD weakness has nothing to act on — and the app keeps one
// colour language across list, map and dashboard.
//
// The accessibility rule this satisfies is the real one: IDENTITY IS NEVER
// COLOUR-ALONE.
// ===========================================================================

export type BreakdownRow = {
  /** The written label. This, not the colour, is what identifies the row. */
  label: string;
  count: number;
  /**
   * A Tailwind background class. Optional — the status and AI-status
   * breakdowns pass nothing and get a neutral ink bar, because those have no
   * colour meaning anywhere else in the app and inventing one would add a
   * second colour language for no gain.
   */
  barClass?: string;
};

export function BreakdownBars({
  rows,
  total,
}: {
  rows: BreakdownRow[];
  /**
   * Denominator for the bar widths. Passed in rather than derived, so several
   * breakdowns on the same screen share a scale where that is meaningful.
   */
  total: number;
}) {
  // Scale to the largest row, not to the total. Scaling to the total makes
  // every bar a stub as soon as one category dominates, which wastes the whole
  // width and hides the differences between the small ones.
  //
  // `|| 1` guards the empty case: with no reports every count is 0, and 0/0 is
  // NaN, which React renders as a broken style attribute.
  const largest = Math.max(...rows.map((r) => r.count), 1);

  return (
    // A description list, because that is literally what this is: terms and
    // their values. It reads correctly to a screen reader with no chart
    // semantics, no ARIA, and no separate table view to maintain.
    <dl className="space-y-2.5">
      {rows.map((row) => {
        const share = total > 0 ? Math.round((row.count / total) * 100) : 0;

        return (
          // The label track is wider from `sm` up because the longest label in
          // use — "AI unavailable" — was being truncated to "AI UNAVAILAB…" at
          // a fixed 7.5rem. A truncated label defeats the whole point of this
          // form, since the label is what carries identity here, not the
          // colour. Narrower on a phone so the bar keeps usable width.
          <div
            key={row.label}
            className="grid grid-cols-[7rem_1fr_4.5rem] items-center gap-3 sm:grid-cols-[9.5rem_1fr_5rem]"
          >
            {/* Wraps on a phone, truncates only from `sm` up — where the track
                is wide enough that it never actually fires. A two-line label is
                a small cosmetic cost; a truncated one hides the very thing
                carrying identity in this chart form. */}
            <dt className="docket sm:truncate">{row.label}</dt>

            {/* aria-hidden: the bar is a visual restatement of the number
                printed immediately to its right. Announcing it would be noise. */}
            <div aria-hidden="true" className="h-2.5 bg-paper-sunk">
              <div
                className={cn("h-full", row.barClass ?? "bg-ink")}
                style={{ width: `${(row.count / largest) * 100}%` }}
              />
            </div>

            <dd className="docket tnum text-right text-ink">
              {row.count.toLocaleString("en-GB")}
              {/* The percentage is the useful comparison; the count is the
                  fact. Both are printed, so neither has to be inferred from
                  the length of a bar. */}
              <span className="ml-1.5 text-ink-muted">{share}%</span>
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
