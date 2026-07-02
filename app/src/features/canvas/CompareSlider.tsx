import { useCallback, useEffect, useRef, useState } from "react";
import { useUIStore } from "@/stores/useUIStore";

interface CompareSliderProps {
  /** The canvas element rendering the current edited image — we mirror its bounding box. */
  canvasEl: HTMLCanvasElement | null;
}

/**
 * Squoosh-style A/B compare. Renders an overlay positioned exactly over the
 * canvas. The "before" layer fills that same box via background-size 100% 100%,
 * so both layers share one coordinate space regardless of zoom/pan.
 */
export function CompareSlider({ canvasEl }: CompareSliderProps) {
  // The "before" original URL + whether compare is on now come from the UI store
  // (were prop-drilled AppShell → CanvasArea → here before stage 1).
  const beforeUrl = useUIStore((s) => s.originalUrl);
  const active = useUIStore((s) => s.compareActive);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState(0.5);
  const [dragging, setDragging] = useState(false);
  const [box, setBox] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
  } | null>(null);

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
    // Layout size changes (e.g. Apply Compression & Resize swaps dimensions).
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

  const getPosition = useCallback((clientX: number) => {
    const el = overlayRef.current;
    if (!el) return 0.5;
    const rect = el.getBoundingClientRect();
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragging(true);
      setPosition(getPosition(e.clientX));
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [getPosition],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging) return;
      setPosition(getPosition(e.clientX));
    },
    [dragging, getPosition],
  );

  const onPointerUp = useCallback(() => setDragging(false), []);

  if (!active || !beforeUrl || !box) return null;

  const clipPercent = position * 100;

  return (
    <div
      ref={overlayRef}
      className="absolute z-20 cursor-col-resize select-none"
      style={{
        left: box.left,
        top: box.top,
        width: box.width,
        height: box.height,
        touchAction: "none",
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {/* "Before" layer — original stretched to exactly the canvas's rendered box */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `url(${beforeUrl})`,
          backgroundSize: "100% 100%",
          backgroundRepeat: "no-repeat",
          clipPath: `inset(0 ${100 - clipPercent}% 0 0)`,
        }}
      />

      {/* Divider line */}
      <div
        className="absolute top-0 bottom-0 w-0.5 bg-white pointer-events-none"
        style={{
          left: `${clipPercent}%`,
          transform: "translateX(-50%)",
          boxShadow: "0 0 8px rgba(0,0,0,0.5), 0 0 2px rgba(0,0,0,0.3)",
        }}
      >
        <div className="absolute top-3 left-1/2 -translate-x-1/2 px-2 py-1 rounded bg-black/70 text-2xs text-white font-mono whitespace-nowrap select-none">
          Original
        </div>
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-2 py-1 rounded bg-black/70 text-2xs text-white font-mono whitespace-nowrap select-none">
          Edited
        </div>
      </div>
    </div>
  );
}
