"use client";

import dynamic from "next/dynamic";
import type { MapReport } from "./map-view";

// ===========================================================================
// THIS FILE IS A BOUNDARY, NOT A FEATURE.
//
// It does one thing: hold the `ssr: false` dynamic import. That looks like a
// pointless wrapper until you know why it cannot live in the page.
//
// ---- THE RULE, FROM THE NEXT 16 DOCS VERBATIM -----------------------------
//
//   "`ssr: false` is not allowed with `next/dynamic` in Server Components.
//    Please move it into a Client Component."
//
// `app/(main)/reports/page.tsx` IS a Server Component — it awaits searchParams
// and fetches the report list on the server. So writing
// `dynamic(() => import("./map-view"), { ssr: false })` in the page is a build
// error, not a subtle problem.
//
// Hence two client layers:
//
//   page.tsx        SERVER   fetches, renders <ReportMap reports={…} />
//   report-map.tsx  CLIENT   "use client" makes ssr:false legal   <- this file
//   map-view.tsx    CLIENT   actually imports leaflet
//
// ---- WHY ssr: false IS NEEDED AT ALL --------------------------------------
//
// Leaflet reads `window` and `document` at MODULE SCOPE, so importing it during
// server rendering throws `ReferenceError: window is not defined` before a
// single component runs. `ssr: false` tells Next never to attempt it — the
// chunk is fetched and evaluated only in the browser.
//
// A plain "use client" is NOT enough on its own. Client Components are still
// PRERENDERED on the server by default; "use client" marks where interactivity
// begins, it does not mean "browser only". That distinction is the whole reason
// this file exists, and it is the part people usually get wrong.
// ===========================================================================

const MapView = dynamic(() => import("./map-view"), {
  ssr: false,
  // Shown while the map chunk downloads. Sized identically to the real map so
  // the page does not jump when it arrives — the layout shift would otherwise
  // land right where someone is trying to read the first list row.
  loading: () => (
    <div
      className="flex h-full w-full items-center justify-center bg-paper-sunk"
      aria-hidden="true"
    >
      <span className="docket">Loading map…</span>
    </div>
  ),
});

export function ReportMap({ reports }: { reports: MapReport[] }) {
  return (
    // The height lives here, on the wrapper. A Leaflet container inherits its
    // size from its parent, and a parent with no height gives a 0px map — which
    // renders as nothing at all and looks like a failed integration.
    //
    // Fixed rather than collapsible on purpose: a container whose size changes
    // after Leaflet has measured it needs `map.invalidateSize()`, or it paints
    // grey where tiles should be. Not worth the bug surface for a v1 toggle.
    <section aria-label="Map of reports" className="space-y-2">
      <div className="h-56 overflow-hidden rounded-md border border-rule sm:h-80 lg:h-96">
        <MapView reports={reports} />
      </div>
      <p className="docket">
        Pins are coloured by category · faded pins are resolved
      </p>
    </section>
  );
}
