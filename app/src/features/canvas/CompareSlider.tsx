import { useCallback, useEffect, useRef, useState, type MutableRefObject } from "react";
import { ChevronLeft, ChevronRight, ImageOff } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useOriginalImage } from "./useOriginalImage";
import { useCanvasBox } from "./useCanvasBox";
import { useUIStore } from "@/stores/useUIStore";
import { useToolStore } from "@/stores/useToolStore";
import { useGalleryStore } from "@/stores/useGalleryStore";
import { usePhotoBounds } from "@/hooks/usePhotoBounds";
import { comparePhotoRect } from "@/lib/comparePhotoRect";
import type { ImageHorseTool } from "stamp_tool";

interface CompareSliderProps {
  /** The canvas element rendering the current edited image — we mirror its bounding box. */
  canvasEl: HTMLCanvasElement | null;
  /** The engine, for `photo_bounds` — the overlay covers the photo, not the artboard. */
  toolRef: MutableRefObject<ImageHorseTool | null>;
  /** Pixel-change counter (`undoCount`): a resize, an undo or a flatten moves the photo. */
  revision: number;
  /** Screenshot compare's Slider view (Night 10-23): ANOTHER photo on the
   *  left instead of this one's original, open while it is mounted, with its
   *  own side names. Omitted: the top bar's A/B compare, as before. */
  source?: { url: string | null; left: string; right: string };
}

/** Handed to `usePhotoBounds` while compare is closed, so it asks the engine nothing. */
const NO_TOOL: MutableRefObject<ImageHorseTool | null> = { current: null };

/**
 * Squoosh-style A/B compare. Renders an overlay positioned exactly over the
 * PHOTO inside the canvas — not over the artboard around it (see `rect`). The
 * "before" layer fills that same box via background-size 100% 100%,
 * so both layers share one coordinate space regardless of zoom/pan.
 *
 * LEFT of the divider is the ORIGINAL (the before layer is clipped from the
 * right, so what survives is the left band); RIGHT is the EDITED canvas showing
 * through. Every part of the labeling below exists to say that without being
 * read twice — see the label block.
 */
export function CompareSlider({ canvasEl, toolRef, revision, source }: CompareSliderProps) {
  // The "before" original URL + whether compare is on now come from the UI store
  // (were prop-drilled AppShell → CanvasArea → here before stage 1).
  const storeUrl = useUIStore((s) => s.originalUrl);
  const storeActive = useUIStore((s) => s.compareActive);
  const beforeUrl = source ? source.url : storeUrl;
  const active = source ? true : storeActive;
  const setCompareActive = useUIStore((s) => s.setCompareActive);
  // Divider position lives in the store (see useUIStore) — it is the thing the
  // "re-center on close" rule resets, and a CanvasArea remount must not silently
  // move the handle back to the middle mid-comparison.
  const position = useUIStore((s) => s.comparePosition);
  const setPosition = useUIStore((s) => s.setComparePosition);
  const activeTool = useToolStore((s) => s.activeTool);
  // Asked only while compare is open — a closed slider must not add an engine
  // round trip to every stroke. Same revision AppShell's status bar reads.
  const layerRevision = useGalleryStore((s) => s.layerRevision);
  const photoBounds = usePhotoBounds(active ? toolRef : NO_TOOL, revision + layerRevision);
  const original = useOriginalImage(beforeUrl, active);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const box = useCanvasBox(canvasEl, active);

  // The toggle is the top bar's Compare button, so the overlay works over
  // every tool — except the Batch editor, whose edits go to every loaded photo
  // at once and have no single before/after to show. The button disables
  // there, so opening Batch closes the overlay rather than leaving it pinned
  // with nothing to switch it off.
  // (`activeTool === "emoji"` is the Batch group — its legacy id, shared by
  // all four of its sub-tools.)
  useEffect(() => {
    if (storeActive && activeTool === "emoji") setCompareActive(false);
  }, [storeActive, activeTool, setCompareActive]);

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

  // Nothing during the grace: a fast original shows no placeholder at all.
  // After it, the overlay opens with a skeleton where the original will be.
  if (!active || !box) return null;
  if (!original.ready && !original.failed && !original.showSkeleton) return null;

  // Over the whole canvas box, the original was stretched across the artboard
  // band on its half while the edit showed the band on the other — two sides
  // that differed in something nobody asked to compare. Inset to the photo, the
  // band shows through identically on both. Nothing in the document changes, so
  // closing compare has nothing to restore. Unknown bounds keep the full box.
  const rect = comparePhotoRect(box, canvasEl?.width ?? 0, canvasEl?.height ?? 0, photoBounds);

  const clipPercent = position * 100;

  // Room test in PIXELS, not percent: a chip is ~90px wide whatever the image
  // is, so "is there space for it" cannot be asked in percent. Below this the
  // chip fades rather than being sliced by its half's overflow clip.
  const LABEL_ROOM = 104;
  const originalRoom = rect.width * position >= LABEL_ROOM;
  const editedRoom = rect.width * (1 - position) >= LABEL_ROOM;

  return (
    <div
      ref={overlayRef}
      className="absolute z-20 cursor-col-resize select-none"
      style={{
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
        touchAction: "none",
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {/* "Before" layer — original stretched to exactly the canvas's rendered box.
          Until it has decoded: a skeleton in the same clipped band, or, if it
          is not coming, a plain statement of that. */}
      {original.ready && beforeUrl ? (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: `url(${beforeUrl})`,
            backgroundSize: "100% 100%",
            backgroundRepeat: "no-repeat",
            clipPath: `inset(0 ${100 - clipPercent}% 0 0)`,
          }}
        />
      ) : original.failed ? (
        // Sized to the Original half, not clipped from the whole box: centered
        // on the full photo, the message sat on the divider and was cut in
        // two ("Origina"). It fades with the side chip when the half is too
        // narrow to hold it.
        <div
          data-testid="compare-original-failed"
          className="absolute inset-y-0 left-0 flex items-center justify-center overflow-hidden bg-bg-elevated pointer-events-none"
          style={{ width: `${clipPercent}%` }}
        >
          <p
            className="flex items-center gap-2 whitespace-nowrap text-xs text-text-secondary transition-opacity duration-150"
            style={{ opacity: originalRoom ? 1 : 0 }}
          >
            <ImageOff className="size-4" aria-hidden />
            Original unavailable
          </p>
        </div>
      ) : (
        <>
          <Skeleton
            decorative
            data-testid="compare-original-skeleton"
            className="absolute inset-0 size-full pointer-events-none"
            style={{ clipPath: `inset(0 ${100 - clipPercent}% 0 0)` }}
          />
          <span role="status" className="sr-only">
            Loading the original photo
          </span>
        </>
      )}

      {/* Divider line */}
      <div
        className="absolute top-0 bottom-0 w-0.5 bg-on-photo pointer-events-none"
        style={{
          left: `${clipPercent}%`,
          transform: "translateX(-50%)",
          boxShadow: "0 0 8px rgba(0,0,0,0.5), 0 0 2px rgba(0,0,0,0.3)",
        }}
      />

      {/*
        SIDE LABELS. They used to be children of the divider and centered on it
        (`left-1/2 -translate-x-1/2`), which is why they could not be read: each
        chip sat half over the original and half over the edit, so it named
        NEITHER side — and stacked diagonally (one top, one bottom) there was
        nothing left tying either word to a picture. Centered on the line they
        also hung off the photo onto the workspace backdrop once the handle
        neared an edge.

        Now each chip lives inside its OWN half and says so four ways at once:
        position (fully on its side), a chevron pointing out into that side, a
        tab shape squared off against the divider and rounded on the outside,
        and color (plain white = untouched, warm accent = the edit). Each half
        is its own overflow-clipped box, so a chip can never cross the divider
        or leave the image — the thing that put text on the canvas backdrop.
      */}
      <div className="absolute inset-x-0 top-3 flex items-start pointer-events-none select-none">
        <div
          className="flex min-w-0 justify-end overflow-hidden transition-opacity duration-150"
          style={{ width: `${clipPercent}%`, opacity: originalRoom ? 1 : 0 }}
        >
          <span
            className="flex items-center gap-1 py-1 pl-2 pr-1.5 rounded-l-md border-r-2 border-on-photo bg-black/75 text-2xs text-on-photo font-mono whitespace-nowrap"
            style={{ boxShadow: "0 1px 6px rgba(0,0,0,0.45)" }}
          >
            <ChevronLeft size={12} strokeWidth={2.5} aria-hidden="true" />
            {source?.left ?? "Original"}
          </span>
        </div>
        <div
          className="flex min-w-0 justify-start overflow-hidden transition-opacity duration-150"
          style={{ width: `${100 - clipPercent}%`, opacity: editedRoom ? 1 : 0 }}
        >
          <span
            className="flex items-center gap-1 py-1 pl-1.5 pr-2 rounded-r-md border-l-2 border-on-photo bg-black/75 text-2xs text-theme-primary font-mono whitespace-nowrap"
            style={{ boxShadow: "0 1px 6px rgba(0,0,0,0.45)" }}
          >
            {source?.right ?? "Edited"}
            <ChevronRight size={12} strokeWidth={2.5} aria-hidden="true" />
          </span>
        </div>
      </div>
    </div>
  );
}
