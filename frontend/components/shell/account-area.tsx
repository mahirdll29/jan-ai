"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { useAuth } from "@/components/auth/auth-provider";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// Identity and sign-out, in the rail.
//
// ---- WHY `loading` GETS ITS OWN BRANCH -------------------------------------
//
// It would be shorter to treat "not authenticated yet" and "not signed in" as
// the same thing and render the Sign in link for both. That produces a visible
// flicker on EVERY page load for every signed-in user: "Sign in" paints first,
// then swaps to their name a moment later when /me resolves.
//
// It reads as a bug because it is one — the interface asserted something false
// and then corrected itself. A skeleton says "not known yet", which is the
// truth, and settles into whichever answer arrives.
//
// This is why AuthState is three states rather than a nullable user. Same
// lesson as the backend's aiStatus column: the absence of data is not a status.

export function AccountArea({ className }: { className?: string }) {
  const { state, signOut } = useAuth();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    await signOut();
    // Home, not the current page — the current page may be one they can no
    // longer see, which would immediately bounce them to /login and make
    // signing out look like an error.
    router.push("/");
  }

  if (state.status === "loading") {
    return (
      <div className={cn("space-y-2", className)} aria-hidden="true">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-3 w-16" />
      </div>
    );
  }

  // ---- TAP TARGET SIZE, AND WHY THESE CARRY PADDING --------------------
  //
  // The docket type is 12px, which renders a link about 17px tall. WCAG 2.2
  // (2.5.8 Target Size Minimum) wants 24x24 CSS pixels for anything you tap.
  //
  // These are standalone controls in the chrome, NOT links inside a sentence,
  // so the specification's "inline" exception does not apply to them — they
  // have to meet the size. `py-1.5` takes them to roughly 29px without changing
  // how they look, because the padding is invisible.
  //
  // A missed tap on a phone is not a rounding error: this is a tool for
  // reporting a hazard while standing next to it, one-handed, probably in a
  // hurry. Measured at 320/393/412px rather than assumed.
  if (state.status === "anonymous") {
    return (
      <div className={cn("flex items-center gap-3", className)}>
        <Link
          href="/login"
          className="docket py-1.5 text-ink transition-colors hover:text-signal-ink"
        >
          Sign in
        </Link>
        <span aria-hidden="true" className="text-rule">
          ·
        </span>
        <Link
          href="/register"
          className="docket py-1.5 text-ink transition-colors hover:text-signal-ink"
        >
          Register
        </Link>
      </div>
    );
  }

  return (
    <div className={cn("min-w-0", className)}>
      <Link
        href="/profile"
        className="block truncate py-0.5 text-ink transition-colors hover:text-signal-ink"
      >
        {state.user.name}
      </Link>
      <button
        type="button"
        onClick={handleSignOut}
        disabled={signingOut}
        className="docket py-1.5 transition-colors hover:text-signal-ink disabled:opacity-60"
      >
        {signingOut ? "Signing out…" : "Sign out"}
      </button>
    </div>
  );
}
