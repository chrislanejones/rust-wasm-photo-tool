// Apply · Reset · Cancel, parked under the Perspective tool's selection box.
//
// WHY ON THE CANVAS AND NOT ONLY IN THE PANEL. The gesture happens here: the
// user drags a corner at the far side of the image and the buttons that commit
// or abandon it were three hundred pixels away in the sidebar, which is what
// made "I can't cancel the perspective" a real complaint rather than a missed
// keyboard shortcut. The panel keeps its copy — a canvas control that vanishes
// with the box is not somewhere to put the only way back — but the primary
// place to end a gesture is next to where the gesture is.
//
// DOM, NOT SVG, for the same reason `DuplicatePadOverlay` is: these are real
// <button>s, and they need focus, hover, aria-labels and a keyboard path, none
// of which an <svg> shape has. The container is pointer-transparent so it never
// eats a drag that starts near it.
//
// POSITIONING mirrors the overlay exactly — `position: fixed`, projected from
// the same live canvas rect and sx/sy — so it tracks pan and zoom with the
// quad instead of drifting away from it. It is clamped into the viewport
// because a quad dragged to the bottom edge would otherwise push its own
// controls off-screen.
import { Check, RotateCcw, X } from "lucide-react";
import type { Quad } from "@/lib/perspective";

interface Props {
  /** Live screen rect of the <canvas> — the same one the overlay projects from. */
  rect: DOMRect;
  /** Screen px per image px on each axis (= zoom). */
  sx: number;
  sy: number;
  /** The quad, in IMAGE pixel coords. The bar sits under its lowest corner. */
  quad: Quad;
  /** False while the corners cross — Apply is refused and says why. */
  valid: boolean;
  /** False before a handle has moved: nothing to apply, nothing to reset. */
  dirty: boolean;
  /** What is about to be transformed — "Square", "Text", … or null for the
   *  destructive pixel path. Only changes the wording. */
  targetLabel: string | null;
  onApply: () => void;
  onReset: () => void;
  onCancel: () => void;
}

/** Gap between the quad's lowest corner and the bar, in SCREEN px. */
const GAP_PX = 12;
/** Keep the bar this far inside the viewport edges. */
const MARGIN_PX = 8;

export function PerspectiveActionBar({
  rect,
  sx,
  sy,
  quad,
  valid,
  dirty,
  targetLabel,
  onApply,
  onReset,
  onCancel,
}: Props) {
  const xs = quad.map((p) => rect.left + p.x * sx);
  const ys = quad.map((p) => rect.top + p.y * sy);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const bottom = Math.max(...ys);

  const left = Math.min(
    Math.max(cx, MARGIN_PX + 110),
    window.innerWidth - MARGIN_PX - 110,
  );
  const top = Math.min(
    bottom + GAP_PX,
    window.innerHeight - MARGIN_PX - 40,
  );

  const what = targetLabel ?? "pixels";
  return (
    <div
      data-testid="perspective-actions"
      style={{
        position: "fixed",
        left,
        top,
        transform: "translateX(-50%)",
        zIndex: "var(--z-canvas-overlay)",
        pointerEvents: "none",
      }}
    >
      <div
        className="flex items-center gap-1 rounded-md border border-theme-sidebar-border bg-theme-sidebar px-1 py-1 shadow-lg"
        style={{ pointerEvents: "auto" }}
        role="group"
        aria-label="Perspective actions"
      >
        <BarButton
          onClick={onApply}
          disabled={!dirty || !valid}
          title={
            !valid
              ? "The corners cross — untangle the quad first"
              : `Apply the transform to ${what}`
          }
        >
          <Check aria-hidden className="size-4" /> Apply
        </BarButton>
        <BarButton
          onClick={onReset}
          disabled={!dirty}
          title="Reset the corners to a rectangle"
        >
          <RotateCcw aria-hidden className="size-4" /> Reset
        </BarButton>
        <BarButton onClick={onCancel} title="Cancel — remove the box (Esc)">
          <X aria-hidden className="size-4" /> Cancel
        </BarButton>
      </div>
    </div>
  );
}

/** One bar button. Kept local: it is this bar's spacing and nothing else's,
 *  and `ToolButton` is built for the sidebar's stacked grid, not for a row of
 *  three sitting on top of a photo. */
function BarButton({
  onClick,
  disabled,
  title,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      // `pointerdown` never reaches the canvas from here, but the overlay's
      // window-level drag listeners do not care about that — stopping it keeps
      // a mis-aimed click on a button from also starting a corner drag.
      onPointerDown={(e) => e.stopPropagation()}
      className="flex items-center gap-1 rounded px-2 py-1 text-xs text-theme-foreground hover:bg-theme-muted disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}
