// The canvas element's rendered box, relative to its offsetParent, kept in
// step with zoom, pan and resizes while `active`. Out of CompareSlider.tsx
// (Night 10-23) so the screenshot-compare tint covers the photo the same way.
import { useEffect, useState } from "react";
import type { ScreenRect } from "@/lib/comparePhotoRect";

export function useCanvasBox(canvasEl: HTMLCanvasElement | null, active: boolean): ScreenRect | null {
  const [box, setBox] = useState<ScreenRect | null>(null);

  useEffect(() => {
    if (!active || !canvasEl) {
      setBox(null);
      return;
    }
    // rAF-deduped box sync. getBoundingClientRect includes CSS transforms, so
    // this picks up zoom (transform: scale) and pan (translate) — which a
    // ResizeObserver alone never sees, because transforms don't change layout
    // size. That gap is what left the overlay misaligned after zooming or
    // panning with compare open.
    let raf = 0;
    const updateBox = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const parent = canvasEl.offsetParent as HTMLElement | null;
        if (!parent) return;
        const parentRect = parent.getBoundingClientRect();
        const rect = canvasEl.getBoundingClientRect();
        setBox((prev) => {
          const next = {
            left: rect.left - parentRect.left,
            top: rect.top - parentRect.top,
            width: rect.width,
            height: rect.height,
          };
          return prev &&
            prev.left === next.left &&
            prev.top === next.top &&
            prev.width === next.width &&
            prev.height === next.height
            ? prev
            : next;
        });
      });
    };
    updateBox();
    // Layout size changes (e.g. an Apply Resize swaps dimensions).
    const ro = new ResizeObserver(updateBox);
    ro.observe(canvasEl);
    if (canvasEl.offsetParent) ro.observe(canvasEl.offsetParent);
    // Transform/attribute changes (zoom scale, pan translate, canvas w/h).
    const mo = new MutationObserver(updateBox);
    mo.observe(canvasEl, {
      attributes: true,
      attributeFilter: ["style", "width", "height"],
    });
    window.addEventListener("scroll", updateBox, true);
    window.addEventListener("resize", updateBox);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      ro.disconnect();
      mo.disconnect();
      window.removeEventListener("scroll", updateBox, true);
      window.removeEventListener("resize", updateBox);
    };
  }, [active, canvasEl]);

  return box;
}
