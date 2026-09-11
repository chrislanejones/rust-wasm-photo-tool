import type { Variants, Transition, Easing, TargetAndTransition } from "framer-motion";

// Standardized quick motion transition (200ms spring animation)
/* ─────────────────────────────────────────────────────────────────────────────
   THE SPRING SCALE — five tunings, named for how they FEEL.

   ⚠️ THERE WERE SEVEN, AND TWO OF THEM WERE THE SAME. `springStandard` and
   `panelSpacingTransition` were byte-identical (400/30/0.8) under two names —
   one named for its character, one for a use case — so a component picked
   whichever word it happened to read first. Two more were typed inline at
   500/25 and 340/26.

   Nobody chose five tunings. But three of them ARE genuinely different feels,
   and flattening them into one would change how the app moves — which is a
   design decision, not a refactor. So the duplicate is gone and the survivors
   are named, which makes the set visible enough to argue about later.

   Named for CHARACTER, not for a caller. "Panel spacing" describes where the
   old one was used, and a name like that is why the duplicate happened: a
   dialog author reads it, decides it is not about them, and writes their own.
   ────────────────────────────────────────────────────────────────────────── */

/** Small things that should arrive with a snap — a badge, a count, a pip. */
export const springPop: Transition = {
  type: "spring",
  stiffness: 500,
  damping: 25,
};

/** The default. Panels, dialogs, layout shifts — anything with area. */
export const springStandard: Transition = {
  type: "spring",
  stiffness: 400,
  damping: 30,
  mass: 0.8,
};

/** A larger surface easing in, where a snap would feel like a jolt. */
export const springSoft: Transition = {
  type: "spring",
  stiffness: 340,
  damping: 26,
};

/** A one-off arrival with visible bounce — the celebration dialog's hero
 *  number. Softer stiffness, low damping, so it overshoots and settles. */
export const springBouncy: Transition = {
  type: "spring",
  stiffness: 260,
  damping: 18,
};

/** The brand reveal. Same stiffness as `springBouncy`, more damping, so it
 *  arrives without the overshoot.
 *
 *  ⚠️ THESE TWO DIFFER ONLY IN DAMPING (18 vs 28) and that is exactly the shape
 *  a typo takes. Both are kept at their measured values because changing either
 *  changes how a moment FEELS, which is Chris's call and not a refactor's — but
 *  they are named here rather than left inline so the question is at least
 *  askable. If they should be one spring, this is where that happens. */
export const springReveal: Transition = {
  type: "spring",
  stiffness: 260,
  damping: 28,
};

// Instant (no-motion) transition — swap in for the spring/tween transitions
// above when the user has Reduce Motion on. Framer-motion animates layout props
// (margin, width, …) through inline styles, NOT CSS, so the global
// `.reduce-motion` rule can't reach them, and `<MotionConfig reducedMotion=
// "always">` only suppresses TRANSFORM/layout animations — margin/width slip
// through. Use this for those non-transform animations so they snap instantly.
export const instantTransition: Transition = { duration: 0 };

// Slide animations with consistent quick timing
export const slideFromLeft: Variants = {
  hidden: { x: "-100%", opacity: 0 },
  visible: {
    x: 0,
    opacity: 1,
    transition: springStandard,
  },
  exit: { x: "-100%", opacity: 0, transition: { duration: 0.15 } },
};

export const slideFromRight: Variants = {
  hidden: { x: "100%", opacity: 0 },
  visible: {
    x: 0,
    opacity: 1,
    transition: springStandard,
  },
  exit: { x: "100%", opacity: 0, transition: { duration: 0.15 } },
};

export const slideFromTop: Variants = {
  hidden: { y: "-100%", opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: springStandard,
  },
  exit: { y: "-100%", opacity: 0, transition: { duration: 0.15 } },
};

export const slideFromBottom: Variants = {
  hidden: { y: "100%", opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: springStandard,
  },
  exit: { y: "100%", opacity: 0, transition: { duration: 0.15 } },
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.15 } },
  exit: { opacity: 0, transition: { duration: 0.15 } },
};

// Swap between two panels occupying the same slot (e.g. the upload actions ⇄
// the New Canvas setup). A subtle horizontal slide + fade; pair with
// <AnimatePresence mode="wait"> and a unique key per panel.
export const panelSwap: Variants = {
  hidden: { opacity: 0, x: 12 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.2 } },
  exit: { opacity: 0, x: -12, transition: { duration: 0.12 } },
};

/* ─────────────────────────────────────────────────────────────────────────────
   WHAT DELIBERATELY IS NOT IN THIS FILE.
   Audited 2026-09-09, when nine components still wrote framer props inline.
   Five of those were real duplication and moved here. Four did not, and are
   listed so the next audit does not "fix" them into worse code:

     · AppShell's load-progress bar and canvas margins, and TopBar's panel
       gutters — the animated value is COMPUTED from breakpoints and panel
       state. A variant would have to receive the computed number anyway, so
       extracting hides the logic and shares nothing.
     · CelebrationDialog's confetti — every particle carries its own dx, dy,
       rotation, duration and delay. That is per-item DATA, not a shared style.
     · BrandRevealScreen's `reduceMotion ? 0 : 0.35`. It looks redundant beside
       AppShell's <MotionConfig reducedMotion>, and it is not: `"always"` still
       lets OPACITY animate, because a fade is not motion. Killing the duration
       is what actually removes it for someone who asked for less motion.

   A variant used once is indirection, not a single source of truth.
   ────────────────────────────────────────────────────────────────────────── */

// Modal / dialog entrance — the surface itself, not its backdrop.
//
// ⚠️ THIS EXISTED TWICE AND THE TWO HAD ALREADY DRIFTED: UploadDialog entered
// from `scale: 0.95`, ObjectRemovalModal from `scale: 0.96`. Nobody chose
// that difference and nobody could see it — which is the whole argument for a
// named variant. `settingsPanelMotion` right below carries the same scar in
// its own comment ("it had drifted into ~9 inline copies").
//
// Spread it — `{...dialogZoom}` — rather than copying the triple.
export const dialogZoom = {
  initial: { scale: 0.95, opacity: 0 },
  animate: { scale: 1, opacity: 1, transition: springStandard },
  exit: { scale: 0.95, opacity: 0, transition: { duration: 0.12 } },
};

// Settings sub-feature panel enter/exit (Paint / Text / Resize sub-panels and
// ImageMetaPanel). Spread onto the `motion.div` — `{...settingsPanelMotion}` —
// instead of hand-copying the same initial/animate/exit triple (it had drifted
// into ~9 inline copies). Enter is the shared `springStandard`; exit is a quick
// 120ms fade-up.
export const settingsPanelMotion = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: springStandard },
  exit: { opacity: 0, y: -8, transition: { duration: 0.12 } },
} as const;

// Staggered thumbnail pop-in for gallery strip
export const thumbEnter = (i: number) => ({
  initial: { opacity: 0, scale: 0.85 },
  animate: { opacity: 1, scale: 1 },
  transition: { duration: 0.2, delay: i * 0.05 },
});

/**
 * THUMBNAIL "DEVELOP" — the picture arrives black and white, HOLDS there long
 * enough to be read as a black-and-white photo, then comes into colour.
 *
 * ⚠️ THE HOLD IS THE WHOLE POINT, and its absence is why the first cut looked
 * broken. That version faded straight from grayscale(1) to grayscale(0) over
 * 240 ms, so the image was fully grey for about 33 ms — measured, frame by
 * frame — and spent the rest mid-wash. On a 99 px tile that is not a black and
 * white photo turning colour; it is a flicker nobody sees. Holding first is
 * what makes it legible.
 *
 *  - LEAD: the gallery draws, THEN the pictures start. Without it the first
 *    tile develops in the same frame the panel appears and the two read as one
 *    muddled event.
 *  - HOLD: fully black and white, and long enough to register.
 *  - FADE: the colouring itself.
 *  - HANDOFF: tile N starts when tile N-1 is this far through — left to right,
 *    succession rather than a wall.
 *
 * A fade is not motion, so this runs under Reduce Motion too — see the
 * BrandRevealScreen note above.
 */
const THUMB_DEVELOP_LEAD_MS = 120;
const THUMB_DEVELOP_HOLD_MS = 150;
const THUMB_DEVELOP_FADE_MS = 190;
const THUMB_DEVELOP_HANDOFF = 0.8;
/** Total per tile — the minimum a photo takes to arrive, however fast it decoded. */
const THUMB_DEVELOP_TOTAL_MS = THUMB_DEVELOP_HOLD_MS + THUMB_DEVELOP_FADE_MS;
export const THUMB_DEVELOP_LEAD = THUMB_DEVELOP_LEAD_MS;
export const THUMB_DEVELOP_STAGGER_MS = Math.round(THUMB_DEVELOP_TOTAL_MS * THUMB_DEVELOP_HANDOFF);
export const thumbDevelop: { mono: TargetAndTransition; colour: TargetAndTransition } = {
  /** Where every tile starts, and where it stays until its turn. */
  mono: { filter: "grayscale(1)" },
  /** Hold, then colour. Two keyframes at the same value give the hold; `times`
   *  puts the second at HOLD/TOTAL so the fade owns only the remainder. */
  colour: {
    filter: ["grayscale(1)", "grayscale(1)", "grayscale(0)"],
    transition: {
      duration: THUMB_DEVELOP_TOTAL_MS / 1000,
      times: [0, THUMB_DEVELOP_HOLD_MS / THUMB_DEVELOP_TOTAL_MS, 1],
      ease: "easeOut",
    },
  },
};

// Top-of-screen image loading progress bar
export const imageLoadBarFade: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

export const imageLoadBarProgress = {
  initial: { width: "0%" } as const,
  transition: { duration: 0.15, ease: "easeOut" as Easing },
};

// ── Hover pop ────────────────────────────────────────────────────────────────
// The glyph inside a hovered control grows 10%. ONE definition: the tool rail
// tiles (ToolButton), the sub-tool row (SubtoolRow), every IconButton in the
// top bar, the ToggleButtonGroup icons (the Review panel's section toggles and
// the bar's Tools/Gallery/Review), and the gallery thumbnails all
// read it from here.
//
// Until 2026-09-08 it was the same Tailwind string
// (`transition-transform duration-200 ease-out group-hover:scale-110`) pasted
// into three of those files and missing from the others. That also bypassed
// Reduce Motion: a CSS hover transform is invisible to the <MotionConfig
// reducedMotion> wrapper in AppShell that governs every other animation. As a
// framer variant it is suppressed with the rest when the preference is on.
//
// Usage — the HOVERED element is the parent, the POPPING element is the child:
//   <motion.button whileHover="hover">
//     <motion.span variants={hoverPop}>…</motion.span>
//   </motion.button>
// The child carries ONLY `variants`. A child with its own `animate` prop opts
// out of the parent's variant propagation — that is exactly how the first cut
// of this shipped reading scale 1 under hover on every surface. On hover end
// framer returns the child to its pre-hover value with its default spring.
const HOVER_POP_SCALE = 1.1; // module-local on purpose: nothing outside reads a number
export const hoverPop: Variants = {
  rest: { scale: 1, transition: springStandard },
  hover: { scale: HOVER_POP_SCALE, transition: springStandard },
};

// ── Panel close reveal ───────────────────────────────────────────────────────
// The corner X on Tools / Gallery / Review (PanelCloseButton): hidden at rest,
// shown while the panel is hovered or the button is focused. A framer variant
// rather than a `group-hover:opacity-100` string so it sits under the same
// <MotionConfig reducedMotion> as everything else. Driven by the button's own
// state, NOT by `whileHover` on the panel — a hover label on the panel would
// propagate to every tile icon inside it (they carry `hoverPop`), and the whole
// rail would grow in unison whenever the panel was hovered.
export const hoverReveal: Variants = {
  hidden: { opacity: 0, transition: { duration: 0.15 } },
  shown: { opacity: 1, transition: { duration: 0.15 } },
};

// How long a panel keeps offering its corner close, measured from the last
// time the pointer entered it (or from open). A panel you have settled into
// stops asking; leave and come back, or reopen it, and the clock restarts.
// (Chris, 2026-09-08.)
export const PANEL_CLOSE_REVEAL_MS = 40_000;
