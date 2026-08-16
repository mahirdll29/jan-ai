import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AiPanel } from "@/components/reports/ai-panel";
import { OwnerActions } from "@/components/reports/owner-actions";
import { CategoryTick } from "@/components/design/category-tick";
import { DocketLine } from "@/components/design/docket-line";
import { ApiError, reports as reportsApi } from "@/lib/api";
import { CATEGORY_LABEL, STATUS_LABEL, formatDateLong } from "@/lib/format";
import { cloudinaryThumb } from "@/lib/cloudinary";
import type { Report } from "@/lib/types";

// PUBLIC, and a server component. Civic issues are public information, so this
// page needs no session and renders fully on the server.
//
// Two client components are nested inside: the AI panel (it polls) and the
// owner actions (they need the session). Everything else is server-rendered.

async function loadReport(id: string): Promise<Report | null> {
  try {
    const { report } = await reportsApi.get(id, { cache: "no-store" });
    return report;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    // Anything else — backend down, network — is rethrown so Next's error
    // boundary handles it. A 404 is a legitimate answer about a resource; a
    // dead backend is not, and pretending the report does not exist would be a
    // lie that sends the user looking for a typo.
    throw error;
  }
}

export async function generateMetadata(
  props: PageProps<"/reports/[id]">
): Promise<Metadata> {
  const { id } = await props.params;

  try {
    const { report } = await reportsApi.get(id, { cache: "no-store" });
    return {
      title: `${report.title} — JAN-AI`,
      // The citizen's own description, never the AI summary. What a person
      // wrote is the trustworthy field; a model's paraphrase should not be what
      // gets shared to other sites.
      description: report.description.slice(0, 160),
    };
  } catch {
    return { title: "Report — JAN-AI" };
  }
}

export default async function ReportDetailPage(props: PageProps<"/reports/[id]">) {
  // params is a promise in Next 16.
  const { id } = await props.params;
  const report = await loadReport(id);

  // Renders the not-found page AND sends a real 404 status — which matters for
  // anything reading the response rather than looking at it.
  if (!report) notFound();

  const image = report.imageUrl;

  return (
    <article className="max-w-3xl space-y-8">
      <Link
        href="/reports"
        className="docket inline-block py-1.5 text-ink transition-colors hover:text-signal-ink"
      >
        ← All reports
      </Link>

      <header className="space-y-4">
        <div className="border-t border-rule pt-3">
          {/* The same docket line as the list row and (in Phase 5) the map
              popup — one stable printed identity wherever the report appears. */}
          <DocketLine report={report} />
        </div>

        {/* user-text: the title is public input and may contain a long
            unbreakable token. At 38px that overflows a phone. */}
        <h1 className="display-wide user-text text-h1 text-ink">{report.title}</h1>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <span className="inline-flex items-center gap-2">
            <CategoryTick category={report.category} className="h-4 w-1" />
            <span className="docket text-ink">
              {CATEGORY_LABEL[report.category]}
            </span>
          </span>
          <span className="docket">{STATUS_LABEL[report.status]}</span>
          <span className="docket tnum">{formatDateLong(report.createdAt)}</span>
          <span className="docket">Filed by {report.user.name}</span>
        </div>
      </header>

      {image && (
        // A larger transform than the list thumbnail, still nowhere near the
        // original: Cloudinary resizes and re-encodes on request and caches the
        // result, so this never ships a 3MB phone photo.
        // eslint-disable-next-line @next/next/no-img-element -- see lib/cloudinary.ts
        <img
          src={cloudinaryThumb(image, 960, 640) ?? image}
          alt=""
          width={960}
          height={640}
          className="w-full rounded-md border border-rule object-cover"
        />
      )}

      <div className="space-y-3">
        {/* The citizen's own words, kept visually distinct from the AI panel
            below. Provenance is a design requirement here, not just a database
            one: a reader must always be able to tell what a person wrote from
            what a model generated. */}
        <p className="user-text whitespace-pre-wrap text-lg text-ink">
          {report.description}
        </p>
      </div>

      <AiPanel report={report} />

      <OwnerActions report={report} />
    </article>
  );
}
