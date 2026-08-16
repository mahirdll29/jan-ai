"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";

import { ApiError, reports as reportsApi } from "@/lib/api";
import { splitTags } from "@/lib/format";
import { DUR, EASE_OUT, STAGGER } from "@/lib/motion";
import { SeverityGauge } from "@/components/design/severity-gauge";
import { Button } from "@/components/ui/button";
import type { Report } from "@/lib/types";

// ===========================================================================
// THE AI ENHANCEMENT PANEL
//
// The one place in the product where the whole architecture is visible at
// once. Every state below is a state a report can genuinely be in, and the
// report is complete and useful in ALL of them.
//
// THE CLAIM THIS UI HAS TO BACK UP: AI is an enhancement layer, never a
// dependency. That is why this panel sits BELOW the citizen's own content as a
// clearly supplementary section — never a blocking overlay, never a slot with
// an error where the report should be. If the AI never runs, the page above
// this is still a complete, useful civic report.
// ===========================================================================

const POLL_INTERVAL_MS = 3000;
const MAX_POLLS = 10; // ~30 seconds

type PanelState = "idle" | "polling" | "timedOut" | "retrying";

export function AiPanel({ report: initial }: { report: Report }) {
  const [report, setReport] = useState(initial);
  const [state, setState] = useState<PanelState>(
    initial.aiStatus === "PENDING" ? "polling" : "idle"
  );
  const [retryError, setRetryError] = useState<string | null>(null);

  // Held in refs, not state: changing either must not trigger a re-render, and
  // the cleanup function needs a stable handle on the pending timer.
  const attempts = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---- POLLING ---------------------------------------------------------
  //
  // WHY A setTimeout CHAIN AND NOT setInterval:
  //
  // setInterval fires on a fixed schedule regardless of whether the previous
  // request has come back. On a slow connection the requests overlap and pile
  // up, and responses can arrive out of order — so a stale response can
  // overwrite a fresher one. Chaining schedules the NEXT request only after the
  // current one has settled, so there is never more than one in flight.
  //
  // WHY IT POLLS FOR ANY PENDING REPORT, not just one you have just created:
  //
  // It is less code, and it does something useful — the reports stranded at
  // PENDING since before the AI pipeline existed will poll, time out, and offer
  // the manual retry that actually resolves them. Special-casing "just created"
  // would have been more work and left those rows spinning forever.
  useEffect(() => {
    if (state !== "polling") return;

    let cancelled = false;

    async function poll() {
      attempts.current += 1;

      try {
        const { report: fresh } = await reportsApi.get(initial.id);
        if (cancelled) return;

        setReport(fresh);

        // Settled — stop.
        if (fresh.aiStatus !== "PENDING") {
          setState("idle");
          return;
        }
      } catch {
        // A failed poll is not a failed enhancement. Swallow it and let the
        // attempt counter run out — the retry button is the escape hatch.
        if (cancelled) return;
      }

      if (attempts.current >= MAX_POLLS) {
        setState("timedOut");
        return;
      }

      timer.current = setTimeout(poll, POLL_INTERVAL_MS);
    }

    timer.current = setTimeout(poll, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [state, initial.id]);

  // ---- MANUAL RETRY ----------------------------------------------------
  const retry = useCallback(async () => {
    setState("retrying");
    setRetryError(null);

    try {
      const { report: fresh } = await reportsApi.enhance(initial.id);

      // ---- THE ENDPOINT RETURNS 200 EVEN WHEN THE AI FAILED -------------
      //
      // Deliberate on the backend: an AI failure is a normal state of a report,
      // not an error in the service. The server ran the attempt, recorded the
      // outcome, and returned the honest current state of the resource.
      //
      // THE CONSEQUENCE FOR THIS COMPONENT: checking res.ok would report
      // success on a failure. The outcome is in `aiStatus`, and that is what we
      // read.
      setReport(fresh);
      setState("idle");
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        // Already COMPLETED — two tabs, or a double click. Not an error: the
        // thing the user wanted has already happened. Re-read and show it.
        try {
          const { report: fresh } = await reportsApi.get(initial.id);
          setReport(fresh);
        } catch {
          // Ignore — the retry error below is enough.
        }
        setState("idle");
        return;
      }

      setRetryError(
        error instanceof ApiError
          ? error.message
          : "Couldn't reach the server. Try again."
      );
      setState("idle");
    }
  }, [initial.id]);

  const tags = splitTags(report.aiTags);
  const busy = state === "polling" || state === "retrying";

  return (
    <section
      aria-labelledby="ai-panel-heading"
      className="border-t border-rule pt-6"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 id="ai-panel-heading" className="docket">
          AI assessment
        </h2>

        {report.aiStatus === "COMPLETED" && (
          <SeverityGauge severity={report.severity} />
        )}
      </div>

      {/* aria-live so a screen reader is told when the state settles. Without
          it, someone not watching the screen would never learn the analysis
          finished — the content would just silently appear. "polite" waits for
          a pause rather than interrupting. */}
      <div className="mt-4" aria-live="polite" aria-busy={busy}>
        <AnimatePresence mode="wait">
          {busy && (
            <motion.div
              key="busy"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: DUR.micro }}
              className="flex items-center gap-3"
            >
              {/* A slow, quiet pulse rather than a spinner. A spinner says
                  "the interface is stuck"; this says "something is happening
                  and it is fine". Opacity only, so it stays cheap and is
                  suppressed automatically under reduced motion. */}
              <motion.span
                aria-hidden="true"
                className="size-2 rounded-full bg-signal"
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
              />
              <p className="text-ink-muted">
                {state === "retrying"
                  ? "Running the analysis…"
                  : "Analysing this report…"}
              </p>
            </motion.div>
          )}

          {!busy && report.aiStatus === "COMPLETED" && (
            // ---- THE SIGNATURE MOMENT ----
            // A staggered reveal: summary, then tags. Considered rather than
            // decorative — the delay is short enough to read as "arriving in
            // order", not as a queue.
            <motion.div
              key="completed"
              initial="hidden"
              animate="visible"
              variants={{
                hidden: {},
                visible: { transition: { staggerChildren: STAGGER * 2 } },
              }}
              className="space-y-4"
            >
              {report.aiSummary && (
                <motion.p
                  variants={{
                    hidden: { opacity: 0, y: 6 },
                    visible: {
                      opacity: 1,
                      y: 0,
                      transition: { duration: DUR.enter, ease: EASE_OUT },
                    },
                  }}
                  className="max-w-prose text-lg text-ink"
                >
                  {report.aiSummary}
                </motion.p>
              )}

              {tags.length > 0 && (
                <motion.ul
                  variants={{
                    hidden: { opacity: 0, y: 6 },
                    visible: {
                      opacity: 1,
                      y: 0,
                      transition: { duration: DUR.enter, ease: EASE_OUT },
                    },
                  }}
                  className="flex flex-wrap gap-2"
                >
                  {/* splitTags, never .split() inline — aiTags is a
                      comma-separated STRING and may be null. */}
                  {tags.map((tag) => (
                    <li
                      key={tag}
                      className="docket rounded-full border border-rule px-2.5 py-1"
                    >
                      {tag}
                    </li>
                  ))}
                </motion.ul>
              )}

              <p className="text-sm text-ink-muted">
                Generated from the title and description. The category above was
                chosen by the person who filed the report — the model never
                changes it.
              </p>
            </motion.div>
          )}

          {!busy && (report.aiStatus === "FAILED" || state === "timedOut") && (
            <motion.div
              key="failed"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: DUR.base }}
              className="space-y-3"
            >
              {/* NOT styled as an error. This is a normal state of a report,
                  and the report above is complete without it. Red would tell
                  the user something is wrong with THEIR report, which is false. */}
              <p className="text-ink-muted">
                {state === "timedOut"
                  ? "Still processing. This usually takes a few seconds."
                  : "AI analysis isn't available for this report."}
              </p>
              <p className="max-w-prose text-sm text-ink-muted">
                The report itself is complete and has been filed — the summary
                and severity are an optional extra.
              </p>

              <Button variant="outline" onClick={retry} disabled={busy}>
                Run the analysis
              </Button>

              {retryError && (
                <p role="alert" className="text-sm text-destructive">
                  {retryError}
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}
