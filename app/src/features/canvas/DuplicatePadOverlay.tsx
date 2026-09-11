import { useEffect } from "react";

import type { PadDirection } from "@/lib/duplicatePadGeometry";
export type { PadDirection };

interface Props {
  /** The target shape's bbox in IMAGE px (any corner order). */
  target: { x0: number; y0: number; x1: number; y1: number };
  /** WASM image dims — percentages below are fractions of these. */
  width: number;
  height: number;
  /** The main canvas's fit-scaled CSS box — same reasoning as every other
   *  overlay: the container matches the canvas box so percentages land on the
   *  right pixels. */
  cssWidth?: number;
  cssHeight?: number;
  /** The main canvas's live pan/zoom; the pad rides the SAME transform. */
  panOffset: { x: number; y: number };
  zoom: number;
  onDuplicate: (dir: PadDirection) => void;
  onClose: () => void;
}

/** Screen px from the shape's edge to the centre of each ⊕. Kept small on
 *  purpose — the brief was "smaller and closer to the rectangle" than the
 *  mock, so the pad reads as part of the shape, not furniture around it. */
const PUSH_PX = 18;
const SIZE_PX = 22;

const DIRS: {
  dir: PadDirection;
  label: string;
  /** Anchor on the bbox as fractions (0..1) of its width/height. */
  ax: number;
  ay: number;
  /** Outward unit vector, applied in SCREEN px after the counter-scale. */
  dx: number;
  dy: number;
}[] = [
  { dir: "up", label: "Duplicate above", ax: 0.5, ay: 0, dx: 0, dy: -1 },
  { dir: "down", label: "Duplicate below", ax: 0.5, ay: 1, dx: 0, dy: 1 },
  { dir: "left", label: "Duplicate to the left", ax: 0, ay: 0.5, dx: -1, dy: 0 },
  { dir: "right", label: "Duplicate to the right", ax: 1, ay: 0.5, dx: 1, dy: 0 },
];

/**
 * The directional duplicate pad — four ⊕ buttons around a selected rect or
 * circle. Each press lays another same-sized copy further out in that
 * direction, so pressing ← twice gives two rectangles marching left. The
 * counting lives in `useDuplicatePad`; this component only places buttons.
 *
 * DOM, NOT CANVAS. Every other overlay here is an image-resolution canvas,
 * because it draws pixels. This one is four real `<button>`s — they need
 * focus, hover, aria-labels and a keyboard path, none of which a canvas has.
 *
 * Positioning is the same recipe as `SelectionOverlay`: an absolute sibling
 * sized to the canvas's fit-scaled box, riding the identical translate/scale
 * transform, so it stays pinned to the image while panning and zooming. The
 * buttons are then COUNTER-SCALED by `1/zoom` so they stay a constant screen
 * size, and pushed outward by `PUSH_PX` INSIDE that counter-scale, which is
 * what makes the push a screen distance rather than an image distance.
 *
 * The container is `pointer-events: none` so it never eats a canvas click;
 * only the buttons are interactive. Escape closes the pad.
 */
export function DuplicatePadOverlay({
  target,
  width,
  height,
  cssWidth,
  cssHeight,
  panOffset,
  zoom,
  onDuplicate,
  onClose,
}: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (width <= 0 || height <= 0) return null;

  const left = Math.min(target.x0, target.x1);
  const top = Math.min(target.y0, target.y1);
  const w = Math.abs(target.x1 - target.x0);
  const h = Math.abs(target.y1 - target.y0);
  const inv = 1 / Math.max(zoom, 0.01);

  return (
    <div
      aria-label="Duplicate pad"
      role="group"
      style={{
        position: "absolute",
        width: cssWidth ?? width,
        height: cssHeight ?? height,
        transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom})`,
        transformOrigin: "center center",
        pointerEvents: "none",
        // Above the lasso (25) — the pad is the thing you are using.
        zIndex: 26,
      }}
    >
      {DIRS.map(({ dir, label, ax, ay, dx, dy }) => (
        <button
          key={dir}
          type="button"
          aria-label={label}
          title={label}
          onClick={(e) => {
            e.stopPropagation();
            onDuplicate(dir);
          }}
          // Opacity is a core utility, so it always emits. The colour comes
          // from the theme CSS variable directly rather than a generated
          // colour utility, which can silently emit no rule at all when its
          // token does not exist (see CLAUDE.md on inert classes).
          className="opacity-60 hover:opacity-100 focus-visible:opacity-100 transition-opacity"
          style={{
            position: "absolute",
            left: `${((left + ax * w) / width) * 100}%`,
            top: `${((top + ay * h) / height) * 100}%`,
            width: SIZE_PX,
            height: SIZE_PX,
            transform: `translate(-50%, -50%) scale(${inv}) translate(${dx * PUSH_PX}px, ${dy * PUSH_PX}px)`,
            transformOrigin: "center center",
            borderRadius: "9999px",
            border: "none",
            background: "var(--primary)",
            color: "var(--primary-foreground)",
            font: "700 15px/1 system-ui, sans-serif",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            pointerEvents: "auto",
            boxShadow: "0 1px 3px rgba(0,0,0,.35)",
          }}
        >
          +
        </button>
      ))}
    </div>
  );
}
