import { useEffect, useState } from "react";
import { BP_COMPACT, BP_NARROW, BP_MOBILE } from "./layout";

export interface Breakpoint {
  /** Current window inner width, px. */
  width: number;
  /** < BP_COMPACT — top bar collapses to icon-only and drops Undo/Redo. */
  compact: boolean;
  /** ≤ BP_COMPACT (~1000px, snapped half-screen) — the dock layout takes over
   *  (left icon rail + sliding panel); we nudge toward the compact version. */
  dock: boolean;
  /** < BP_NARROW — side panels float as overlay drawers (don't push the canvas). */
  narrow: boolean;
  /** < BP_MOBILE — phone width. The editor is unusable here, so the mobile
   *  version (view/upload-only <MobileShell/>) takes over. */
  mobile: boolean;
}

/**
 * One shared window-width breakpoint hook. A single rAF-coalesced resize listener
 * feeds every consumer, so the whole layout reacts consistently to a snap/resize
 * instead of each component owning its own listener. Thresholds live in
 * `layout.ts` (BP_COMPACT / BP_NARROW / BP_MOBILE).
 */
export function useBreakpoint(): Breakpoint {
  const [width, setWidth] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth : 1280,
  );

  useEffect(() => {
    let raf = 0;
    const onResize = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setWidth(window.innerWidth));
    };
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return {
    width,
    compact: width < BP_COMPACT,
    dock: width <= BP_COMPACT,
    narrow: width < BP_NARROW,
    mobile: width < BP_MOBILE,
  };
}
