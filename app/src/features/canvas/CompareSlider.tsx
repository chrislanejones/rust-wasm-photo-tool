import { useCallback, useRef, useState } from "react";
import { SlidersHorizontal } from "lucide-react";

/**
 * Squoosh-style A/B comparison slider.
 * Overlays the "before" image (via URL) on the left side of a draggable divider.
 * Sits inside .canvas-wrapper, positioned absolutely over the <canvas>.
 */

interface CompareSliderProps {
  /** URL of the original (unmodified) image */
  beforeUrl: string | null;
  /** Whether the slider is visible */
  active: boolean;
}

export function CompareSlider({ beforeUrl, active }: CompareSliderProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState(0.5);
  const [dragging, setDragging] = useState(false);

  const getPosition = useCallback((clientX: number) => {
    if (!containerRef.current) return 0.5;
    const rect = containerRef.current.getBoundingClientRect();
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  }, []);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragging(true);
      setPosition(getPosition(e.clientX));
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [getPosition],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging) return;
      setPosition(getPosition(e.clientX));
    },
    [dragging, getPosition],
  );

  const handlePointerUp = useCallback(() => {
    setDragging(false);
  }, []);

  if (!active || !beforeUrl) return null;

  const clipPercent = position * 100;

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 z-10 cursor-col-resize"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {/* Before image — clipped to the left side of the divider */}
      <img
        src={beforeUrl}
        alt="Before"
        draggable={false}
        className="absolute inset-0 w-full h-full object-contain pointer-events-none select-none"
        style={{
          clipPath: `inset(0 ${100 - clipPercent}% 0 0)`,
        }}
      />

      {/* Divider line */}
      <div
        className="absolute top-0 bottom-0 w-0.5 bg-white/80"
        style={{
          left: `${clipPercent}%`,
          transform: "translateX(-50%)",
          boxShadow: "0 0 8px rgba(0,0,0,0.5), 0 0 2px rgba(0,0,0,0.3)",
        }}
      >
        {/* Drag handle */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 shadow-lg flex items-center justify-center backdrop-blur-sm border border-white/20">
          <SlidersHorizontal className="h-4 w-4 text-gray-700" />
        </div>

        {/* Before label */}
        <div className="absolute top-3 right-3 px-2 py-1 rounded bg-black/70 text-[10px] text-white font-mono whitespace-nowrap select-none">
          Original
        </div>

        {/* After label */}
        <div className="absolute top-3 left-3 px-2 py-1 rounded bg-black/70 text-[10px] text-white font-mono whitespace-nowrap select-none">
          Compressed
        </div>
      </div>
    </div>
  );
}
