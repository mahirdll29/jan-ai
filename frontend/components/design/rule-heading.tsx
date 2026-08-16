import { cn } from "@/lib/utils";

// A section heading with a hairline rule and an optional right-aligned count.
//
// This is the design's main structural device, and it does a real job: it marks
// where one section of a register ends and the next begins, the way a rule does
// in a printed report. The count on the right is live data, not ornament.
//
// ---- WHY A RULE AND NOT A CARD ---------------------------------------------
//
// The default move is to wrap each section in a rounded, shadowed card. This
// design deliberately does not: a page of cards reads as a dashboard product,
// and separation by 1px line reads as a document. Lines also cost nothing —
// they do not add padding, they do not nest, and they do not need a background
// colour that then has to work in two themes.

export function RuleHeading({
  children,
  count,
  as: Tag = "h2",
  className,
}: {
  children: React.ReactNode;
  /** Optional figure shown on the right — a total, a filtered count. */
  count?: string | number;
  as?: "h1" | "h2" | "h3";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-baseline justify-between gap-4 border-b border-rule pb-2",
        className
      )}
    >
      {/* `as` lets the visual size stay constant while the heading LEVEL
          changes to match the page's outline. Heading levels are how screen
          reader users navigate a page, so they have to describe the real
          document structure — they are not a font-size control. */}
      <Tag className="display-wide text-h3 text-ink">{children}</Tag>

      {count !== undefined && (
        // tnum keeps the digits monospaced-in-width so a figure that updates
        // (a filtered count, a live total) does not make the layout twitch.
        <span className="docket tnum shrink-0">{count}</span>
      )}
    </div>
  );
}
