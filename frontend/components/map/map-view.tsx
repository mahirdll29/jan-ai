"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import L from "leaflet";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";

// The Leaflet stylesheet. Imported HERE rather than in globals.css so it is
// bundled with this chunk — which only loads in the browser, only when the map
// does. Without it Leaflet renders a pile of unpositioned tiles rather than a
// map, because Leaflet positions everything with CSS transforms it defines here.
import "leaflet/dist/leaflet.css";

import { CATEGORY_LABEL, STATUS_LABEL } from "@/lib/format";
import type { Report } from "@/lib/types";

// ===========================================================================
// THE MAP
//
// This file is NEVER evaluated on the server. It is reached only through
// components/map/report-map.tsx, which imports it with `ssr: false`.
//
// ---- WHY LEAFLET CANNOT BE SERVER-RENDERED --------------------------------
//
// Leaflet touches `window` and `document` AT MODULE SCOPE — as it loads it
// feature-detects the browser (touch support, pointer events, 3d transforms)
// and builds DOM nodes. So merely `import "leaflet"` on the server throws
// `ReferenceError: window is not defined`, before any component renders.
//
// This is not a bug to route around. There is no browser to draw a map into on
// the server, so a map library that requires one is behaving correctly. What we
// owe it is an honest boundary, which is what report-map.tsx is.
// ===========================================================================

/**
 * Only the six fields the map actually uses.
 *
 * Narrowed on purpose rather than taking a whole `Report`: the map cannot then
 * quietly grow a dependency on the AI fields, and the type says exactly what
 * this component needs to do its job.
 */
export type MapReport = Pick<
  Report,
  "id" | "title" | "latitude" | "longitude" | "category" | "status"
>;

/** Gujarat, roughly centred, when there are no reports to frame. */
const FALLBACK_CENTER: [number, number] = [22.5, 71.5];
const FALLBACK_ZOOM = 7;

/**
 * How far fitBounds is allowed to zoom in.
 *
 * This exists for the single-report case. One coordinate produces a bounds with
 * zero area, and Leaflet will happily zoom to its maximum to "fit" it — leaving
 * the user staring at one rooftop with no idea where in the city they are.
 */
const FIT_MAX_ZOOM = 15;

// Written out rather than interpolated, so the mapping is explicit and a sixth
// category would be a TypeScript error rather than an undefined colour.
const CATEGORY_VAR: Record<Report["category"], string> = {
  POTHOLE: "--cat-pothole",
  GARBAGE: "--cat-garbage",
  DRAINAGE: "--cat-drainage",
  STREETLIGHT: "--cat-streetlight",
  OTHER: "--cat-other",
};

/**
 * Status is encoded as OPACITY, not as a second colour.
 *
 * Colour already means "category" everywhere else in this app — the tick on
 * every list row, the dot on the detail page, the Phase 6 charts. Giving pins a
 * status-based colour would put two meanings on one channel a few pixels apart
 * from each other on the same page.
 *
 * Opacity is a free channel, it reads correctly (a resolved issue should recede),
 * and the status is written out in the popup, so nothing depends on noticing a
 * subtle difference in fade.
 */
const STATUS_OPACITY: Record<Report["status"], number> = {
  OPEN: 1,
  IN_PROGRESS: 0.7,
  RESOLVED: 0.4,
};

/**
 * Escapes text before it goes into a raw HTML string.
 *
 * ---- WHY THIS IS NECESSARY, AND WHY IT IS EASY TO MISS --------------------
 *
 * `L.divIcon({ html })` takes a STRING and injects it as innerHTML. That is an
 * XSS sink, and the value we need to put through it is a REPORT TITLE — typed
 * by any member of the public who can register an account.
 *
 * Everywhere else in this app, titles are rendered as React children, and React
 * escapes those automatically. That habit is exactly what makes this dangerous:
 * the one place the framework is not protecting us looks identical to the
 * places it is.
 *
 * A title of `"><img src=x onerror=alert(1)>` would otherwise execute for every
 * visitor who loads the map.
 *
 * Note the backend cannot save us here — it correctly stores the title verbatim,
 * because escaping belongs at the point of OUTPUT, and the same title is also
 * rendered as plain text, in a page <title>, and in JSON.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Builds the marker.
 *
 * ---- WHY THERE IS NO "FIX THE BROKEN MARKER ICONS" CODE HERE --------------
 *
 * Nearly every Leaflet-with-a-bundler guide includes something like:
 *
 *     delete L.Icon.Default.prototype._getIconUrl;
 *     L.Icon.Default.mergeOptions({ iconUrl, iconRetinaUrl, shadowUrl });
 *
 * That fixes a real problem: Leaflet's DEFAULT marker is a PNG whose URL is
 * resolved relative to leaflet.css. Every bundler hashes and relocates assets,
 * so those paths 404 and markers render as broken images — or as nothing at all,
 * which is worse, because the map looks empty rather than broken.
 *
 * We never hit it, because we never use the default icon. `L.divIcon` builds a
 * marker out of an HTML string instead of an image file, so there is no asset
 * path for a bundler to invalidate. We needed custom pins anyway; getting the
 * icon bug designed out of existence is the same decision.
 *
 * `className: ""` matters — Leaflet's default divIcon class paints a white box
 * with a border behind the content, which would frame every pin in a little card.
 */
function pinIcon(report: MapReport) {
  const colour = `var(${CATEGORY_VAR[report.category]})`;
  const opacity = STATUS_OPACITY[report.status];

  // currentColor lets the CSS custom property on the wrapper flow into the SVG,
  // so the pin uses the very same token as the list row's category tick.
  const svg = `
    <svg viewBox="0 0 24 32" width="24" height="32" aria-hidden="true" focusable="false">
      <path d="M12 0C5.373 0 0 5.373 0 12c0 8.5 12 20 12 20s12-11.5 12-20c0-6.627-5.373-12-12-12z"
            fill="currentColor" />
      <circle cx="12" cy="12" r="4.25" fill="#F8F6F3" />
    </svg>`;

  // ---- THE ACCESSIBLE NAME HAS TO LIVE INSIDE THE HTML -------------------
  //
  // Leaflet renders every marker as `<div role="button" tabindex="0">`. A
  // button with no accessible name is a serious WCAG 4.1.2 failure — a screen
  // reader announces twenty anonymous buttons.
  //
  // THE TRAP: Marker's `alt` prop looks like the fix and does nothing here.
  // `alt` is only applied when the icon is an `L.Icon`, which renders an
  // `<img>`. A divIcon renders a `<div>`, and a div has no alt attribute — so
  // the prop is silently ignored. Caught by axe, not by reading the docs.
  //
  // Visually-hidden text inside the icon gives the button its name, because
  // element content contributes to the accessible name. The SVG is aria-hidden
  // so it adds nothing and this is all the reader gets.
  const label = escapeHtml(
    `${report.title} — ${CATEGORY_LABEL[report.category]}, ${STATUS_LABEL[report.status]}`
  );

  return L.divIcon({
    className: "",
    html:
      `<span style="color:${colour};opacity:${opacity};display:block;line-height:0">` +
      svg +
      `<span class="sr-only">${label}</span>` +
      `</span>`,
    iconSize: [24, 32],
    // The POINT of the teardrop is the location, not the middle of the shape.
    // Without this the pin floats half its height north of where it means.
    iconAnchor: [12, 32],
    popupAnchor: [0, -30],
  });
}

/**
 * Frames the map on the current pins.
 *
 * ---- WHY THIS IS A CHILD COMPONENT AND NOT A PROP -------------------------
 *
 * `MapContainer`'s `center` and `zoom` are read ONCE, when the map is created.
 * They are not reactive — changing them later does nothing, silently, which is
 * a genuinely confusing afternoon if you do not know it.
 *
 * Our pins change every time a filter changes, so re-framing has to go through
 * the imperative Leaflet instance. `useMap()` returns it, and it is only
 * available to a component rendered INSIDE MapContainer — hence a child that
 * renders nothing and exists purely for the effect.
 */
function FitToReports({ reports }: { reports: MapReport[] }) {
  const map = useMap();

  // A stable signature of the coordinates. Without it the effect re-runs on
  // every parent render, because `reports` is a fresh array each time — and
  // re-fitting on every render would fight the user trying to pan.
  const signature = reports.map((r) => `${r.latitude},${r.longitude}`).join("|");

  useEffect(() => {
    if (reports.length === 0) {
      map.setView(FALLBACK_CENTER, FALLBACK_ZOOM);
      return;
    }

    const bounds = L.latLngBounds(
      reports.map((r) => [r.latitude, r.longitude] as [number, number])
    );

    map.fitBounds(bounds, {
      // Keeps pins off the very edge, where the popup would open off-screen.
      padding: [40, 40],
      maxZoom: FIT_MAX_ZOOM,
    });
    // `signature` is the real dependency; `reports` would change identity every
    // render even when the coordinates are identical.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, map]);

  return null;
}

export default function MapView({ reports }: { reports: MapReport[] }) {
  // Read once. Safe to touch matchMedia directly because this component only
  // ever runs in the browser — but it is still read into state rather than
  // inline, so the value is stable for the life of the map (which matches
  // Leaflet, whose animation options are also only read at construction).
  const [reduceMotion] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );

  const markers = useMemo(
    () => reports.map((report) => ({ report, icon: pinIcon(report) })),
    [reports]
  );

  return (
    <MapContainer
      center={FALLBACK_CENTER}
      zoom={FALLBACK_ZOOM}
      // Height comes from the wrapper's CSS. A Leaflet container with no
      // explicit height computes to 0px and renders nothing — the single most
      // common "my map is invisible" cause.
      className="h-full w-full"
      // ---- SCROLL WHEEL ZOOM IS OFF, DELIBERATELY --------------------------
      // A map embedded in a scrolling page that swallows the wheel is a trap:
      // you scroll toward the list, the cursor crosses the map, and instead of
      // the page moving the map zooms to street level. Zoom controls and
      // double-click still work, and the page keeps scrolling normally.
      scrollWheelZoom={false}
      // Honours the same preference as the rest of the app's motion. Leaflet
      // reads these at construction, which is why reduceMotion is read once.
      zoomAnimation={!reduceMotion}
      fadeAnimation={!reduceMotion}
      markerZoomAnimation={!reduceMotion}
    >
      <TileLayer
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        // NOT decoration. OpenStreetMap data is ODbL-licensed and attribution
        // is a condition of use — removing this would be a licence violation,
        // not a design tidy-up.
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        maxZoom={19}
      />

      <FitToReports reports={reports} />

      {markers.map(({ report, icon }) => (
        <Marker
          key={report.id}
          position={[report.latitude, report.longitude]}
          icon={icon}
          // NOTE: there is deliberately no `alt` prop. It has no effect on a
          // divIcon — see the note in pinIcon(). The accessible name is baked
          // into the icon's HTML instead.
        >
          <Popup>
            {/* Rendered through a React portal by react-leaflet, so this is
                ordinary React — next/link works and navigates client-side. */}
            <span className="docket block">
              {CATEGORY_LABEL[report.category]} · {STATUS_LABEL[report.status]}
            </span>
            <Link
              href={`/reports/${report.id}`}
              className="display-wide user-text mt-1 block text-h3 text-ink hover:text-signal-ink"
            >
              {report.title}
            </Link>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
