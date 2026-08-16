"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/components/auth/auth-provider";
import { RequireAuth } from "@/components/auth/require-auth";
import { ReportForm, type ReportFormSubmit } from "@/components/reports/report-form";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, reports as reportsApi } from "@/lib/api";
import type { Report } from "@/lib/types";

// PROTECTED + OWNER.
//
// A client component, because it needs the session to decide whether the
// current user may edit. The ownership check here is UX — the backend's
// 401 → 404 → 403 ladder runs on the PATCH regardless, and every rung is
// handled below.

function EditReport({ id }: { id: string }) {
  const router = useRouter();
  const { state, clearSession } = useAuth();

  const [report, setReport] = useState<Report | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;

    reportsApi
      .get(id)
      .then(({ report }) => {
        if (!ignore) setReport(report);
      })
      .catch((error) => {
        if (ignore) return;
        setLoadError(
          error instanceof ApiError && error.status === 404
            ? "That report doesn't exist."
            : "Couldn't load the report."
        );
      });

    return () => {
      ignore = true;
    };
  }, [id]);

  if (loadError) {
    return <p className="text-ink-muted">{loadError}</p>;
  }

  if (!report || state.status !== "authenticated") {
    return (
      <div className="max-w-2xl space-y-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    );
  }

  if (report.user.id !== state.user.id) {
    return (
      <div className="max-w-prose space-y-3">
        <h1 className="display-wide text-h2 text-ink">Not your report</h1>
        <p className="text-ink-muted">
          You can only edit reports you filed. This one belongs to{" "}
          {report.user.name}.
        </p>
      </div>
    );
  }

  async function handleSubmit(values: ReportFormSubmit) {
    // ---- SEND ONLY WHAT ACTUALLY CHANGED -------------------------------
    //
    // PATCH means "apply these changes", not "replace the resource" — so the
    // body carries the differences and nothing else. Two reasons this matters
    // beyond tidiness:
    //
    //   1. An unchanged field re-sent is a field that can be clobbered by a
    //      stale value if someone edited the report in another tab.
    //   2. The backend rejects an EMPTY patch with a 400, deliberately, rather
    //      than performing a write that only bumps updatedAt. So "changed
    //      nothing" has to be caught here.
    const current = report as Report;
    const changes: Parameters<typeof reportsApi.update>[1] = {};

    if (values.title !== current.title) changes.title = values.title;
    if (values.description !== current.description) changes.description = values.description;
    if (values.category !== current.category) changes.category = values.category;
    if (values.latitude !== current.latitude) changes.latitude = values.latitude;
    if (values.longitude !== current.longitude) changes.longitude = values.longitude;
    // null is meaningful here — it CLEARS the image. `undefined` would mean
    // "leave it alone", so the two cannot be collapsed.
    if (values.imageUrl !== current.imageUrl) changes.imageUrl = values.imageUrl;

    if (Object.keys(changes).length === 0) {
      throw new Error("Nothing has changed yet.");
    }

    try {
      await reportsApi.update(current.id, changes);
      router.push(`/reports/${current.id}`);
      router.refresh();
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.status === 401) {
          // Session expired with the form open. The guard still believes we are
          // authenticated, so the API response is the only signal.
          clearSession();
          throw new Error("Your session expired. Sign in again to save this.");
        }
        if (error.status === 403) {
          // Reachable even though the ownership check above passed — the
          // session could have changed in another tab. The backend is the
          // authority and this is what it saying "no" looks like.
          throw new Error("You can only edit your own reports.");
        }
        if (error.status === 404) {
          throw new Error("That report has been deleted.");
        }
        throw new Error(error.message);
      }
      throw new Error("Couldn't reach the server. Try again.");
    }
  }

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <p className="docket">Editing</p>
        <h1 className="display-wide text-h1 text-ink">{report.title}</h1>
        <p className="max-w-prose text-ink-muted">
          The existing AI assessment stays as it is — editing the text does not
          re-run it.
        </p>
      </header>

      <ReportForm
        initial={{
          title: report.title,
          description: report.description,
          category: report.category,
          latitude: String(report.latitude),
          longitude: String(report.longitude),
          imageUrl: report.imageUrl,
        }}
        submitLabel="Save changes"
        pendingLabel="Saving…"
        onSubmit={handleSubmit}
        onCancel={() => router.push(`/reports/${report.id}`)}
      />
    </div>
  );
}

export default function EditReportPage(props: PageProps<"/reports/[id]/edit">) {
  // `use()` unwraps the params promise inside a CLIENT component — the client
  // equivalent of awaiting it in a server component. Both are required in
  // Next 16; synchronous access was removed.
  const { id } = use(props.params);

  return (
    <RequireAuth>
      <EditReport id={id} />
    </RequireAuth>
  );
}
