// Numbered steps (pins, kind 5) that renumber themselves — the engine side is
// three calls in src/annotations.rs, each one undo step; the rules are in
// lib/pinSteps.ts. This hook drops, deletes and renumbers pins for
// useDrawingTools, and publishes the sequence and the Renumber action to
// useAnnotationStore for the Pins panel (which cannot reach the engine, and
// AppShell gains no props).
import { useCallback, useEffect } from "react";
import type { ImageHorseTool } from "stamp_tool";
import { useAnnotationStore } from "@/stores/useAnnotationStore";
import { nextAfterDrop, nextPinNumber, pinSequence } from "@/lib/pinSteps";
import type { Point, ShapeMeta } from "@/lib/drawEditState";
import type { ToolSettings } from "@/lib/types";

interface Options {
  toolRef: React.RefObject<ImageHorseTool | null>;
  settingsRef: React.RefObject<ToolSettings>;
  /** The active layer's shapes, as useDrawingTools last read them. */
  shapes: ShapeMeta[];
  /** Repaint, sync and re-read the shapes after an engine change. */
  afterChange: () => Promise<void>;
}

export function usePinSteps({ toolRef, settingsRef, shapes, afterChange }: Options) {
  const { max, gaps } = pinSequence(shapes);
  useEffect(() => {
    useAnnotationStore.getState().setPinSequence({ max, gaps });
  }, [max, gaps]);

  /** Drop a pin at `p`, numbered from the panel's Next field (default: after
   *  the last). A number inside the sequence inserts: the pins at and after it
   *  move up one. Diameter follows the Stroke Width slider; the label style
   *  (number vs letter) the Pins tab toggle. One "Add Pin" step. */
  const dropPin = useCallback(
    async (p: Point) => {
      const tool = toolRef.current;
      if (!tool) return;
      const s = settingsRef.current;
      // Map the 1-10 stroke-width slider to a callout-sized disc radius.
      const r = 8 + s.strokeWidth * 3;
      // Read fresh: `shapes` can trail a drop that has not refreshed yet.
      let last = 0;
      try {
        last = pinSequence(JSON.parse(await tool.get_shape_annotations()) as ShapeMeta[]).max;
      } catch {
        /* ignore parse errors — start from 1 */
      }
      const { pinNext, setPinNext } = useAnnotationStore.getState();
      const n = nextPinNumber(last, pinNext);
      tool.insert_pin_annotation(
        p.x - r, p.y - r, p.x + r, p.y + r,
        n, s.strokeColor, s.pinLabel === "letters" ? 1 : 0,
      );
      setPinNext(nextAfterDrop(n, last + 1, pinNext));
      await afterChange();
    },
    [toolRef, settingsRef, afterChange],
  );

  /** Close every gap on the active layer, in numbered order. One "Renumber
   *  Pins" step, or nothing when there is no gap. */
  const renumberPins = useCallback(async () => {
    const tool = toolRef.current;
    if (tool && (await tool.renumber_pins()) > 0) await afterChange();
  }, [toolRef, afterChange]);

  useEffect(() => {
    const { setRenumberPins } = useAnnotationStore.getState();
    setRenumberPins(() => void renumberPins());
    return () => setRenumberPins(null);
  }, [renumberPins]);

  return { dropPin };
}
