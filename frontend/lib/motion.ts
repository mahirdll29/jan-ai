// Motion tokens.
//
// WHY THESE LIVE IN TYPESCRIPT AND NOT IN globals.css:
// CSS transitions are configured with classes; motion/react animations are
// configured with JavaScript objects. Durations here are in SECONDS, because
// that is what motion/react expects — CSS uses milliseconds, which is a genuine
// footgun when copying values between the two.
//
// The easing curve is defined in BOTH places on purpose: as --ease-out in
// globals.css (so every Tailwind `ease-out` utility uses it) and as EASE_OUT
// here (so every JS animation does). Same curve, two consumers.
//
// ---- THE IMPORT CONVENTION, DECIDED ONCE -----------------------------------
//
// This project uses the `motion` package and imports from "motion/react".
// It does NOT use "framer-motion".
//
// Both packages exist at v13 and export nearly identical APIs — `motion` is the
// actively developed successor, and `framer-motion` is the legacy name. Mixing
// the two import paths in one app loads two copies of the animation engine,
// which breaks shared layout animations in ways that are very hard to diagnose:
// components animate fine individually and silently fail to coordinate.
//
// One path, everywhere. If you see "framer-motion" in an import, it is a bug.

/**
 * The project's only easing curve.
 *
 * Ease-OUT: fast at the start, settling at the end. It matches how physical
 * objects arrive — quick departure, gentle landing — so an interface using it
 * feels responsive rather than sluggish, because the movement is mostly over
 * before the eye finishes tracking it.
 *
 * Deliberately not a spring: spring overshoot is playful, and overshoot on UI
 * chrome (panels, rows, filters) reads as imprecision in a tool about municipal
 * infrastructure. No `linear` either — nothing in the physical world starts and
 * stops at a constant speed, so linear motion always reads as mechanical.
 */
export const EASE_OUT = [0.16, 1, 0.3, 1] as const;

/**
 * Durations, in seconds.
 *
 * The ceiling is deliberate. Under ~100ms a transition is not perceived as
 * motion at all, and past ~400ms the interface feels like it is waiting on the
 * animation rather than the other way round. Everything here sits in the band
 * where motion explains a change without delaying it.
 */
export const DUR = {
  /** 150ms — hover, focus, colour and small state changes. */
  micro: 0.15,
  /** 220ms — the default for anything that moves or resizes. */
  base: 0.22,
  /** 300ms — entrances only. The longest anything is allowed to take. */
  enter: 0.3,
} as const;

/**
 * Delay between consecutive items in a staggered list, in seconds.
 *
 * 35ms is small on purpose: it is enough for the eye to read the list as
 * arriving in order rather than all at once, without the last row of a 20-row
 * page waiting most of a second to appear. Stagger should suggest sequence, not
 * enforce a queue.
 */
export const STAGGER = 0.035;

/**
 * Standard entrance: fade in while rising a few pixels.
 *
 * Only `opacity` and `transform` are animated, here and everywhere else in the
 * app. Those two are the only properties the browser can animate on the
 * compositor — without touching layout or repainting. Animating `height`,
 * `top`, `width` or `margin` forces the browser to recalculate the position of
 * everything on the page on every single frame, which is what produces jank on
 * a mid-range phone.
 */
export const fadeUp = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: DUR.enter, ease: EASE_OUT },
  },
} as const;

/**
 * Parent variant for a staggered list.
 *
 * A parent's `visible` state propagates to children automatically, so a list
 * only needs this on the container and `fadeUp` on each row — no per-item delay
 * arithmetic, and nothing to renumber when the page size changes.
 */
export const listContainer = {
  hidden: {},
  visible: {
    transition: { staggerChildren: STAGGER },
  },
} as const;
