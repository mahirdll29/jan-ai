"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { useAuth } from "@/components/auth/auth-provider";
import { RequireAuth } from "@/components/auth/require-auth";
import { RuleHeading } from "@/components/design/rule-heading";
import { Button } from "@/components/ui/button";
import { formatDateLong } from "@/lib/format";

// The account page.
//
// A client component because everything on it comes from the session, which
// lives in the browser. There is nothing to fetch — /api/auth/me already ran
// once in AuthProvider, and calling it again here would be a second round trip
// for data we are holding.

function ProfileDetails() {
  const { state, signOut } = useAuth();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  // RequireAuth guarantees this, but TypeScript cannot know that across a
  // component boundary. An early return is cheaper than a non-null assertion
  // and stays correct if the guard is ever removed.
  if (state.status !== "authenticated") return null;

  const { user } = state;

  async function handleSignOut() {
    setSigningOut(true);
    await signOut();
    router.push("/");
  }

  return (
    <div className="max-w-2xl space-y-10">
      <div>
        <p className="docket">Account</p>
        <h1 className="display-wide mt-3 text-h1 text-ink">{user.name}</h1>
      </div>

      <section className="space-y-4">
        <RuleHeading as="h2">Details</RuleHeading>

        {/* A description list, because that is literally what this is: a set of
            term/value pairs. Screen readers announce the pairing, which a stack
            of divs would not. */}
        <dl className="divide-y divide-rule border-b border-rule">
          <div className="grid grid-cols-[8rem_1fr] gap-4 py-3">
            <dt className="docket">Name</dt>
            <dd className="text-ink">{user.name}</dd>
          </div>
          <div className="grid grid-cols-[8rem_1fr] gap-4 py-3">
            <dt className="docket">Email</dt>
            <dd className="break-all text-ink">{user.email}</dd>
          </div>
          <div className="grid grid-cols-[8rem_1fr] gap-4 py-3">
            <dt className="docket">Joined</dt>
            <dd className="tnum text-ink">{formatDateLong(user.createdAt)}</dd>
          </div>
        </dl>

        <p className="text-sm text-ink-muted">
          Editing your details is not built — the backend has no endpoint for it,
          and inventing one here would only produce a form that fails.
        </p>
      </section>

      <section className="space-y-4">
        <RuleHeading as="h2">Session</RuleHeading>
        <p className="max-w-prose text-ink-muted">
          Signing in sets a cookie that lasts seven days. It is marked httpOnly,
          so no JavaScript on this page — ours or anyone else&apos;s — can read
          it.
        </p>
        <Button
          variant="outline"
          onClick={handleSignOut}
          disabled={signingOut}
        >
          {signingOut ? "Signing out…" : "Sign out"}
        </Button>
      </section>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <RequireAuth>
      <ProfileDetails />
    </RequireAuth>
  );
}
