"use client";

import { AnimatePresence, motion } from "motion/react";

import { ReportRow } from "./report-row";
import { fadeUp, listContainer, DUR, EASE_OUT } from "@/lib/motion";
import type { Report } from "@/lib/types";

// The animated wrapper around the rows.
//
// A client component ONLY because motion needs the browser. Each <ReportRow>
// inside it is still a server component, rendered on the server and passed in
// as children — the same arrangement as the providers in the root layout. The
// rows' markup never enters the client bundle.
//
// ---- WHY layout ANIMATION HERE -------------------------------------------
//
// When a filter changes, some rows leave and the rest move up. Without a layout
// animation they teleport, and it is genuinely hard to tell whether the list
// filtered or simply reloaded with different content. Sliding the survivors
// makes the change legible: you can see that these rows are the same rows.
//
// `layout` on each item plus AnimatePresence for exits is what motion needs to
// do that. Keying by report id is what tells it which rows are "the same" —
// keying by array index would make every row look like it changed.
//
// All of it is suppressed under prefers-reduced-motion by the MotionConfig in
// the root layout. Nothing here opts in per-component.

export function ReportList({ reports }: { reports: Report[] }) {
  return (
    <motion.div
      variants={listContainer}
      initial="hidden"
      animate="visible"
      // Re-runs the staggered entrance whenever the result SET changes, rather
      // than only on first mount. Without a changing key, filtering would swap
      // the content in with no entrance at all.
      key={reports.map((r) => r.id).join(",")}
      className="border-t border-rule"
    >
      <AnimatePresence initial={false}>
        {reports.map((report) => (
          <motion.div
            key={report.id}
            layout
            variants={fadeUp}
            exit={{ opacity: 0, transition: { duration: DUR.micro } }}
            transition={{ duration: DUR.base, ease: EASE_OUT }}
          >
            <ReportRow report={report} />
          </motion.div>
        ))}
      </AnimatePresence>
    </motion.div>
  );
}
