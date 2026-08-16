import type { Metadata } from "next";
import { Archivo, Public_Sans } from "next/font/google";

import "./globals.css";
import { MotionProvider } from "@/components/motion-provider";
import { AuthProvider } from "@/components/auth/auth-provider";

// ---------------------------------------------------------------------------
// FONTS
//
// next/font does something worth understanding: it DOWNLOADS these files at
// BUILD time and serves them from our own domain. Nothing is requested from
// Google when a visitor loads the page.
//
// Three things follow from that, and they are the reason to use it:
//   1. No third-party request, so no dependency on Google's uptime, and
//      nothing leaking a visitor's IP to another company on every page view.
//   2. No layout shift. The font file is known at build time, so Next computes
//      a size-adjusted fallback that occupies almost exactly the same space —
//      the text does not reflow when the real font arrives.
//   3. One less DNS lookup and TLS handshake on the critical path.
//
// `variable` puts the font behind a CSS custom property instead of applying it
// directly, which is what lets globals.css map it to a semantic name
// (--font-display / --font-sans) and lets Tailwind generate `font-display` and
// `font-sans` utilities from it.
// ---------------------------------------------------------------------------

// ARCHIVO — the display face, used wide.
//
// `axes: ["wdth"]` is the load-bearing line. Archivo is a variable font with a
// real width axis (62–125), and requesting it here is what makes
// `font-stretch: 110%` do anything. Weight is included automatically; any other
// axis has to be asked for by name.
//
// A NOTE FOR THE INTERVIEW-PREP DOC: the obvious-looking alternative — loading
// a family called "Archivo Expanded" — fails. That family does not exist on
// Google Fonts (the API returns 400). Expanded is an AXIS of Archivo, not a
// separate font. Verified before writing this line rather than after the build
// broke.
const archivo = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-archivo",
  display: "swap",
});

// PUBLIC SANS — the body, UI and data face.
//
// This is the typeface of the US Web Design System, drawn specifically for
// government digital services. For a civic reporting tool the provenance IS the
// argument: it carries the register of a public institution rather than a
// startup, and it was designed for exactly this job — dense forms, tabular
// data, and long text read by people who did not choose to be there.
//
// It is Inter-adjacent in neutrality, which is what the brief asked for, but it
// is not the default reach, which is the point.
const publicSans = Public_Sans({
  subsets: ["latin"],
  variable: "--font-public-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "JAN-AI — Civic issue reporting",
  description:
    "Report potholes, uncollected garbage, blocked drains and broken streetlights. Track every report from open to resolved.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning is on <html> ahead of Phase 7's theme toggle: a
    // theme has to be applied before first paint to avoid a flash, which means
    // a script mutates this element before React hydrates. Without this, React
    // would warn that the server and client markup disagree — which they do,
    // deliberately.
    <html
      lang="en"
      className={`${archivo.variable} ${publicSans.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-dvh bg-paper text-ink">
        {/* The two client-side boundaries in the root layout, and they are
            deliberately thin.

            A CLIENT COMPONENT DOES NOT MAKE ITS CHILDREN CLIENT COMPONENTS.
            `children` here is JSX created by a server component and passed
            through as a prop — it is already rendered on the server, and these
            wrappers just place it. That is why the whole app is not opted out
            of server rendering by two providers at the root.

            What WOULD opt everything out is putting "use client" on this file.
            The distinction is between a client component RECEIVING server-
            rendered children (fine) and a client component IMPORTING them
            (which pulls them into the client bundle).

            MotionProvider needs the browser to read the user's motion
            preference; AuthProvider needs it to hold session state and fetch
            /me. Neither can be a server component, so each is kept small. */}
        <MotionProvider>
          <AuthProvider>{children}</AuthProvider>
        </MotionProvider>
      </body>
    </html>
  );
}
