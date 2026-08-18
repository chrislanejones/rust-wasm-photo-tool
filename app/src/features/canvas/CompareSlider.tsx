import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useUIStore } from "@/stores/useUIStore";
import { useToolStore } from "@/stores/useToolStore";

interface CompareSliderProps {
  /** The canvas element rendering the current edited image — we mirror its bounding box. */
  canvasEl: HTMLCanvasElement | null;
}

/**
 * Squoosh-style A/B compare. Renders an overlay positioned exactly over the
 * canvas. The "before" layer fills that same box via background-size 100% 100%,
 * so both layers share one coordinate space regardless of zoom/pan.
 *
 * LEFT of the divider is the ORIGINAL (the before layer is clipped from the
 * right, so what survives is the left band); RIGHT is the EDITED canvas showing
 * through. Every part of the labelling below exists to say that without being
 * read twice — see the label block.
 */
export function CompareSlider({ canvasEl }: CompareSliderProps) {
  // The "before" original URL + whether compare is on now come from the UI store
  // (were prop-drilled AppShell → CanvasArea → here before stage 1).
  const beforeUrl = useUIStore((s) => s.originalUrl);
  const active = useUIStore((s) => s.compareActive);
  const setCompareActive = useUIStore((s) => s.setCompareActive);
  // Divider position lives in the store (see useUIStore) — it is the thing the
  // "re-centre on close" rule resets, and a CanvasArea remount must not silently
  // move the handle back to the middle mid-comparison.
  const position = useUIStore((s) => s.comparePosition);
  const setPosition = useUIStore((s) => s.setComparePosition);
  const activeSubTool = useToolStore((s) => s.activeSubTool);
  const overlayRef = useRef<HTMLDivElement>(null);
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

  // The ONLY control for this overlay is the "Hide A/B Compare" button in
  // Enhance › Compress. Walk to any other group and that button is gone while
  // the overlay stays pinned over the canvas — a stuck comparison with nothing
  // left to switch it off. Leaving the group closes it.
  useEffect(() => {
    if (active && !activeSubTool.startsWith("enhance/")) setCompareActive(false);
  }, [active, activeSubTool, setCompareActive]);

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
    [getPosition, setPosition],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging) return;
      setPosition(getPosition(e.clientX));
    },
    [dragging, getPosition, setPosition],
  );

  const onPointerUp = useCallback(() => setDragging(false), []);

  if (!active || !beforeUrl || !box) return null;

  const clipPercent = position * 100;

  // Room test in PIXELS, not percent: a chip is ~90px wide whatever the image
  // is, so "is there space for it" cannot be asked in percent. Below this the
  // chip fades rather than being sliced by its half's overflow clip.
  const LABEL_ROOM = 104;
  const originalRoom = box.width * position >= LABEL_ROOM;
  const editedRoom = box.width * (1 - position) >= LABEL_ROOM;

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
      />

      {/*
        SIDE LABELS. They used to be children of the divider and centred on it
        (`left-1/2 -translate-x-1/2`), which is why they could not be read: each
        chip sat half over the original and half over the edit, so it named
        NEITHER side — and stacked diagonally (one top, one bottom) there was
        nothing left tying either word to a picture. Centred on the line they
        also hung off the photo onto the workspace backdrop once the handle
        neared an edge.

        Now each chip lives inside its OWN half and says so four ways at once:
        position (fully on its side), a chevron pointing out into that side, a
        tab shape squared off against the divider and rounded on the outside,
        and colour (plain white = untouched, warm accent = the edit). Each half
        is its own overflow-clipped box, so a chip can never cross the divider
        or leave the image — the thing that put text on the canvas backdrop.
      */}
      <div className="absolute inset-x-0 top-3 flex items-start pointer-events-none select-none">
        <div
          className="flex min-w-0 justify-end overflow-hidden transition-opacity duration-150"
          style={{ width: `${clipPercent}%`, opacity: originalRoom ? 1 : 0 }}
        >
          <span
            className="flex items-center gap-1 py-1 pl-2 pr-1.5 rounded-l-md border-r-2 border-white bg-black/75 text-2xs text-white font-mono whitespace-nowrap"
            style={{ boxShadow: "0 1px 6px rgba(0,0,0,0.45)" }}
          >
            <ChevronLeft size={12} strokeWidth={2.5} aria-hidden="true" />
            Original
          </span>
        </div>
        <div
          className="flex min-w-0 justify-start overflow-hidden transition-opacity duration-150"
          style={{ width: `${100 - clipPercent}%`, opacity: editedRoom ? 1 : 0 }}
        >
          <span
            className="flex items-center gap-1 py-1 pl-1.5 pr-2 rounded-r-md border-l-2 border-white bg-black/75 text-2xs text-theme-primary font-mono whitespace-nowrap"
            style={{ boxShadow: "0 1px 6px rgba(0,0,0,0.45)" }}
          >
            Edited
            <ChevronRight size={12} strokeWidth={2.5} aria-hidden="true" />
          </span>
        </div>
      </div>
    </div>
  );
}
