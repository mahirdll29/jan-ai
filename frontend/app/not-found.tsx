import Link from "next/link";

import { PageNotice } from "@/components/design/page-notice";

// THE 404 PAGE, at the root.
//
// ---- WHAT ACTUALLY RENDERS THIS --------------------------------------------
//
// Two different things, which is worth separating because they feel unrelated
// and use the same file:
//
//   1. A URL matching no route at all — /nonsense. Next renders this and sends
//      a real 404 status.
//   2. A `notFound()` call inside a route, when there is no closer boundary.
//
// ---- THE BOUNDARY LOOKUP, WHICH IS THE BIT WORTH KNOWING -------------------
//
// `notFound()` does not find "the 404 page". It throws, and Next walks UP the
// route tree looking for the NEAREST not-found.tsx. Whichever it finds renders
// inside the layouts above THAT file — not above the page that threw.
//
// So this file, sitting at the root, renders inside app/layout.tsx only. It
// gets the fonts, the tokens and the providers, and no navigation rail.
//
// app/(main)/not-found.tsx exists alongside it precisely because of that rule:
// a signed-in user who opens a deleted report should keep their navigation, and
// the only way to arrange that is a closer boundary. Same body, two frames.
//
// ---- WHY THERE IS A WORDMARK HERE ------------------------------------------
//
// Without the shell there is no chrome at all, and a page with no route back to
// the product is how a 404 becomes a dead end. It is deliberately just the
// wordmark rather than the full marketing header: the visitor mistyped a URL,
// they do not need a sign-in prompt.

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-5xl flex-col px-6 py-10 sm:px-10 lg:px-14">
      <header>
        {/* inline-block so the hit area is the width of the wordmark and not
            the full column — a full-width invisible link across the top of a
            page is a trap for a stray tap. Same reasoning as the auth layout. */}
        <Link
          href="/"
          className="docket inline-block py-1.5 text-ink transition-colors hover:text-signal-ink"
        >
          JAN-AI
        </Link>
      </header>

      <main className="flex flex-1 items-center py-16">
        <PageNotice
          docket="404 · No such page"
          title="This page isn't in the register."
          actions={
            <>
              <Link
                href="/reports"
                className="py-1 text-signal-ink underline underline-offset-4"
              >
                Browse the register
              </Link>
              <Link
                href="/reports/new"
                className="py-1 text-signal-ink underline underline-offset-4"
              >
                File a report
              </Link>
              <Link href="/" className="py-1 text-ink-muted hover:text-ink">
                Home
              </Link>
            </>
          }
        >
          <p>
            The address you followed doesn&apos;t match anything here. It may
            have been mistyped, or it may point at a report that has since been
            deleted.
          </p>
        </PageNotice>
      </main>
    </div>
  );
}
