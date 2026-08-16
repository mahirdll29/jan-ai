"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "./auth-provider";
import { Skeleton } from "@/components/ui/skeleton";

// ===========================================================================
// THIS IS NOT SECURITY. READ THIS BEFORE RELYING ON IT.
//
// Everything below runs in the user's browser, on code we shipped to them. It
// can be stepped over in devtools, disabled by turning off JavaScript, or
// simply ignored by anyone calling the API directly with curl. Treating a
// client-side check as an access control is one of the most common and most
// serious mistakes in a frontend codebase.
//
// WHAT ACTUALLY PROTECTS THE DATA is the Express backend: requireAuth verifies
// the JWT signature on every protected route and returns 401 without it, and
// the ownership ladder returns 403 for somebody else's report. None of that can
// be bypassed from a browser, because none of it runs in one.
//
// WHAT THIS COMPONENT IS FOR is the honest user who is simply signed out. It
// spares them a page that renders, fires a request, 401s, and shows an empty
// error — and it remembers where they were going so they land back there. That
// is a UX convenience, and calling it anything grander is how the real check
// ends up never being written.
//
// The brief originally specified Next middleware for this. The reasoning is
// unchanged; only the location moved (see auth-provider.tsx for why middleware
// cannot work across two domains). If anything, doing it here makes the lesson
// harder to forget: nobody mistakes a component for a security boundary.
//
// COROLLARY, AND IT IS NOT OPTIONAL: every protected page must STILL handle a
// 401 from the API. The token can expire while a tab sits open, in which case
// this component happily renders — its state says "authenticated" — and the
// data request fails. Pages catch that and call clearSession().
// ===========================================================================

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { state } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (state.status !== "anonymous") return;

    // Record where they were going so login can return them to it.
    // encodeURIComponent because a path can legitimately contain characters
    // that would otherwise end the query parameter early.
    const next = encodeURIComponent(pathname);

    // `replace`, not `push`. With push, the back button returns to the page
    // they were bounced off, which bounces them again — a loop the user
    // experiences as a broken back button.
    router.replace(`/login?next=${next}`);
  }, [state.status, pathname, router]);

  if (state.status === "loading") {
    return (
      <div className="space-y-4" aria-busy="true" aria-live="polite">
        <span className="sr-only">Checking your sign-in status…</span>
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-full max-w-md" />
        <Skeleton className="h-4 w-full max-w-sm" />
      </div>
    );
  }

  if (state.status === "anonymous") {
    // The redirect above is already in flight. Rendering nothing avoids showing
    // protected chrome for the frame before it lands.
    return null;
  }

  return <>{children}</>;
}
