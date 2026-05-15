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

// Shake animation for invalid drop/paste (no images found)
export const shakeAnimation: { animate: { x: number[] }; transition: Transition } = {
  animate: { x: [0, -10, 10, -8, 8, -5, 5, 0] },
  transition: { duration: 0.4, ease: "easeInOut" as Easing },
};
