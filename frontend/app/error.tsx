"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useTransition } from "react";

import { PageNotice } from "@/components/design/page-notice";
import { Button } from "@/components/ui/button";

// THE ERROR BOUNDARY — the App Router's answer to a 500 page.
//
// ---- "use client" IS NOT OPTIONAL HERE -------------------------------------
//
// An error boundary in React is a component implementing componentDidCatch /
// getDerivedStateFromError. Those are lifecycle methods, they exist only where
// React is actually running and re-rendering, and that is the browser. So this
// file MUST be a client component. Next enforces it; the build fails without
// the directive.
//
// This is a different reason from every other "use client" in the project. The
// others are there because something needs a browser API (motion reading the
// motion preference, a form holding state). This one is there because the
// FEATURE ITSELF only exists on the client.
//
// ---- WHAT IT CATCHES, AND WHAT IT DOES NOT ---------------------------------
//
// It wraps everything below the root layout, so it catches a throw from any
// page or component in the app — including a server component, whose error is
// serialised and re-thrown here.
//
// It does NOT catch an error in app/layout.tsx itself, because this file
// renders INSIDE that layout: if the layout is the thing that threw, there is
// nowhere for this to be drawn. That case belongs to app/global-error.tsx,
// which replaces the layout rather than sitting inside it.
//
// ---- THE PART WORTH UNDERSTANDING PROPERLY ---------------------------------
//
// In production, `error.message` is NOT the real message.
//
// Next deliberately strips it and substitutes a generic string, because a
// thrown error can contain anything the server knows — a connection string, a
// file path, a row of someone else's data — and this component renders in the
// visitor's browser. Instead it attaches `digest`: a hash of the original
// error, which also appears in the server log.
//
// So the digest is a CORRELATION ID, not an explanation. Printing it lets a
// user quote something specific when reporting the problem, and lets us find
// the exact server-side stack trace it came from, while the message itself
// never leaves the server.
//
// The consequence for this file is a rule rather than a preference: render
// `error.digest`, never `error.message`. In development the message is intact
// and would look fine here — which is exactly the trap, because the difference
// only shows up in production where nobody is watching.

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  /** Re-renders the segment that threw. See the note on the button below. */
  reset: () => void;
}) {
  const router = useRouter();
  const [retrying, startTransition] = useTransition();

  useEffect(() => {
    // The browser console, not the user interface. In development this is the
    // real stack; in production it is the sanitised object. Either way it is
    // for whoever opens devtools, not for the person who just wanted a report.
    console.error(error);
  }, [error]);

  // ---- WHY THIS IS NOT JUST `reset` -----------------------------------------
  //
  // `reset()` on its own DOES NOT RETRY. It clears the error boundary's state
  // and re-renders the segment — but the segment it re-renders comes from the
  // client-side router cache, which still holds the failed result. So React
  // renders the same error again, instantly, without asking the server
  // anything.
  //
  // MEASURED, because it looks like it works: clicking a reset-only button made
  // the component tree re-render (the accessibility tree's node ids all
  // changed) and produced ZERO network requests for the failed route. The
  // button said "Try again" and did not try again — the most convincing kind of
  // bug, since something visibly happens.
  //
  // `router.refresh()` is the missing half: it discards the cached RSC payload
  // and re-requests the server component. Then `reset()` clears the boundary so
  // the fresh result can mount.
  //
  // Both go inside `startTransition` so the refetch does not block the main
  // thread, and so `retrying` can drive a pending label — which also means the
  // button is honest about the case where the retry fails again.
  function retry() {
    startTransition(() => {
      router.refresh();
      reset();
    });
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-5xl flex-col px-6 py-10 sm:px-10 lg:px-14">
      <header>
        <Link
          href="/"
          className="docket inline-block py-1.5 text-ink transition-colors hover:text-signal-ink"
        >
          JAN-AI
        </Link>
      </header>

      <main className="flex flex-1 items-center py-16">
        <PageNotice
          docket="Something went wrong"
          title="This page didn't load."
          actions={
            <>
              {/* Retries in place rather than reloading the document, which
                  keeps the rest of the app mounted. Worth offering first
                  because a large share of these are transient — one failed
                  fetch, one timeout. See the note on `retry` above for why it
                  is not simply `reset`. */}
              <Button onClick={retry} disabled={retrying}>
                {retrying ? "Retrying…" : "Try again"}
              </Button>

              <Link
                href="/reports"
                className="py-1 text-signal-ink underline underline-offset-4"
              >
                Browse the register
              </Link>
              <Link href="/" className="py-1 text-ink-muted hover:text-ink">
                Home
              </Link>
            </>
          }
        >
          <p>
            Something failed while rendering this page. Trying again often works
            — the cause is usually a request that didn&apos;t come back.
          </p>

          {/* Only rendered when Next actually attached one. In development
              there is often no digest at all, which is itself a useful signal
              that you are not looking at what production shows. */}
          {error.digest && (
            <p className="docket">
              Reference {error.digest}
            </p>
          )}
        </PageNotice>
      </main>
    </div>
  );
}
