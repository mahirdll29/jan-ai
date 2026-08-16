"use client";

import { MotionConfig } from "motion/react";
import { EASE_OUT, DUR } from "@/lib/motion";

// WHY THIS FILE HAS "use client" AT THE TOP:
//
// In the App Router every component is a SERVER component by default — it runs
// on the server, renders to HTML, and ships no JavaScript to the browser. That
// is the right default and it is why most of this app will have no client
// bundle at all.
//
// But animation needs the browser: it reads the user's motion preference, runs
// on a timer, and responds to hover. "use client" marks the boundary where
// server rendering stops and interactive JavaScript begins. Everything imported
// BELOW this boundary becomes client code too, which is exactly why the
// boundary is drawn here — around a tiny wrapper — rather than around the whole
// layout. Put "use client" on the root layout and you have opted the entire
// application out of server rendering with one line.
//
// ---- WHY reducedMotion="user" IS THE WHOLE POINT OF THIS COMPONENT ---------
//
// Some people get motion sickness, migraines or vertigo from interface
// animation. Every operating system exposes a "reduce motion" setting for this,
// and the browser surfaces it as the `prefers-reduced-motion` media query.
// Ignoring it is an accessibility failure, not a missing nicety.
//
// `reducedMotion="user"` tells motion to read that setting and, when it is on,
// automatically suppress transform-based animation — movement, scaling,
// rotation — while still allowing opacity to cross-fade, so the interface
// remains legible rather than snapping between states.
//
// THE REASON IT IS DONE HERE, ONCE: the alternative is every animated component
// calling a `useReducedMotion()` hook and branching on it. That works right up
// until somebody forgets, and the component that forgets is invisible to the
// developer who does not have the setting enabled. Declaring it at the root
// makes it the default for every animation in the app, so a component has to
// opt OUT deliberately rather than remember to opt in.

export function MotionProvider({ children }: { children: React.ReactNode }) {
  return (
    <MotionConfig
      reducedMotion="user"
      // Any animation that does not name its own timing inherits these, so the
      // house curve applies by default instead of on request.
      transition={{ duration: DUR.base, ease: EASE_OUT }}
    >
      {children}
    </MotionConfig>
  );
}
