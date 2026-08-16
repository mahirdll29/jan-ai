import { CategoryTick, CategoryLabel } from "@/components/design/category-tick";
import { SeverityGauge } from "@/components/design/severity-gauge";
import { DocketLine } from "@/components/design/docket-line";
import { RuleHeading } from "@/components/design/rule-heading";
import { MotionDemo } from "@/components/design/motion-demo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { splitTags, CATEGORY_LABEL, STATUS_LABEL } from "@/lib/format";
import type { Category, Report, Severity, Status } from "@/lib/types";

// The design system, rendered.
//
// This page is not a demo — it is the reference. Every token, every state and
// every primitive appears here, so a change to globals.css can be checked in
// one place instead of hunted across the app. It is also what makes the
// accessibility audit possible before a single real page exists: contrast,
// focus order and labelling are all measurable here.
//
// It is a SERVER component. Nothing on it needs the browser except the
// connection check, which is a client component imported into it — that is the
// normal App Router arrangement: server by default, client only where
// interactivity genuinely lives.

export const metadata = {
  title: "Style guide — JAN-AI",
};

// A stand-in report for rendering the docket line. Shaped exactly like the API
// response, including a real cuid-style id, so the reference code and
// coordinate formatting are exercised on realistic data rather than "test".
const SAMPLE: Report = {
  id: "cmsqwokol0003eybcsjfo900o",
  title: "Blocked storm drain flooding the lane",
  description:
    "A blocked storm drain on the residential lane floods the road whenever it rains heavily.",
  imageUrl: null,
  category: "DRAINAGE",
  severity: "MEDIUM",
  status: "OPEN",
  latitude: 23.0225,
  longitude: 72.5714,
  aiSummary:
    "A blocked storm drain on a residential lane causes the road to flood during heavy rain.",
  aiTags: "storm-drain,flooding,residential,blockage,road",
  aiStatus: "COMPLETED",
  createdAt: "2026-08-13T02:35:30.357Z",
  updatedAt: "2026-08-13T02:35:32.350Z",
  user: { id: "cmsqurmwz0000ey8cmhjkdnc8", name: "Alice" },
};

const CATEGORIES: Category[] = [
  "POTHOLE",
  "GARBAGE",
  "DRAINAGE",
  "STREETLIGHT",
  "OTHER",
];
const SEVERITIES: (Severity | null)[] = ["LOW", "MEDIUM", "HIGH", null];
const STATUSES: Status[] = ["OPEN", "IN_PROGRESS", "RESOLVED"];

// Written out in full — Tailwind scans source as plain text and cannot see a
// class name assembled at runtime. Same reason as in category-tick.tsx.
const SWATCH_BG: Record<Category, string> = {
  POTHOLE: "bg-cat-pothole",
  GARBAGE: "bg-cat-garbage",
  DRAINAGE: "bg-cat-drainage",
  STREETLIGHT: "bg-cat-streetlight",
  OTHER: "bg-cat-other",
};

// Realistic titles, so the in-situ rows below read like a real list rather than
// five repetitions of the same string.
const SAMPLE_TITLE: Record<Category, string> = {
  POTHOLE: "Deep pothole at the Ring Road junction",
  GARBAGE: "Refuse uncollected for nine days",
  DRAINAGE: "Blocked storm drain flooding the lane",
  STREETLIGHT: "Four lights out along the service road",
  OTHER: "Loose paving slab outside the chemist",
};

function Swatch({
  name,
  className,
  note,
}: {
  name: string;
  className: string;
  note: string;
}) {
  return (
    <div className="space-y-2">
      <div className={`h-16 rounded-md border border-rule ${className}`} />
      <div>
        <p className="docket text-ink">{name}</p>
        <p className="mt-0.5 text-sm text-ink-muted">{note}</p>
      </div>
    </div>
  );
}

export default function StyleguidePage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-16 lg:px-10">
      <header className="mb-16">
        <p className="docket">JAN-AI · Design system · Phase 2</p>
        <h1 className="display-wide mt-4 text-display text-ink">
          Style guide
        </h1>
        <p className="mt-4 max-w-xl text-lg text-ink-muted">
          Every token, state and primitive in one place. Editorial and
          civic-infrastructure in register: warm paper, near-black ink, hairline
          rules, and exactly one saturated colour.
        </p>
      </header>

      {/* ---- COLOUR ---- */}
      <section className="mb-16 space-y-6">
        <RuleHeading count="9 core">Core palette</RuleHeading>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <Swatch name="paper" className="bg-paper" note="Warm off-white. Never #FFF — pure white is a light source, not a page." />
          <Swatch name="paper-sunk" className="bg-paper-sunk" note="Secondary surface. One step down, no shadow." />
          <Swatch name="ink" className="bg-ink" note="Near-black, warm cast. 17.2:1 on paper." />
          <Swatch name="ink-muted" className="bg-ink-muted" note="Secondary text. 6.1:1 — clears AA for body copy." />
          <Swatch name="rule" className="bg-rule" note="Dividers only. 1.3:1, which is correct for decoration." />
          <Swatch name="rule-strong" className="bg-rule-strong" note="Form field borders. 3.2:1 — a border that identifies a control needs it." />
          <Swatch name="signal" className="bg-signal" note="Safety orange. 3.3:1 — large text, borders and icons only." />
          <Swatch name="signal-ink" className="bg-signal-ink" note="Small text in the accent colour. 8.4:1 on paper." />
          <Swatch name="signal-wash" className="bg-signal-wash" note="Hover and active states." />
        </div>

        <div className="border-t border-rule pt-6">
          <p className="max-w-2xl text-ink-muted">
            Those ratios are <strong className="text-ink">measured in the
            browser</strong>, not estimated. Two of them changed the design.
            Safety orange is <strong className="text-ink">3.3:1</strong> on
            paper — enough for a border or a heading, not enough for body text —
            so small accent text uses <code className="text-ink">signal-ink</code>{" "}
            instead, and the primary button puts near-black{" "}
            <em>on</em> orange at <strong className="text-ink">5.2:1</strong>{" "}
            rather than white on orange, which would have failed at 3.6:1. That
            is also how real road signage is set, so the accessible answer and
            the authentic one turned out to be the same answer.
          </p>
        </div>
      </section>

      {/* ---- CATEGORY COLOURS ---- */}
      <section className="mb-16 space-y-6">
        <RuleHeading count="5">Category colours</RuleHeading>
        <p className="max-w-2xl text-ink-muted">
          Derived from the <strong className="text-ink">APWA Uniform Color
          Code</strong> — the spray-paint standard crews use to mark buried
          utilities on a road before digging. Drainage takes the sewer green,
          streetlight the electric red, other the proposed-excavation white.
          Potholes and garbage are surface problems with no code equivalent, so
          those two are drawn from adjacent civic signage. Three of five are
          real; two are extrapolated.
        </p>
        <div className="grid gap-6 sm:grid-cols-3 lg:grid-cols-5">
          {CATEGORIES.map((category) => (
            <div key={category} className="space-y-2">
              <div
                className={`h-16 rounded-md border border-rule ${SWATCH_BG[category]}`}
              />
              <CategoryLabel category={category} />
            </div>
          ))}
        </div>

        {/* Shown in situ, because a colour chip proves nothing about whether
            five categories are actually separable at the size they appear. This
            is the list row from Phase 4 — a 4px tick on the leading edge is the
            real test, and it is where the first version of this palette failed. */}
        <div className="border-t border-rule">
          {CATEGORIES.map((category) => (
            <div
              key={category}
              className="flex items-stretch gap-4 border-b border-rule py-3"
            >
              <CategoryTick category={category} />
              <div className="min-w-0">
                <p className="display-wide text-h3 text-ink">
                  {SAMPLE_TITLE[category]}
                </p>
                <p className="docket mt-1">
                  JAN·{category.slice(0, 3)}·—— · 23.0225 N 72.5714 E ·{" "}
                  {CATEGORY_LABEL[category]}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ---- SEVERITY ---- */}
      <section className="mb-16 space-y-6">
        <RuleHeading count="4 states">Severity</RuleHeading>
        <p className="max-w-2xl text-ink-muted">
          Encoded three ways at once — a tint, a written label, and a filled
          segment count. Colour is never the only carrier, so this survives
          greyscale, colour blindness and a phone screen in sunlight.{" "}
          <strong className="text-ink">Not assessed</strong> is a first-class
          state, not an empty cell: a report with no severity is a complete
          report, because the AI is an enhancement and never a dependency.
        </p>
        <div className="flex flex-wrap items-center gap-4">
          {SEVERITIES.map((severity) => (
            <SeverityGauge key={severity ?? "null"} severity={severity} />
          ))}
        </div>
      </section>

      {/* ---- THE DOCKET LINE ---- */}
      <section className="mb-16 space-y-6">
        <RuleHeading>The docket line</RuleHeading>
        <p className="max-w-2xl text-ink-muted">
          The signature element. Every report carries a typeset reference the
          way a municipal complaint carries a case number, and it renders
          identically in the list, on the detail page and in the map popup — so
          a report has one stable printed identity everywhere it appears. Every
          segment is real data, which is what makes it structure rather than
          ornament.
        </p>
        <div className="border-t border-rule pt-3">
          <DocketLine report={SAMPLE} />
          <h3 className="display-wide mt-2 text-h2 text-ink">{SAMPLE.title}</h3>
        </div>
      </section>

      {/* ---- TYPE ---- */}
      <section className="mb-16 space-y-6">
        <RuleHeading count="2 families">Typography</RuleHeading>
        <p className="max-w-2xl text-ink-muted">
          <strong className="text-ink">Archivo</strong> for display, used wide
          via the font&apos;s real width axis — institutional signage rather
          than literary serif.{" "}
          <strong className="text-ink">Public Sans</strong> for everything else:
          the typeface of the US Web Design System, drawn for government
          services.
        </p>
        <div className="space-y-6 border-t border-rule pt-6">
          <div>
            <p className="docket mb-2">display · 58 / 0.95</p>
            <p className="display-wide text-display text-ink">Open reports</p>
          </div>
          <div>
            <p className="docket mb-2">h1 · 38 / 1.05</p>
            <p className="display-wide text-h1 text-ink">Blocked storm drain</p>
          </div>
          <div>
            <p className="docket mb-2">h2 · 25 / 1.15</p>
            <p className="display-wide text-h2 text-ink">Recently filed</p>
          </div>
          <div>
            <p className="docket mb-2">body · 16 / 1.6</p>
            <p className="max-w-2xl text-ink">
              A blocked storm drain on the residential lane floods the road
              whenever it rains heavily. Residents report standing water for
              two days after moderate rainfall.
            </p>
          </div>
          <div>
            <p className="docket mb-2">
              tabular figures · tnum
            </p>
            <p className="tnum text-ink">
              23.0225 N 72.5714 E · 1,204 filed · 96 this month · page 3 of 11
            </p>
            <p className="mt-1 text-ink">
              23.0225 N 72.5714 E · 1,204 filed · 96 this month · page 3 of 11
            </p>
            <p className="mt-1 text-sm text-ink-muted">
              Tabular above, proportional below. Every digit occupies the same
              width in the first, so columns align and a changing counter does
              not shimmy.
            </p>
          </div>
        </div>
      </section>

      {/* ---- PRIMITIVES ---- */}
      <section className="mb-16 space-y-6">
        <RuleHeading>Primitives</RuleHeading>
        <p className="max-w-2xl text-ink-muted">
          shadcn/ui components, restyled entirely through the tokens — not one
          of these files was edited. The primary button puts near-black on
          safety orange, which is both the accessible pairing and the way real
          road signage is set; white on orange would fail contrast.
        </p>

        <div className="space-y-8 border-t border-rule pt-6">
          <div className="flex flex-wrap items-center gap-3">
            <Button>File a report</Button>
            <Button variant="secondary">Cancel</Button>
            <Button variant="outline">Filter</Button>
            <Button variant="ghost">Clear</Button>
            <Button variant="destructive">Delete report</Button>
            <Button disabled>Submitting…</Button>
          </div>

          <div className="grid max-w-md gap-1.5">
            <Label htmlFor="sg-title">Report title</Label>
            <Input id="sg-title" placeholder="Blocked storm drain on Ring Road" />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {STATUSES.map((status) => (
              <Badge key={status} variant="outline">
                {STATUS_LABEL[status]}
              </Badge>
            ))}
            {splitTags(SAMPLE.aiTags).map((tag) => (
              <Badge key={tag} variant="secondary" className="rounded-full">
                {tag}
              </Badge>
            ))}
          </div>
          <p className="text-sm text-ink-muted">
            Those tags come from{" "}
            <code className="text-ink">splitTags(aiTags)</code> — the field is a
            comma-separated string, not an array.
          </p>

          <div className="max-w-md space-y-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        </div>
      </section>

      {/* ---- MOTION ---- */}
      <section className="mb-16 space-y-6">
        <RuleHeading count="300ms max">Motion</RuleHeading>
        <p className="max-w-2xl text-ink-muted">
          One curve —{" "}
          <code className="text-ink">cubic-bezier(0.16, 1, 0.3, 1)</code> — and
          three durations. Only <code className="text-ink">opacity</code> and{" "}
          <code className="text-ink">transform</code> are ever animated, because
          those are the only two properties the browser can handle on the
          compositor without recalculating the page layout on every frame.
          Nothing loops, and nothing overshoots.
        </p>
        <p className="max-w-2xl text-ink-muted">
          <strong className="text-ink">Reduced motion is honoured
          globally</strong>, in one place — a{" "}
          <code className="text-ink">MotionConfig</code> in the root layout — so
          a component has to opt out deliberately rather than remember to opt
          in. Turn on &ldquo;reduce motion&rdquo; in your OS and replay this:
          the rows cross-fade instead of travelling.
        </p>
        <div className="border-t border-rule pt-6">
          <MotionDemo />
        </div>
      </section>

    </main>
  );
}
