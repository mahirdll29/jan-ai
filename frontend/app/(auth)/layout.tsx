import Link from "next/link";
import { StatsPanel } from "@/components/auth/stats-panel";

// The layout for /login and /register.
//
// ---- WHAT THE PARENTHESES IN (auth) MEAN -----------------------------------
//
// A folder wrapped in parentheses is a ROUTE GROUP: it organises files without
// appearing in the URL. So app/(auth)/login/page.tsx serves /login, not
// /auth/login.
//
// It exists here for exactly one reason — these two pages need a DIFFERENT
// layout from the rest of the app. Everything else renders inside the shell
// with its navigation rail; a signed-out visitor has nothing to navigate to, so
// the rail would be an empty frame around a form. A route group is how you give
// a subset of routes their own layout without inventing a URL segment to hang
// it on.
//
// ---- THE SPLIT --------------------------------------------------------------
//
// Asymmetric on purpose: the form is a narrow measure on the left, and the
// right-hand side carries live figures from the public stats endpoint. Not a
// centred card on a gradient — the visual interest is real content.
//
// Below `lg` the panel drops entirely and the form takes the full width. On a
// phone, the thing you came to do should be the only thing on screen.

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[minmax(24rem,2fr)_3fr]">
      {/* ---- LEFT: the form ---- */}
      <div className="flex min-h-dvh flex-col justify-between px-6 py-10 sm:px-10 lg:min-h-0 lg:px-14">
        {/* inline-block so the hit area is the width of the WORDMARK rather
            than the full column — a full-width invisible link at the top of the
            page is a trap for a stray tap. py-1.5 takes the height past the
            24px tap-target minimum; see the note in account-area.tsx. */}
        <Link
          href="/"
          className="docket inline-block self-start py-1.5 text-ink transition-colors hover:text-signal-ink"
        >
          JAN-AI
        </Link>

        {/* max-w-sm holds the form to a comfortable measure. A field stretched
            across a wide screen is harder to scan, not more generous. */}
        <div className="w-full max-w-sm py-14">{children}</div>

        <p className="docket">Civic issue reporting</p>
      </div>

      {/* ---- RIGHT: the live register ----
          Hidden below lg. A 1px rule rather than a background colour change —
          separation in this design is always drawn, never shaded. */}
      <aside className="hidden border-l border-rule px-14 py-10 lg:block">
        <StatsPanel />
      </aside>
    </div>
  );
}
