import { cn } from "@/lib/utils";

// The body of a page that is not the page you wanted: 404, and the error
// boundary.
//
// ---- WHY THIS IS ONE COMPONENT AND NOT THREE COPIES ------------------------
//
// There are three of these pages (app/not-found.tsx, app/(main)/not-found.tsx
// and app/error.tsx) and they are the pages nobody looks at while building.
// Three copies of the same markup would drift — one gets a link the others
// don't, one keeps old wording — and nobody would notice for months, because
// you have to break something on purpose to see them.
//
// One block, three callers. The pages themselves are then almost content-free,
// which is the point: what each of them exists to CATCH is the interesting part
// of those files, not their markup.
//
// It takes no props for the surrounding frame on purpose. Each caller decides
// that, because they render in genuinely different places — one inside the app
// shell with its rail, one on a bare page.

export function PageNotice({
  /** The docket eyebrow — "404 · No such page". Set in caps by the utility. */
  docket,
  title,
  children,
  /** Links or buttons offering a way out. Never zero of them. */
  actions,
  className,
}: {
  docket: string;
  title: string;
  children: React.ReactNode;
  actions: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("max-w-prose", className)}>
      <p className="docket">{docket}</p>

      {/* h1, not a styled div. These pages replace the page you asked for, so
          they ARE the document's top-level heading — a screen reader user
          landing here needs the outline to say so. */}
      <h1 className="display-wide user-text mt-4 text-h1 text-ink">{title}</h1>

      <div className="mt-4 space-y-3 text-ink-muted">{children}</div>

      {/* ---- WHY THE WAY OUT IS ALWAYS A ROW OF REAL DESTINATIONS ----------
          A dead end that only offers "go back" makes the visitor's browser do
          the work of guessing what they wanted. Naming the two or three places
          they were plausibly heading is more useful and costs one line.

          gap-x-6 gap-y-3 with flex-wrap so the row stacks rather than overflows
          at 320px — these pages get the same mobile treatment as every other,
          precisely because they are the ones easiest to forget to check. */}
      <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
        {actions}
      </div>
    </div>
  );
}
