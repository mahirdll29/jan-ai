"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { useAuth } from "@/components/auth/auth-provider";
import { ApiError, reports as reportsApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import type { Report } from "@/lib/types";

// Edit and delete, shown only to the report's author.
//
// ---- THIS IS A UI DECISION, NOT AN ACCESS CONTROL -------------------------
//
// Hiding the buttons stops an honest user clicking something that would fail.
// It stops nothing else — anyone can call PATCH or DELETE directly.
//
// The real check is the backend's ownership ladder: 401 with no token, 404 for
// a report that does not exist, 403 for one that is not yours. That runs on
// every write regardless of what this component renders. The 403 path is
// handled below precisely because it is reachable even when the button is
// hidden — a report can change hands in another tab, or a session can expire.

export function OwnerActions({ report }: { report: Report }) {
  const { state, clearSession } = useAuth();
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // `user.id`, not a top-level `userId` — the API deliberately returns one
  // representation of the author rather than two that can disagree.
  const isOwner =
    state.status === "authenticated" && state.user.id === report.user.id;

  if (!isOwner) return null;

  async function handleDelete() {
    setDeleting(true);
    setError(null);

    try {
      // Returns 204 with a zero-byte body. lib/api.ts returns before parsing —
      // calling res.json() on an empty body would throw.
      await reportsApi.remove(report.id);
      router.push("/reports/mine");
      // Server components cache their fetch for this navigation; refresh tells
      // Next to re-render them so the deleted row is actually gone.
      router.refresh();
    } catch (err) {
      setDeleting(false);

      if (err instanceof ApiError) {
        if (err.status === 401) {
          // The session expired while the page was open. The guard has no idea
          // — its state still says "authenticated" — so the API telling us is
          // the only signal, and this is what clearSession exists for.
          clearSession();
          setError("Your session expired. Sign in again to delete this.");
          return;
        }
        if (err.status === 404) {
          // Already deleted, probably in another tab. The user's goal is met.
          router.push("/reports/mine");
          return;
        }
        setError(err.message);
        return;
      }
      setError("Couldn't reach the server. Try again.");
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3 border-t border-rule pt-4">
      <Button asChild variant="outline">
        <Link href={`/reports/${report.id}/edit`}>Edit</Link>
      </Button>

      {confirming ? (
        <>
          {/* Inline confirmation rather than a modal. A modal would need focus
              trapping, focus restoration, an escape handler and scroll locking
              — real obligations, for one yes/no question. Two buttons in place
              answer it with none of that. */}
          <span className="text-sm text-ink">Delete this report permanently?</span>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? "Deleting…" : "Yes, delete"}
          </Button>
          <Button
            variant="ghost"
            onClick={() => setConfirming(false)}
            disabled={deleting}
          >
            Keep it
          </Button>
        </>
      ) : (
        <Button variant="ghost" onClick={() => setConfirming(true)}>
          Delete
        </Button>
      )}

      {error && (
        <p role="alert" className="w-full text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
