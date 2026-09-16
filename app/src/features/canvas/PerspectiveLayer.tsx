// Everything the Perspective tool puts on the canvas, in one place: the state
// hook, the quad + handles, and the Apply / Reset / Cancel bar under it.
//
// WHY A COMPONENT AND NOT FORTY MORE LINES OF CanvasArea. CanvasArea is one of
// the four files the `max-lines` ratchet pins at today's size (2,950), and the
// rule for those is that they only shrink. The tool's wiring was already
// ~45 lines in there and this change roughly doubles it — targets for shapes
// as well as text, the action bar, the layer-change reset — so it moves out
// instead. Everything it needs is already on the props CanvasArea has to hand,
// and the results go back through `usePerspectiveStore`, so the move costs no
// prop drilling in either direction.
import { useMemo } from "react";
import type { ImageHorseTool } from "stamp_tool";
import { PerspectiveOverlay } from "./PerspectiveOverlay";
import { PerspectiveActionBar } from "./PerspectiveActionBar";
import { usePerspectiveTool } from "@/hooks/usePerspectiveTool";
import { usePerspectiveStore } from "@/stores/usePerspectiveStore";
import { useToolStore } from "@/stores/useToolStore";
import {
  basisOfShape,
  sameTarget,
  shapeKindLabel,
  type PerspectiveTargetBox,
} from "@/lib/perspectiveTarget";

interface Props {
  toolRef: React.RefObject<ImageHorseTool | null>;
  canvasEl: HTMLCanvasElement;
  syncState: () => void;
  flushToCanvas: () => void;
  /** Canvas size in image px. */
  imgW: number;
  imgH: number;
  /** Text annotation boxes on the ACTIVE layer (already tile-offset). */
  annotations: { id: number; x: number; y: number; tile_w: number; tile_h: number }[];
  /** Shape annotations on the ACTIVE layer. */
  shapes: { id: number; kind: number; x0: number; y0: number; x1: number; y1: number }[];
  /** A switch DROPS the target — see the note in `usePerspectiveTool`. */
  activeLayerId: number;
}

export function PerspectiveLayer({
  toolRef,
  canvasEl,
  syncState,
  flushToCanvas,
  imgW,
  imgH,
  annotations,
  shapes,
  activeLayerId,
}: Props) {
  const mode = useToolStore((s) => s.perspectiveMode);
  const target = usePerspectiveStore((s) => s.target);
  const setTarget = usePerspectiveStore((s) => s.setTarget);

  /**
   * Every vector object the tool can be pointed at, in one list.
   *
   * Both inputs are ALREADY layer-scoped — `get_text_annotations` and
   * `get_shape_annotations` answer for the active layer only — so this list is
   * exactly "what is on the layer I am working in", with no filtering of its
   * own to drift out of step with the engine's idea of active.
   */
  const targets = useMemo<PerspectiveTargetBox[]>(() => {
    const out: PerspectiveTargetBox[] = annotations.map((a) => ({
      kind: "text" as const,
      id: a.id,
      x: a.x,
      y: a.y,
      w: a.tile_w,
      h: a.tile_h,
      label: "Text",
    }));
    for (const s of shapes) {
      const b = basisOfShape(s);
      // A degenerate box has no interior to click and no basis to normalise
      // against — the engine refuses the warp for the same reason.
      if (b.w < 1 || b.h < 1) continue;
      out.push({
        kind: "shape",
        id: s.id,
        ...b,
        label: shapeKindLabel(s.kind),
      });
    }
    return out;
  }, [annotations, shapes]);

  const targetBox = useMemo(
    () => targets.find((o) => sameTarget(target, o)) ?? null,
    [targets, target],
  );

  const perspective = usePerspectiveTool({
    toolRef,
    syncState,
    flushToCanvas,
    target: targetBox,
    imgW,
    imgH,
    activeLayerId,
  });

  if (!perspective.quad || imgW <= 0 || imgH <= 0) return null;
  const r = canvasEl.getBoundingClientRect();
  const sx = r.width / canvasEl.width;
  const sy = r.height / canvasEl.height;
  const vector = perspective.targetLabel !== null;

  return (
    <>
      <PerspectiveOverlay
        rect={r}
        sx={sx}
        sy={sy}
        quad={perspective.quad}
        mode={mode}
        vector={vector}
        onChange={perspective.setQuad}
        // Pointer-up ends the GESTURE; it does not commit to the engine.
        // Applying on every release would make an exploratory drag
        // destructive, so the commit stays on Apply and this is only where a
        // drag stops.
        onCommit={() => {}}
        targets={targets}
        target={target}
        onTargetChange={setTarget}
      />
      <PerspectiveActionBar
        rect={r}
        sx={sx}
        sy={sy}
        quad={perspective.quad}
        valid={perspective.valid}
        dirty={perspective.dirty}
        targetLabel={perspective.targetLabel}
        onApply={() => void perspective.apply()}
        onReset={perspective.reset}
        onCancel={perspective.cancel}
      />
    </>
  );
}
