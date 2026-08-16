import Link from "next/link";

import { BreakdownBars } from "@/components/dashboard/breakdown-bars";
import { StatTiles } from "@/components/dashboard/stat-tiles";
import { RuleHeading } from "@/components/design/rule-heading";
import { ReportList } from "@/components/reports/report-list";
import { Button } from "@/components/ui/button";
import { stats as statsApi } from "@/lib/api";
import { CATEGORY_LABEL } from "@/lib/format";
import type { Category, Stats } from "@/lib/types";

// THE LANDING PAGE.
//
// A SERVER component. No session, no interactivity, no browser API — just
// public data rendered to HTML. The only client component anywhere on this
// route is AccountArea in the layout, and ReportList below.
//
// ---- ONE REQUEST, NOT TWO --------------------------------------------------
//
// This page shows headline figures, a category breakdown AND the five newest
// reports, and it fetches all of that with a single call to GET /api/stats.
//
// That is not a coincidence — `recent` is part of the stats response because
// Module 5 deliberately built one endpoint instead of three, on the grounds
// that the dashboard renders everything on one page load. The landing page was
// not in scope when that call was made, and it inherits the benefit anyway: one
// round trip, one failure mode, one loading state.
//
// It is a good illustration of a backend decision paying off somewhere it was
// not aimed. It also means the copy below can be honest about the numbers being
// live, because they are the same numbers the dashboard shows.
//
// ---- WHY THE FIGURES APPEAR EXACTLY ONCE -----------------------------------
//
// The obvious landing-page move is a row of big numbers in the hero AND a stats
// section further down. That prints the same three figures twice on one screen,
// which reads as padding. The hero is words; the register section is figures.

const CATEGORY_BAR: Record<Category, string> = {
  POTHOLE: "bg-cat-pothole",
  GARBAGE: "bg-cat-garbage",
  DRAINAGE: "bg-cat-drainage",
  STREETLIGHT: "bg-cat-streetlight",
  OTHER: "bg-cat-other",
};

async function loadStats(): Promise<Stats | null> {
  try {
    // no-store: fetched per request rather than at build time. Without it Next
    // would prerender this page during `next build`, making a successful build
    // depend on the backend being up and then freezing whatever figures it got.
    return await statsApi.get(30, { cache: "no-store" });
  } catch {
    // ---- THE DATA IS AN ENHANCEMENT, NOT A DEPENDENCY --------------------
    //
    // Same rule the AI pipeline follows on the backend, and the same rule the
    // login page's stats panel follows: a failing optional extra must never
    // take down the thing the visitor actually came for.
    //
    // Here that thing is the explanation of what JAN-AI is. If the backend is
    // unreachable, the two data-driven sections below simply do not render and
    // the page still says what the product does and where to sign in.
    return null;
  }
}

export default async function LandingPage() {
  const stats = await loadStats();

  return (
    <div className="space-y-20">
      {/* ================= MASTHEAD =================
          No motion here on purpose. This is the first thing painted on the
          first page a visitor sees, and animating it delays the only content
          that matters. The staggered entrance on this page belongs to the list
          of reports further down, where it explains that rows are arriving in
          order. Motion should explain a change, not announce a page.

          The consequence is that the masthead ships no JavaScript at all. */}
      <section className="max-w-3xl">
        <p className="docket">Open register of civic issues</p>

        <h1 className="display-wide mt-5 text-display text-ink">
          Report what&apos;s broken outside.
        </h1>

        <p className="mt-6 max-w-2xl text-lg text-ink-muted">
          Potholes, uncollected garbage, blocked drains and dead streetlights —
          filed with a photo and a location, then tracked in public from open to
          resolved.
        </p>

        <div className="mt-9 flex flex-wrap items-center gap-x-8 gap-y-4">
          {/* asChild makes the Button render AS the Link rather than wrapping
              one. A <button> inside an <a> is invalid HTML and gives assistive
              tech two nested controls to announce; this produces a single <a>
              carrying the button's styles. */}
          <Button asChild size="lg">
            <Link href="/reports/new">File a report</Link>
          </Button>

          <Link
            href="/reports"
            className="py-1 text-signal-ink underline underline-offset-4"
          >
            Browse the register
          </Link>
        </div>
      </section>

      {/* ================= THE REGISTER, IN FIGURES =================
          Absent entirely when the backend is unreachable — not replaced with an
          apology. A visitor who has never heard of this service gains nothing
          from being told part of it is down. */}
      {stats && (
        <section className="space-y-8">
          <RuleHeading as="h2" count={stats.totalReports.toLocaleString("en-GB")}>
            What&apos;s in the register
          </RuleHeading>

          {/* Both of these are the dashboard's own components, unchanged. The
              landing page adds no chart code of its own, so a category is the
              same colour and the same shape here as it is when signed in. */}
          <StatTiles stats={stats} />

          <BreakdownBars
            total={stats.totalReports}
            rows={stats.byCategory.map(({ category, count }) => ({
              label: CATEGORY_LABEL[category],
              count,
              barClass: CATEGORY_BAR[category],
            }))}
          />
        </section>
      )}

      {/* ================= THE FIVE NEWEST =================
          The strongest thing a civic register can put on its front page is its
          actual contents. This is the product, demonstrated, before anybody has
          an account — and it is only possible because GET /api/stats is public,
          which was itself a deliberate backend decision.

          ReportList is the same client component the register page uses, so
          these rows arrive with the house staggered entrance and link straight
          through to the real detail pages. No landing-page-specific card. */}
      {stats && stats.recent.length > 0 && (
        <section className="space-y-8">
          <RuleHeading as="h2" count="5 newest">
            Filed recently
          </RuleHeading>

          <ReportList reports={stats.recent} />

          <p>
            {/* ---- inline-block IS LOAD-BEARING HERE, AND WAS ADDED AFTER
                MEASURING ----

                This link is the only content of its paragraph, so it is a
                STANDALONE control and WCAG 2.5.8's 24px minimum applies — the
                specification's exemption is only for links sitting inside a
                sentence.

                Measured at 102 x 18.7px on the first build. `py-1` alone would
                not have fixed it: vertical padding on an `inline` element paints
                but does NOT increase the element's box, so the hit area stays
                the height of the text. `inline-block` gives it a box that
                padding can actually grow — 18.7 -> 26.7px.

                Every other link in this phase happens to sit inside a flex
                container, which blockifies its children and hides this trap.
                This one did not, which is exactly why it was the one that
                failed. */}
            <Link
              href="/reports"
              className="inline-block py-1 text-signal-ink underline underline-offset-4"
            >
              All {stats.totalReports.toLocaleString("en-GB")} reports
            </Link>
          </p>
        </section>
      )}

      {/* ================= HOW IT WORKS ================= */}
      <section className="space-y-8">
        <RuleHeading as="h2">How it works</RuleHeading>

        {/* An ordered list because the steps genuinely are ordered, and a
            screen reader then announces "1 of 3" without any ARIA. The numbers
            are real list markers restyled, not decorative spans. */}
        <ol className="space-y-0">
          <Step
            number="01"
            title="File it"
            last={false}
          >
            A title, a description, a category and a pin on the map. Add a photo
            if you have one — it uploads straight from your phone.
          </Step>

          <Step number="02" title="The AI reads it" last={false}>
            Within a few seconds it adds a plain-language summary, a severity and
            a set of tags, so the register can be sorted by how bad something is
            rather than by when it was typed.{" "}
            {/* The one sentence that explains this project's whole
                architecture, said plainly to somebody who will never read the
                architecture doc. */}
            <strong className="font-medium text-ink">
              If that step fails, the report is still complete
            </strong>{" "}
            — the AI is an enhancement, never a dependency.
          </Step>

          <Step number="03" title="Track it" last>
            Open, in progress, resolved. Every report stays readable by anyone,
            and the dashboard shows what the register as a whole is doing.
          </Step>
        </ol>
      </section>

      {/* ================= CLOSE ================= */}
      <section className="border-t border-rule pt-10">
        <p className="max-w-2xl text-lg text-ink">
          Civic issues are public information. Anyone can read the register —
          you only need an account to add to it.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-4">
          <Button asChild size="lg">
            <Link href="/register">Create an account</Link>
          </Button>

          <Link
            href="/login"
            className="py-1 text-signal-ink underline underline-offset-4"
          >
            Sign in
          </Link>
        </div>
      </section>
    </div>
  );
}

/**
 * One numbered step. Local to this file — it is page furniture, not a piece of
 * the design system, and moving it into components/design/ would suggest it is
 * reusable when nothing else needs it.
 */
function Step({
  number,
  title,
  children,
  last,
}: {
  number: string;
  title: string;
  children: React.ReactNode;
  /** Suppresses the bottom rule on the final row so the list doesn't
      double-rule against whatever follows it. */
  last: boolean;
}) {
  return (
    <li
      className={`grid gap-x-6 gap-y-2 py-6 sm:grid-cols-[4rem_1fr] ${
        last ? "" : "border-b border-rule"
      }`}
    >
      {/* aria-hidden because the <ol> already conveys the position. Announcing
          "01" as content would say the same thing twice. */}
      <span aria-hidden="true" className="docket tnum text-signal-ink">
        {number}
      </span>

      <div>
        <h3 className="display-wide text-h3 text-ink">{title}</h3>
        <p className="mt-2 max-w-prose text-ink-muted">{children}</p>
      </div>
    </li>
  );
}
