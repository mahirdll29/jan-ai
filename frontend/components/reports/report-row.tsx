import Link from "next/link";

import { CategoryTick } from "@/components/design/category-tick";
import { SeverityGauge } from "@/components/design/severity-gauge";
import { buildDocket } from "@/lib/format";
import { cloudinaryThumb } from "@/lib/cloudinary";
import type { Report } from "@/lib/types";

const THUMB_W = 96;
const THUMB_H = 72;

// One row in the register.
//
// A ROW, NOT A CARD. The design system's argument: a page of cards reads as a
// dashboard product, and a list of ruled rows reads as a document — which is
// what a civic register is. It is also denser, so more of the list is visible
// without scrolling, which matters more than decoration when you are scanning
// for whether your pothole is already reported.

export function ReportRow({ report }: { report: Report }) {
  const thumb = cloudinaryThumb(report.imageUrl, THUMB_W, THUMB_H);

  return (
    <article className="group relative flex items-stretch gap-4 border-b border-rule py-4">
      {/* The tick widens on hover. A transform-only change (scaleX) rather than
          animating width, because width forces the browser to recalculate
          layout on every frame while transform runs on the compositor. */}
      <CategoryTick
        category={report.category}
        className="origin-left transition-transform duration-150 ease-out group-hover:scale-x-[2]"
      />

      <div className="min-w-0 flex-1">
        {/* user-text so a long unbreakable title cannot widen the row. The
            parent already has min-w-0, which is what lets a flex child shrink
            below its content size in the first place. */}
        <h3 className="display-wide user-text text-h3 text-ink">
          {/* The whole row is the link target via `absolute inset-0`, so the
              hit area is the full row rather than just the words — a much
              easier tap on a phone. The <a> stays wrapped around the title so
              its accessible name is the report's title, not "row". */}
          <Link href={`/reports/${report.id}`} className="hover:text-signal-ink">
            <span className="absolute inset-0" aria-hidden="true" />
            {report.title}
          </Link>
        </h3>

        <p className="docket mt-1">{buildDocket(report)}</p>
      </div>

      {thumb && (
        // eslint-disable-next-line @next/next/no-img-element -- see lib/cloudinary.ts:
        // Cloudinary already does the resizing and format negotiation that
        // next/image exists to do. Layering both pays twice.
        <img
          src={thumb}
          alt=""
          // Explicit dimensions reserve the space before the image loads, which
          // is what stops the row jumping (cumulative layout shift).
          width={THUMB_W}
          height={THUMB_H}
          loading="lazy"
          // Decorative: the title and docket already describe the report, and
          // we have no alt text for a user-uploaded photo that would say
          // anything true. An empty alt tells a screen reader to skip it, which
          // is correct — inventing a description would be worse.
          className="hidden shrink-0 rounded-sm border border-rule object-cover sm:block"
        />
      )}

      <div className="flex shrink-0 items-start">
        <SeverityGauge severity={report.severity} />
      </div>
    </article>
  );
}
