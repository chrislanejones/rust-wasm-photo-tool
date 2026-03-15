import type { Variants } from "framer-motion";

export const slideFromLeft: Variants = {
  hidden: { x: "-100%", opacity: 0 },
  visible: {
    x: 0,
    opacity: 1,
    transition: { type: "spring", damping: 25, stiffness: 200 },
  },
  exit: { x: "-100%", opacity: 0, transition: { duration: 0.2 } },
};

export const slideFromTop: Variants = {
  hidden: { y: "-100%", opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: { type: "spring", damping: 25, stiffness: 200 },
  },
  exit: { y: "-100%", opacity: 0, transition: { duration: 0.2 } },
};

export const slideFromBottom: Variants = {
  hidden: { y: "100%", opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: { type: "spring", damping: 30, stiffness: 400 },
  },
  exit: { y: "100%", opacity: 0, transition: { duration: 0.15 } },
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.2 } },
  exit: { opacity: 0, transition: { duration: 0.15 } },
};
