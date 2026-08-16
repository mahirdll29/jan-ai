import { cn } from "@/lib/utils";
import { CATEGORY_LABEL } from "@/lib/format";
import type { Category } from "@/lib/types";

// A solid bar in the report's category colour, sitting on the leading edge of a
// list row or a detail header.
//
// This is the only place the category colour appears as a large block, and it
// is what lets a page of reports be scanned by category without reading a word.
//
// ---- WHY THE CLASS NAMES ARE A LOOKUP TABLE AND NOT A TEMPLATE STRING ------
//
// The tempting version is:
//     className={`bg-cat-${category.toLowerCase()}`}
//
// It does not work, and the reason is worth understanding because it catches
// everyone once. Tailwind does not run in the browser and does not evaluate
// JavaScript — at build time it scans the source files as PLAIN TEXT looking
// for complete class names. The string "bg-cat-" followed by a variable never
// appears anywhere as a whole class name, so Tailwind never generates that CSS,
// and the element renders with no background at all.
//
// Writing every class out in full means each one physically exists in the
// source for the scanner to find. It is also exhaustive: Record<Category, ...>
// makes TypeScript fail the build if a sixth category is ever added to the
// schema and someone forgets to give it a colour here.
const TICK_COLOUR: Record<Category, string> = {
  POTHOLE: "bg-cat-pothole",
  GARBAGE: "bg-cat-garbage",
  DRAINAGE: "bg-cat-drainage",
  STREETLIGHT: "bg-cat-streetlight",
  OTHER: "bg-cat-other",
};

export function CategoryTick({
  category,
  className,
}: {
  category: Category;
  className?: string;
}) {
  return (
    <span
      // aria-hidden because the colour is decorative REDUNDANCY, not
      // information. The category name is always written next to it in text, so
      // announcing "pothole" twice would make the row more tedious to hear, not
      // more informative. Colour must never be the only carrier of meaning —
      // here it never is.
      aria-hidden="true"
      className={cn(
        "block w-1 shrink-0 rounded-sm",
        TICK_COLOUR[category],
        className
      )}
    />
  );
}

/**
 * The tick plus its written label — for places where the category needs to be
 * read rather than scanned.
 */
export function CategoryLabel({
  category,
  className,
}: {
  category: Category;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span
        aria-hidden="true"
        className={cn("size-2 rounded-full", TICK_COLOUR[category])}
      />
      <span className="docket">{CATEGORY_LABEL[category]}</span>
    </span>
  );
}
