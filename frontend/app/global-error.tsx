"use client";

import "./globals.css";

// THE LAST-RESORT ERROR PAGE.
//
// ---- WHAT IS DIFFERENT ABOUT THIS ONE --------------------------------------
//
// app/error.tsx catches everything below the root layout. It cannot catch the
// root layout, because it renders INSIDE it — if app/layout.tsx is the thing
// that threw, there is no frame left to draw an error message in.
//
// This file is that case. It does not sit inside the root layout, it REPLACES
// it. Which is why it has to render its own <html> and <body> tags: nothing
// else is going to.
//
// It is the only component in the app that does that, and it looks like a
// mistake until you know why.
//
// ---- WHAT IT LOSES, DELIBERATELY -------------------------------------------
//
// Replacing the root layout means losing everything the root layout set up:
//
//   * next/font. Archivo and Public Sans are applied through a className on
//     <html> in app/layout.tsx, so --font-archivo and --font-public-sans are
//     simply not defined here. --font-sans falls through to its declared
//     fallback (ui-sans-serif, system-ui) and the page renders in the system
//     face. Correct, not broken — the alternative is re-importing the fonts
//     into a page that should almost never render.
//
//   * MotionProvider and AuthProvider. No animation, no session. Both are
//     irrelevant when the shell itself is broken.
//
// globals.css IS imported, so the palette and the type scale still apply and
// this reads as the same product rather than a browser default page.
//
// ---- WHY THERE IS NO reset() BUTTON HERE -----------------------------------
//
// Next passes one, and it is offered in app/error.tsx because most errors down
// there are transient. This one is not that: the root layout failing means the
// application shell could not be constructed, and re-rendering the same broken
// tree is unlikely to end differently. A full reload is the honest suggestion,
// so the action is a plain link to "/" which fetches the document again.
//
// In practice this page should never appear. It exists so that when it does,
// the visitor gets a sentence rather than a blank screen.

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  return (
    <html lang="en">
      <body className="min-h-dvh bg-paper text-ink antialiased">
        <div className="mx-auto flex min-h-dvh max-w-prose flex-col justify-center px-6 py-16">
          <p className="docket">JAN-AI</p>

          <h1 className="mt-4 text-h1 font-semibold text-ink">
            The application failed to load.
          </h1>

          <p className="mt-4 text-ink-muted">
            Something went wrong before the page could be built. Reloading is
            the thing to try; if it keeps happening, the server is likely down.
          </p>

          {/* Same rule as app/error.tsx: the digest, never the message. In
              production Next replaces error.message with a generic string
              precisely so a stack trace cannot reach the browser, and hands
              over this hash to tie the screen to a server log line. */}
          {error.digest && (
            <p className="docket mt-4">Reference {error.digest}</p>
          )}

          {/* A plain <a>, not next/link. Link does a client-side navigation
              through a router that, in this specific situation, is part of what
              just failed. A normal anchor asks the browser for a fresh
              document, which is the actual intent. */}
          <p className="mt-8">
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages --
                the lint rule is right almost everywhere and wrong here. It
                wants next/link, which performs a CLIENT-SIDE navigation through
                the very router that has just failed — this file only renders
                when the root layout itself threw. A plain anchor asks the
                browser for a completely fresh document, which is the actual
                intent. Suppressed deliberately, not worked around. */}
            <a
              href="/"
              className="text-signal-ink underline underline-offset-4"
            >
              Reload JAN-AI
            </a>
          </p>
        </div>
      </body>
    </html>
  );
}
