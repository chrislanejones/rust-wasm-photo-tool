import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  thumbDevelop,
  THUMB_DEVELOP_MIN_MS,
  THUMB_DEVELOP_STAGGER_MS,
} from "@/lib/animations";

/**
 * Tiles that mount together come up IN SUCCESSION, left to right. Each new
 * tile asks for a start time and gets the later of "now" and "the previous
 * tile's start + STAGGER". A single photo added later starts at once, because
 * the previous start is long past. Module-level on purpose: the strip and the
 * grid both mount their tiles in DOM order, and DOM order IS left-to-right.
 */
let lastDevelopStart = 0;
function scheduleDevelop(): number {
  const start = Math.max(performance.now(), lastDevelopStart + THUMB_DEVELOP_STAGGER_MS);
  lastDevelopStart = start;
  return start;
}

type Phase = "covered" | "developing" | "revealed" | "done";

interface Props {
  /** The thumbnail this paper covers — a new blob restarts the develop. */
  thumbBlob: Blob;
  /** For the accessible label, e.g. "Loading beach.jpg". */
  name: string;
  /** True once the <img> has fired load (or error — a broken image must not
   *  leave the paper up forever). */
  imgReady: boolean;
}

/**
 * THE WHITE PAPER over a gallery thumbnail — a Polaroid coming up. Replaces
 * the grey Skeleton in the same slot with the same role, but it ARRIVES
 * rather than waits. The three numbers live in `thumbDevelop` in
 * lib/animations.ts; nothing here is tuned.
 *
 * Two independent facts have to be true before the paper goes: the pixels
 * are decoded (`imgReady`) AND the minimum time has passed. Either alone is
 * not enough — instant pixels would flash, and elapsed time with no pixels
 * would reveal a blank tile.
 *
 * `revealed` ends fully clipped, so returning null on completion is invisible
 * and needs no AnimatePresence exit. Reduced motion: a plain fade once the
 * pixels are in — no sweep, no stagger.
 */
export function DevelopPaper({ thumbBlob, name, imgReady }: Props) {
  const reduceMotion = useReducedMotion();
  const [phase, setPhase] = useState<Phase>("covered");
  const [minElapsed, setMinElapsed] = useState(false);

  useEffect(() => {
    setMinElapsed(false);
    setPhase("covered");
    const wait = Math.max(0, scheduleDevelop() - performance.now());
    const t1 = window.setTimeout(() => setPhase("developing"), wait);
    const t2 = window.setTimeout(() => setMinElapsed(true), wait + THUMB_DEVELOP_MIN_MS);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [thumbBlob]);

  useEffect(() => {
    if (imgReady && minElapsed && phase === "developing") setPhase("revealed");
  }, [imgReady, minElapsed, phase]);

  if (phase === "done") return null;

  // Polaroid paper is white in BOTH themes — a dark "paper" is not a photo
  // developing, it is a photo failing to load. No z-index: the paper is a
  // later absolute sibling of the <img>, which already paints it on top.
  const cls = "pointer-events-none absolute inset-0 rounded-lg bg-white"; // allow: raw-color
  const label = `Loading ${name}`;

  if (reduceMotion) {
    return (
      <motion.div
        role="status"
        aria-label={label}
        className={cls}
        initial={{ opacity: 1 }}
        animate={{ opacity: imgReady ? 0 : 1 }}
        transition={{ duration: 0.15 }}
        onAnimationComplete={() => {
          if (imgReady) setPhase("done");
        }}
      />
    );
  }

  return (
    <motion.div
      role="status"
      aria-label={label}
      className={cls}
      variants={thumbDevelop}
      initial="covered"
      animate={phase}
      onAnimationComplete={(definition) => {
        if (definition === "revealed") setPhase("done");
      }}
    />
  );
}
