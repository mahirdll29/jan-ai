import Link from "next/link";
import { RailNav } from "./rail-nav";
import { AccountArea } from "./account-area";

// The application frame: a fixed rail on the left, content to the right.
//
// ---- WHY ASYMMETRIC ---------------------------------------------------------
//
// The default is a centred max-width column with equal margins. It is safe and
// it is what most generated layouts do. A persistent rail with the content
// flush against it reads instead like a reference work — a register with a
// hanging margin — which is the register this product is going for.
//
// It also does real work: navigation stays put while the content scrolls, so
// there is no header to hunt for on a long list of reports.
//
// ---- MOBILE IS THE PRIMARY DEVICE -------------------------------------------
//
// This is an app for reporting a broken drain that is in front of you right
// now, so the phone layout is not a fallback. Below `lg` the rail becomes a top
// bar and the links scroll horizontally.
//
// DELIBERATELY NOT A HAMBURGER MENU. Four destinations do not justify hiding
// navigation behind a tap, and an off-canvas drawer brings real obligations
// with it — trapping focus, restoring it on close, an escape key handler,
// blocking background scroll. That is a lot of ways to be subtly broken for
// keyboard and screen reader users, bought in exchange for hiding four words.
//
// This component itself is a SERVER component. Only the two pieces that need
// the browser — the nav's current-page check and the account area's session —
// are client components. The frame ships no JavaScript of its own.

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="lg:flex">
      {/* ---- DESKTOP: the rail ----
          `sticky top-0 h-dvh` keeps it in view while the content scrolls. A
          fixed 15rem column, and a 1px rule instead of a shadow or a filled
          panel — separation in this design is always drawn. */}
      <header className="hidden shrink-0 border-r border-rule lg:sticky lg:top-0 lg:flex lg:h-dvh lg:w-60 lg:flex-col lg:justify-between lg:px-6 lg:py-8">
        <div className="space-y-10">
          <Link href="/" className="block">
            <span className="display-wide text-h3 text-ink">JAN-AI</span>
            <span className="docket mt-1 block">Civic issues</span>
          </Link>

          <RailNav orientation="vertical" />
        </div>

        <AccountArea />
      </header>

      {/* ---- MOBILE: the top bar ----
          `overflow-x-clip` is load-bearing, not defensive. The nav row below
          uses `-mx-6` so it can bleed to the screen edge (which is what makes
          it read as scrollable rather than cut off), and its own
          `overflow-x-auto` scrolls the links inside it.

          A scroll container with negative margins sitting flush against the
          viewport edge still contributes to the DOCUMENT's scroll width in
          Chrome — measured at 320px: the page scrolled sideways 320 → 351 even
          though no element's box extended past 320. Clipping here states the
          containment the design already assumes: the links scroll within the
          header, and nothing escapes it.

          `clip` rather than `hidden` because `hidden` would make the header
          itself a scroll container; `clip` just clips. */}
      <header className="overflow-x-clip border-b border-rule px-6 py-4 lg:hidden">
        <div className="flex items-center justify-between gap-4">
          <Link href="/" className="display-wide text-h3 text-ink">
            JAN-AI
          </Link>
          <AccountArea className="text-right" />
        </div>
        <div className="mt-3">
          <RailNav orientation="horizontal" />
        </div>
      </header>

      {/* min-w-0 is load-bearing next to a flex sibling: without it a wide
          child (a long docket line, a table, a map) forces the flex item to
          grow instead of scrolling inside itself, and the whole page ends up
          with a horizontal scrollbar. */}
      <main className="min-w-0 flex-1 px-6 py-10 sm:px-10 lg:px-14 lg:py-14">
        {children}
      </main>
    </div>
  );
}
