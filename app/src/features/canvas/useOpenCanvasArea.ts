// The part of the canvas area a person can see and click: the canvas's
// offsetParent inside the window, less the floating panels open over it
// (panelYield's `openArea`). For screenshot compare's bar (user tests 10-23,
// C3 and C7), which has to stay clickable with the Gallery strip open and
// with the photo zoomed far past the window. Kept in step with window resizes
// and with the Tools, Gallery and Review panels opening and closing, following
// their slide until it settles.
import { useEffect, useState } from "react";
import { useUIStore } from "@/stores/useUIStore";
import { openArea, type ScreenBox } from "./panelYield";

/** Long enough for a panel's slide in or out to settle. */
const FOLLOW_MS = 700;

const same = (a: ScreenBox, b: ScreenBox) => a.l === b.l && a.t === b.t && a.r === b.r && a.b === b.b;

export function useOpenCanvasArea(canvasEl: HTMLCanvasElement | null, active: boolean): ScreenBox | null {
  const [area, setArea] = useState<ScreenBox | null>(null);
  const showTools = useUIStore((s) => s.showTools);
  const showGallery = useUIStore((s) => s.showGallery);
  const showHistory = useUIStore((s) => s.showHistory);

  useEffect(() => {
    const parent = canvasEl?.offsetParent;
    if (!active || !parent) {
      setArea(null);
      return;
    }
    let raf = 0;
    let until = performance.now() + FOLLOW_MS;
    const measure = () => {
      const p = parent.getBoundingClientRect();
      const next = openArea({ l: p.left, t: p.top, r: p.right, b: p.bottom });
      setArea((prev) => (prev && same(prev, next) ? prev : next));
      raf = performance.now() < until ? requestAnimationFrame(measure) : 0;
    };
    const follow = () => {
      until = performance.now() + FOLLOW_MS;
      if (!raf) raf = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener("resize", follow);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", follow);
    };
  }, [canvasEl, active, showTools, showGallery, showHistory]);

  return area;
}
