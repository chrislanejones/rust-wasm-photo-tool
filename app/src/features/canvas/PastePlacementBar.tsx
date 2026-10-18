// Resize & Compress, parked under a pasted image's bounding box.
//
// Same CanvasActionBar as the Perspective quad and the shape bar: the look,
// clamping and pointer rules live in components/ui/canvas-action-bar.tsx. This
// file only decides where the bar hangs (under the box's lowest corner, rotated
// with it, projected from the live canvas rect so it tracks pan and zoom) and
// what it carries.
//
// Why the button exists: a pasted screenshot is often 4K, laid on a photo to
// explain something. All those pixels are dead weight, and they make every drag
// frame slow. One click resamples the paste down to the size it is shown at,
// or to half that when it already fits 1:1.
import { Minimize2 } from "lucide-react";
import {
  CanvasActionBar,
  CanvasActionBarButton,
  CanvasActionBarText,
} from "@/components/ui/canvas-action-bar";
import { boxCorners, type PastePlacementRect } from "@/hooks/usePastePlacementTool";

interface Props {
  rect: PastePlacementRect | null;
  /** Size of the bytes behind the box; null for Resize Layer (nothing to compress). */
  sourceSize: { w: number; h: number } | null;
  canCompress: boolean;
  onCompress: () => void;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
}

/** Gap between the box's lowest corner and the bar, in SCREEN px. */
const GAP_PX = 12;

export function PastePlacementBar({ rect, sourceSize, canCompress, onCompress, canvasRef }: Props) {
  const canvas = canvasRef.current;
  if (!rect || !sourceSize || !canvas) return null;
  const r = canvas.getBoundingClientRect();
  const sx = r.width / canvas.width;
  const sy = r.height / canvas.height;
  const corners = boxCorners(rect).map((p) => ({ x: r.left + p.x * sx, y: r.top + p.y * sy }));
  const xs = corners.map((p) => p.x);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const bottom = Math.max(...corners.map((p) => p.y));

  return (
    // A pointerdown outside `[data-paste-overlay]` commits the paste; the bar
    // is part of the placement, so it must not count as "outside".
    <div data-paste-overlay="true">
      <CanvasActionBar
        x={cx}
        y={bottom + GAP_PX}
        label="Pasted image actions"
        data-testid="paste-actions"
      >
        <CanvasActionBarButton
          onClick={onCompress}
          disabled={!canCompress}
          title="Resize & Compress — keep only the pixels you need"
        >
          <Minimize2 aria-hidden className="size-4" /> Resize &amp; Compress
        </CanvasActionBarButton>
        <CanvasActionBarText>
          {sourceSize.w} × {sourceSize.h}
        </CanvasActionBarText>
      </CanvasActionBar>
    </div>
  );
}
