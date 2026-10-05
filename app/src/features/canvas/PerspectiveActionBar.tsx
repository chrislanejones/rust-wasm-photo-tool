// Apply · Reset · Cancel, parked under the Perspective / Distort / Skew quad.
//
// The gesture happens on the canvas, so the buttons that commit or abandon it
// sit next to it; the panel keeps its copy. The look, clamping and pointer
// rules live in components/ui/canvas-action-bar.tsx, shared with Batch. This
// file only decides where the bar hangs (under the quad's lowest corner,
// projected from the same live canvas rect and sx/sy as the overlay, so it
// tracks pan and zoom) and which buttons it carries.
import { Check, RotateCcw, X } from "lucide-react";
import {
  CanvasActionBar,
  CanvasActionBarButton,
} from "@/components/ui/canvas-action-bar";
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

  const what = targetLabel ?? "pixels";
  return (
    <CanvasActionBar
      x={cx}
      y={bottom + GAP_PX}
      label="Perspective actions"
      data-testid="perspective-actions"
    >
      <CanvasActionBarButton
        onClick={onApply}
        disabled={!dirty || !valid}
        title={
          !valid
            ? "The corners cross — untangle the quad first"
            : `Apply the transform to ${what}`
        }
      >
        <Check aria-hidden className="size-4" /> Apply
      </CanvasActionBarButton>
      <CanvasActionBarButton
        onClick={onReset}
        disabled={!dirty}
        title="Reset the corners to a rectangle"
      >
        <RotateCcw aria-hidden className="size-4" /> Reset
      </CanvasActionBarButton>
      <CanvasActionBarButton onClick={onCancel} title="Cancel — remove the box (Esc)">
        <X aria-hidden className="size-4" /> Cancel
      </CanvasActionBarButton>
    </CanvasActionBar>
  );
}
