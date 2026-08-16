import { cn } from "@/lib/utils";
import { severityLabel } from "@/lib/format";
import type { Severity } from "@/lib/types";

// Severity, encoded THREE ways at once: a tint, a written label, and a filled
// segment count.
//
// ---- WHY THREE, WHEN ONE WOULD LOOK CLEANER --------------------------------
//
// Because colour alone fails for a lot of people and in a lot of situations.
// Roughly 1 in 12 men has some form of colour vision deficiency, and the most
// common form makes red and green hard to separate — which is exactly the axis
// a naive severity scale uses. Add a greyscale printout, a phone in direct
// sunlight, or a cheap monitor, and a colour-only signal is simply gone.
//
// So each level carries:
//   TINT     the background wash          - fast to scan when it works
//   LABEL    the word "Low"/"Medium"/"High" - unambiguous, works in greyscale
//   SEGMENTS 1, 2 or 3 filled blocks      - a SHAPE, readable with no colour
//               at all and comparable at a glance across rows
//
// The segments are drawn in near-black rather than in the severity colour on
// purpose: it keeps them high-contrast against every tint, so the shape stays
// legible even where the colour does not.

const SEGMENT_COUNT = 3;

const FILLED: Record<Severity, number> = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
};

// Written out in full rather than interpolated — see the note in
// category-tick.tsx on why Tailwind cannot see a class name built at runtime.
const TINT: Record<Severity, string> = {
  LOW: "bg-sev-low",
  MEDIUM: "bg-sev-medium",
  HIGH: "bg-sev-high",
};

export function SeverityGauge({
  severity,
  className,
}: {
  severity: Severity | null;
  className?: string;
}) {
  const filled = severity === null ? 0 : FILLED[severity];
  const label = severityLabel(severity);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-2.5 py-1",
        // Pills are reserved for tags and badges, and this is a badge — the
        // rest of the interface stays on the 4-8px radius scale.
        severity === null
          ? // NOT ASSESSED is a first-class state, not an empty cell. It gets a
            // dashed outline and no fill: visibly different from the three real
            // levels, and visibly not a failure. A report with no severity is a
            // complete report, because the AI is an enhancement and never a
            // dependency.
            "border border-dashed border-rule"
          : TINT[severity],
        className
      )}
    >
      <span aria-hidden="true" className="flex items-center gap-0.5">
        {Array.from({ length: SEGMENT_COUNT }, (_, i) => (
          <span
            key={i}
            className={cn(
              "h-3 w-1 rounded-[1px]",
              i < filled ? "bg-ink" : "bg-ink/15"
            )}
          />
        ))}
      </span>

      {/* The segments are aria-hidden and this text is not, so a screen reader
          hears "Severity: High" once — the shape and the word are the same
          information in two forms, and only one of them should be spoken. */}
      <span className="docket text-ink">
        <span className="sr-only">Severity: </span>
        {label}
      </span>
    </span>
  );
}
