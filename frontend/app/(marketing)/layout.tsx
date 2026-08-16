import Link from "next/link";

import { AccountArea } from "@/components/shell/account-area";

// The frame for the landing page — the third route group, and the third frame.
//
// ---- WHY A ROUTE GROUP RATHER THAN JUST NEW CONTENT AT / -------------------
//
// / used to live in (main), which meant it rendered inside the application
// shell: a 15rem navigation rail on the left, content in a padded column.
//
// That is the wrong frame for a front door, for a reason that is about the
// visitor rather than about aesthetics. Two of the rail's four links —
// "My reports" and "Dashboard" — bounce a signed-out stranger straight to a
// login screen. Offering somebody navigation that mostly rejects them is a poor
// first thirty seconds.
//
// A layout cannot remove a parent layout. Layouts nest; they never override.
// So the only way to give / a different frame is to move it out of (main) into
// a group of its own. The parentheses keep the folder out of the URL, so this
// is still exactly "/".
//
// This is the same mechanism (auth) already uses for /login and /register, and
// the third use of it in the project:
//
//     (marketing)  slim header, full-width sections   the front door
//     (auth)       no nav, form beside live figures   sign in / register
//     (main)       the rail shell                     the application
//
// Three frames, three groups, and not one extra URL segment between them.
//
// ---- WHY AccountArea IS REUSED HERE ----------------------------------------
//
// It already handles all three session states — a skeleton while /me is in
// flight, "Sign in · Register" for a stranger, and the name plus sign-out for
// somebody signed in. A landing page needs exactly that, and writing a second
// one would be a second thing to keep correct.
//
// It is the only client component on this page. Everything else here and in
// page.tsx is server-rendered.

export default function MarketingLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh flex-col">
      {/* A hairline rule under the header rather than a shadow or a filled bar.
          Separation in this design is always drawn. */}
      <header className="border-b border-rule px-6 py-4 sm:px-10 lg:px-14">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-6 gap-y-3">
          <Link href="/" className="inline-block">
            <span className="display-wide block text-h3 text-ink">JAN-AI</span>
            <span className="docket block">Civic issues</span>
          </Link>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            {/* py-1.5 for the tap target. This is a standalone control in the
                page chrome, so WCAG 2.5.8's 24px minimum applies to it — the
                exception is only for links inside a sentence. Padding is
                invisible, so it costs nothing to look at. */}
            <Link
              href="/reports"
              className="docket py-1.5 text-ink transition-colors hover:text-signal-ink"
            >
              Browse the register
            </Link>

            <AccountArea />
          </div>
        </div>
      </header>

      {/* flex-1 so a short page still pushes the footer to the bottom of the
          viewport instead of leaving it floating mid-screen. */}
      <main className="flex-1 px-6 py-12 sm:px-10 sm:py-16 lg:px-14">
        <div className="mx-auto max-w-5xl">{children}</div>
      </main>

      <footer className="border-t border-rule px-6 py-8 sm:px-10 lg:px-14">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-6 gap-y-3">
          <p className="docket">JAN-AI · Civic issue reporting</p>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <Link
              href="/reports"
              className="docket py-1.5 transition-colors hover:text-signal-ink"
            >
              The register
            </Link>
            <Link
              href="/login"
              className="docket py-1.5 transition-colors hover:text-signal-ink"
            >
              Sign in
            </Link>
            {/* The style guide is real documentation of the design system and
                stays reachable. It is not a customer-facing page, which is why
                it sits in the footer rather than the nav. */}
            <Link
              href="/styleguide"
              className="docket py-1.5 transition-colors hover:text-signal-ink"
            >
              Style guide
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
