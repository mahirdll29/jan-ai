"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { fadeUp, listContainer, DUR, STAGGER } from "@/lib/motion";

// Demonstrates the motion system on the shape it was designed for: the report
// list's staggered entrance.
//
// It lives in the style guide for the same reason the colour swatches do — so
// the behaviour can be checked in one place rather than inferred from whichever
// page happens to use it. It is also what makes the reduced-motion setting
// testable before any real page exists.
//
// NOTE THE IMPORT PATH: "motion/react". Not "framer-motion". One convention,
// everywhere — see the note in lib/motion.ts on why mixing them breaks shared
// layout animations in ways that are very hard to diagnose.

const ROWS = [
  "Deep pothole at the Ring Road junction",
  "Refuse uncollected for nine days",
  "Blocked storm drain flooding the lane",
  "Four lights out along the service road",
  "Loose paving slab outside the chemist",
];

export function MotionDemo() {
  // Bumping a key remounts the list, which replays the entrance. Cheaper and
  // clearer than driving an animation controller by hand for a demo.
  const [run, setRun] = useState(0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <Button variant="outline" onClick={() => setRun((n) => n + 1)}>
          Replay entrance
        </Button>
        <p className="docket">
          {DUR.enter * 1000}ms · {STAGGER * 1000}ms stagger · ease-out
        </p>
      </div>

      <motion.ul
        key={run}
        variants={listContainer}
        initial="hidden"
        animate="visible"
        className="border-t border-rule"
      >
        {ROWS.map((row) => (
          // Each child only names the variant. The parent's staggerChildren
          // supplies the delay, so nothing here does arithmetic on an index and
          // there is nothing to renumber when the page size changes.
          <motion.li
            key={row}
            variants={fadeUp}
            className="border-b border-rule py-3"
          >
            <p className="display-wide text-h3 text-ink">{row}</p>
          </motion.li>
        ))}
      </motion.ul>
    </div>
  );
}
