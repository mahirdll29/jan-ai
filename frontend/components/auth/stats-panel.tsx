import { stats as statsApi } from "@/lib/api";
import { CATEGORY_LABEL } from "@/lib/format";
import type { Category, Stats } from "@/lib/types";

// The right-hand side of the auth pages.
//
// ---- WHY THIS IS REAL DATA AND NOT AN ILLUSTRATION ------------------------
//
// A signed-out page needs something on it, and the default answers — a gradient,
// a stock photo, a floating abstract shape — are decoration: they occupy the
// space without telling anyone anything. This shows the actual contents of the
// register instead. It is the product, demonstrated, before you have an account.
//
// It is only possible because GET /api/stats is PUBLIC, which is itself a
// deliberate backend decision: civic issues are public information, so the
// aggregate view of them is too. A design choice falling out of an
// architectural one is usually a sign both were right.
//
// ---- WHY IT IS A SERVER COMPONENT -----------------------------------------
//
// No session, no interactivity, no browser API — just public data rendered to
// HTML. So it runs on the server, ships zero JavaScript, and the figures are in
// the initial HTML rather than appearing after a client-side round trip. The
// form beside it IS a client component, because it needs state and has to put a
// cookie in the user's browser. One page, both models, each where it belongs.

const BAR_MAX_WIDTH = 100; // percent

// Written out in full — Tailwind scans source as plain text and cannot resolve
// a class name built at runtime. Same rule as everywhere else in this project.
const BAR_COLOUR: Record<Category, string> = {
  POTHOLE: "bg-cat-pothole",
  GARBAGE: "bg-cat-garbage",
  DRAINAGE: "bg-cat-drainage",
  STREETLIGHT: "bg-cat-streetlight",
  OTHER: "bg-cat-other",
};

async function loadStats(): Promise<Stats | null> {
  try {
    // no-store: fetch per request rather than at build time. See the note on
    // stats.get in lib/api.ts.
    return await statsApi.get(30, { cache: "no-store" });
  } catch {
    // ---- THE PANEL IS AN ENHANCEMENT, NEVER A DEPENDENCY ------------------
    //
    // If the backend is unreachable, signing in is exactly the thing a person
    // still needs to be able to attempt. Letting this throw would take down the
    // login form over a decorative sidebar.
    //
    // This is the same reasoning the AI pipeline uses — a failing optional
    // extra must not break the operation the user actually came for — applied
    // to a second thing. Worth noticing that the principle generalises.
    return null;
  }
}

export async function StatsPanel() {
  const data = await loadStats();

  // Renders nothing at all rather than an apologetic empty state. A signed-out
  // visitor has no idea this panel was supposed to be here, and telling them a
  // service they have never heard of is down helps nobody.
  if (!data) return null;

  const last30 = data.trend.reduce((sum, day) => sum + day.count, 0);
  const busiest = Math.max(...data.byCategory.map((row) => row.count), 1);

  return (
    <div className="flex h-full flex-col justify-center gap-10">
      <div>
        <p className="docket">The register</p>

        <dl className="mt-6 space-y-4">
          <div className="flex items-baseline gap-4">
            <dd className="display-wide tnum text-display text-ink">
              {data.totalReports.toLocaleString("en-GB")}
            </dd>
            <dt className="text-ink-muted">
              {data.totalReports === 1 ? "issue filed" : "issues filed"}
            </dt>
          </div>
          <div className="flex items-baseline gap-4">
            <dd className="display-wide tnum text-h2 text-ink">
              {last30.toLocaleString("en-GB")}
            </dd>
            {/* Labelled honestly. The backend's trend window is the last 30
                days, which is NOT the same thing as "this month" — saying so
                would be a small lie in service of a rounder word. */}
            <dt className="text-ink-muted">in the last 30 days</dt>
          </div>
        </dl>
      </div>

      <div className="border-t border-rule pt-6">
        <ul className="space-y-3">
          {data.byCategory.map(({ category, count }) => (
            <li key={category} className="grid grid-cols-[7rem_1fr_3rem] items-center gap-3">
              <span className="docket">{CATEGORY_LABEL[category]}</span>

              {/* aria-hidden: the bar is a visual restatement of the number
                  printed next to it, so announcing it would just be noise. */}
              <span aria-hidden="true" className="h-2 bg-paper-sunk">
                <span
                  className={`block h-full ${BAR_COLOUR[category]}`}
                  style={{ width: `${(count / busiest) * BAR_MAX_WIDTH}%` }}
                />
              </span>

              <span className="docket tnum text-right text-ink">
                {count.toLocaleString("en-GB")}
              </span>
            </li>
          ))}
        </ul>

        <p className="mt-8 max-w-sm text-sm text-ink-muted">
          Live figures, readable by anyone. Civic issues are public information —
          you only need an account to file one.
        </p>
      </div>
    </div>
  );
}
