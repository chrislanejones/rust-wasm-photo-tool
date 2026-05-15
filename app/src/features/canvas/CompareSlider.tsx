import { useCallback, useEffect, useRef, useState } from "react";

interface CompareSliderProps {
  /** Object URL or blob URL of the unedited original. */
  beforeUrl: string | null;
  /** The canvas element rendering the current edited image — we mirror its bounding box. */
  canvasEl: HTMLCanvasElement | null;
  active: boolean;
}

/**
 * Squoosh-style A/B compare. Renders an overlay positioned exactly over the
 * canvas. The "before" layer fills that same box via background-size 100% 100%,
 * so both layers share one coordinate space regardless of zoom/pan.
 */
export function CompareSlider({ beforeUrl, canvasEl, active }: CompareSliderProps) {
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
    const updateBox = () => {
      const parent = canvasEl.offsetParent as HTMLElement | null;
      if (!parent) return;
      const parentRect = parent.getBoundingClientRect();
      const rect = canvasEl.getBoundingClientRect();
      setBox({
        left: rect.left - parentRect.left,
        top: rect.top - parentRect.top,
        width: rect.width,
        height: rect.height,
      });
    };
    updateBox();
    const ro = new ResizeObserver(updateBox);
    ro.observe(canvasEl);
    window.addEventListener("scroll", updateBox, true);
    window.addEventListener("resize", updateBox);
    return () => {
      ro.disconnect();
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
        <div className="absolute top-3 left-1/2 -translate-x-1/2 px-2 py-1 rounded bg-black/70 text-[10px] text-white font-mono whitespace-nowrap select-none">
          Original
        </div>
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-2 py-1 rounded bg-black/70 text-[10px] text-white font-mono whitespace-nowrap select-none">
          Edited
        </div>
      </div>
    </div>
  );
}
