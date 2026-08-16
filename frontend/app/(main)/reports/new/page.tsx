"use client";

import { useRouter } from "next/navigation";

import { RequireAuth } from "@/components/auth/require-auth";
import { ReportForm, type ReportFormSubmit } from "@/components/reports/report-form";
import { ApiError, reports as reportsApi } from "@/lib/api";

// PROTECTED — filing needs an account, because a report needs an author. The
// backend takes userId from the verified token and never from the body, so this
// page is a convenience: POST /api/reports 401s without a cookie regardless.

function NewReport() {
  const router = useRouter();

  async function handleSubmit(values: ReportFormSubmit) {
    try {
      const { report } = await reportsApi.create({
        title: values.title,
        description: values.description,
        category: values.category,
        latitude: values.latitude,
        longitude: values.longitude,
        // The API accepts imageUrl as optional; omit rather than send null on
        // create, so the request carries only fields the user actually set.
        ...(values.imageUrl ? { imageUrl: values.imageUrl } : {}),
      });

      // ---- STRAIGHT TO THE DETAIL PAGE, WHICH IS WHERE THE AI LANDS -------
      //
      // The 201 comes back with aiStatus: "PENDING" — the backend fires the
      // Groq call WITHOUT awaiting it, so the report is saved and returned
      // immediately while the model is still thinking.
      //
      // The detail page's AI panel sees PENDING and starts polling, so the
      // enhancement appears a second or two later without the user waiting on
      // this form. Nothing here needs to know about any of that.
      router.push(`/reports/${report.id}`);
      // Server components cache their fetches for a navigation; refresh makes
      // the list pick up the new report if the user goes back to it.
      router.refresh();
    } catch (error) {
      // Rethrown as a plain Error so the form renders the message. The
      // interesting case is 401 — a session that expired while the form was
      // open, which the guard cannot detect on its own.
      if (error instanceof ApiError) {
        throw new Error(
          error.status === 401
            ? "Your session expired. Sign in again — your text is still here."
            : error.message
        );
      }
      throw new Error("Couldn't reach the server. Try again.");
    }
  }

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <p className="docket">New entry</p>
        <h1 className="display-wide text-h1 text-ink">File a report</h1>
        <p className="max-w-prose text-ink-muted">
          Describe what is wrong and where. An AI summary and severity are added
          afterwards — the report is filed either way.
        </p>
      </header>

      <ReportForm
        submitLabel="File report"
        pendingLabel="Filing…"
        onSubmit={handleSubmit}
        onCancel={() => router.back()}
      />
    </div>
  );
}

export default function NewReportPage() {
  return (
    <RequireAuth>
      <NewReport />
    </RequireAuth>
  );
}
