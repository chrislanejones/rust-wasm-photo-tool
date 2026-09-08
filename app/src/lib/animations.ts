import type { Variants, Transition, Easing } from "framer-motion";

// Standardized quick motion transition (200ms spring animation)
export const quickSpring: Transition = {
  type: "spring",
  stiffness: 400,
  damping: 30,
  mass: 0.8,
};

// Panel spacing animation for layout adjustments
export const panelSpacingTransition: Transition = {
  type: "spring",
  stiffness: 400,
  damping: 30,
  mass: 0.8,
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
    transition: quickSpring,
  },
  exit: { x: "-100%", opacity: 0, transition: { duration: 0.15 } },
};

export const slideFromRight: Variants = {
  hidden: { x: "100%", opacity: 0 },
  visible: {
    x: 0,
    opacity: 1,
    transition: quickSpring,
  },
  exit: { x: "100%", opacity: 0, transition: { duration: 0.15 } },
};

export const slideFromTop: Variants = {
  hidden: { y: "-100%", opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: quickSpring,
  },
  exit: { y: "-100%", opacity: 0, transition: { duration: 0.15 } },
};

export const slideFromBottom: Variants = {
  hidden: { y: "100%", opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: quickSpring,
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

// Settings sub-feature panel enter/exit (Paint / Text / Resize sub-panels and
// ImageMetaPanel). Spread onto the `motion.div` — `{...settingsPanelMotion}` —
// instead of hand-copying the same initial/animate/exit triple (it had drifted
// into ~9 inline copies). Enter is the shared `quickSpring`; exit is a quick
// 120ms fade-up.
export const settingsPanelMotion = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: quickSpring },
  exit: { opacity: 0, y: -8, transition: { duration: 0.12 } },
} as const;

// Staggered thumbnail pop-in for gallery strip
export const thumbEnter = (i: number) => ({
  initial: { opacity: 0, scale: 0.85 },
  animate: { opacity: 1, scale: 1 },
  transition: { duration: 0.2, delay: i * 0.05 },
});

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
// the bar's New/Tools/Gallery/Review/Export), and the gallery thumbnails all
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
  rest: { scale: 1, transition: quickSpring },
  hover: { scale: HOVER_POP_SCALE, transition: quickSpring },
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

// How long a freshly opened panel keeps offering its corner close. After this
// the button unmounts — a panel you have settled into stops asking — and it
// comes back with the panel, since mount is panel-open. (Chris, 2026-09-08.)
export const PANEL_CLOSE_REVEAL_MS = 40_000;
