// Screenshot compare's change list zooms the canvas to one change (Night
// 10-23). Out of CanvasArea to keep it under its max-lines cap. The pan is in
// useViewStore (Night 10-24).
//
// Zooming to a change sets a zoom AND a pan, and the pan is in zoomed px, so
// when Alt+0 reset the zoom only, the photo sat thousands of px off-screen with
// no way back but a reload (user tests 10-23, C8). Alt+0 zeroes the pan too
// now, and still: the view from before the FIRST zoom-to-change is kept and put
// back when compare ends — Done, Esc, or a photo switch — so leaving compare
// always leaves the photo where it was.
import { useCallback, useEffect, useRef } from "react";
import type { ImageHorseTool } from "stamp_tool";
import { useScreenshotCompareStore } from "@/stores/useScreenshotCompareStore";
import { useViewStore, type Pan } from "@/stores/useViewStore";
import { focusOn } from "@/lib/screenshotDiff";

interface Options {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  toolRef: React.RefObject<ImageHorseTool | null>;
  syncState: () => void;
  /** The open document's size, or null before one is loaded. */
  doc: { width: number; height: number } | null;
  zoom: number;
}

export function useCompareFocus({ canvasRef, toolRef, syncState, doc, zoom }: Options) {
  const comparing = useScreenshotCompareStore((s) => s.otherId !== null);
  const before = useRef<{ zoom: number; pan: Pan } | null>(null);

  const focusRegion = useCallback(
    (r: { x: number; y: number; w: number; h: number }) => {
      const el = canvasRef.current;
      const view = el && doc && focusOn(r, doc.width, doc.height, el.offsetWidth, el.offsetHeight);
      if (!view) return;
      before.current ??= { zoom, pan: useViewStore.getState().pan };
      void toolRef.current?.set_zoom(view.zoom);
      syncState();
      useViewStore.getState().setPan(view.pan);
    },
    [canvasRef, toolRef, syncState, doc, zoom],
  );

  useEffect(() => {
    const view = before.current;
    if (comparing || !view) return;
    before.current = null;
    void toolRef.current?.set_zoom(view.zoom);
    syncState();
    useViewStore.getState().setPan(view.pan);
  }, [comparing, toolRef, syncState]);

  return focusRegion;
}
