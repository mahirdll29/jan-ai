"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

// The navigation links, shared by the desktop rail and the mobile top bar.
//
// A client component only because it needs `usePathname` to mark the current
// page. That is the whole reason — the links themselves are static.

const LINKS = [
  { href: "/reports", label: "All reports" },
  { href: "/reports/new", label: "File a report" },
  { href: "/reports/mine", label: "My reports" },
  { href: "/dashboard", label: "Dashboard" },
] as const;

/**
 * Is `href` the page we are on?
 *
 * Exact match, not `startsWith`. With startsWith, "/reports" would light up
 * while the user is on "/reports/new" and TWO items would appear current at
 * once — which tells the reader nothing about where they are.
 */
function isCurrent(pathname: string, href: string) {
  return pathname === href;
}

export function RailNav({ orientation }: { orientation: "vertical" | "horizontal" }) {
  const pathname = usePathname();

  return (
    // <nav> is a landmark: screen reader users can jump straight to it, and
    // aria-label distinguishes it from any other nav on the page.
    <nav aria-label="Main">
      <ul
        className={cn(
          orientation === "vertical"
            ? "space-y-1"
            : // Horizontal scroll on a narrow phone rather than wrapping to a
              // second line that pushes the content down. -mx-6/px-6 lets the
              // row bleed to the screen edge so it reads as scrollable.
              "-mx-6 flex gap-5 overflow-x-auto px-6 [scrollbar-width:none]"
        )}
      >
        {LINKS.map(({ href, label }) => {
          const current = isCurrent(pathname, href);

          return (
            <li key={href} className={orientation === "horizontal" ? "shrink-0" : undefined}>
              <Link
                href={href}
                // aria-current="page" is how assistive tech announces "this is
                // the one you are on". The styling below is the visual half of
                // the same statement; neither works alone.
                aria-current={current ? "page" : undefined}
                className={cn(
                  "block py-1 transition-colors",
                  orientation === "vertical" && "-ml-3 border-l-2 pl-3",
                  current
                    ? cn(
                        "text-ink",
                        orientation === "vertical"
                          ? "border-signal"
                          : "underline decoration-signal decoration-2 underline-offset-8"
                      )
                    : cn(
                        "text-ink-muted hover:text-ink",
                        orientation === "vertical" && "border-transparent"
                      )
                )}
              >
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
