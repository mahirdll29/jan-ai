import Link from "next/link";

// PLACEHOLDER. The real landing page is Phase 7.
//
// It exists so `/` is not a 404 during development, and so the fonts and tokens
// are exercised on a second route. Deliberately not designed yet — building a
// landing page now would mean designing it twice, since Phase 7 has the whole
// product to draw from and this has nothing.

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col justify-center px-6 py-16">
      <p className="docket">JAN-AI</p>
      <h1 className="display-wide mt-4 text-display text-ink">
        Civic issue reporting
      </h1>
      <p className="mt-4 max-w-xl text-lg text-ink-muted">
        Report potholes, uncollected garbage, blocked drains and broken
        streetlights. Track every report from open to resolved.
      </p>

      <div className="mt-10 border-t border-rule pt-6">
        <p className="docket">Phase 2 · scaffold and design system</p>
        <p className="mt-3 text-ink-muted">
          The landing page is built in Phase 7. For now, the design system lives
          at{" "}
          <Link
            href="/styleguide"
            className="text-signal-ink underline underline-offset-4"
          >
            /styleguide
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
