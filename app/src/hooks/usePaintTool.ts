import { useCallback, useMemo, useRef } from "react";
import type { ImageHorseTool } from "stamp_tool";
import type { ToolSettings } from "@/lib/types";

/** Stabilizer strength → leash length (px). Off bypasses the stabilizer. */
const STAB_LEASH: Record<ToolSettings["paintStabilizer"], number> = {
  off: 0,
  low: 12,
  med: 22,
  high: 36,
};

function parseHex(hex: string) {
  const h = hex.replace("#", "");
  return {
    r: parseInt(h.slice(0, 2), 16) || 0,
    g: parseInt(h.slice(2, 4), 16) || 0,
    b: parseInt(h.slice(4, 6), 16) || 0,
  };
}

interface Opts {
  toolRef: React.RefObject<ImageHorseTool | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  settings: ToolSettings;
  flushToCanvas: () => void;
  syncState: () => void;
}

export function usePaintTool({
  toolRef,
  canvasRef,
  settings,
  flushToCanvas,
  syncState,
}: Opts) {
  const painting = useRef(false);
  // `last` is the previously painted point (raw 1:1 path only). With the
  // stabilizer on, the trailing tip lives in Rust; `rawCursor` tracks the true
  // pointer so Rust can "catch up" to it on mouse-up.
  const last = useRef<{ x: number; y: number } | null>(null);
  const rawCursor = useRef<{ x: number; y: number } | null>(null);

  // Memoize the parsed brush colour: every paint dab + stroke segment
  // re-reads it, so we want to skip the parseInt-x3 cost per mouse event
  // (only re-parse when the hex actually changes).
  const brushRgb = useMemo(
    () => parseHex(settings.brushColor),
    [settings.brushColor],
  );

  const coords = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const c = canvasRef.current;
      if (!c) return { x: 0, y: 0 };
      const r = c.getBoundingClientRect();
      return {
        x: ((e.clientX - r.left) * c.width) / r.width,
        y: ((e.clientY - r.top) * c.height) / r.height,
      };
    },
    [canvasRef],
  );

  const onMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const t = toolRef.current;
      if (!t || e.button !== 0) return;
      painting.current = true;
      const { x, y } = coords(e);
      last.current = { x, y };
      rawCursor.current = { x, y };
      const { r, g, b } = brushRgb;
      t.paint_begin();
      t.paint_dab(
        x,
        y,
        settings.brushSize / 2,
        r,
        g,
        b,
        settings.brushOpacity / 100,
      );
      if (settings.paintStabilizer !== "off") t.paint_stab_begin(x, y);
      flushToCanvas();
    },
    [
      toolRef,
      coords,
      brushRgb,
      settings.brushSize,
      settings.brushOpacity,
      settings.paintStabilizer,
      flushToCanvas,
    ],
  );

  const onMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!painting.current) return;
      const t = toolRef.current;
      if (!t) return;
      const { x, y } = coords(e);
      rawCursor.current = { x, y };
      const { r, g, b } = brushRgb;
      const radius = settings.brushSize / 2;
      const opacity = settings.brushOpacity / 100;
      const stab = settings.paintStabilizer;

      if (stab !== "off") {
        // Pulled-string "lazy mouse" — the trailing tip and leash math live in
        // Rust (paint_stab_to). It only paints when the cursor clears the leash.
        if (t.paint_stab_to(x, y, STAB_LEASH[stab], radius, r, g, b, opacity)) {
          flushToCanvas();
        }
        return;
      }

      if (!last.current) return;
      const p = last.current;
      t.paint_stroke_to(p.x, p.y, x, y, radius, r, g, b, opacity);
      flushToCanvas();
      last.current = { x, y };
    },
    [
      toolRef,
      coords,
      brushRgb,
      settings.brushSize,
      settings.brushOpacity,
      settings.paintStabilizer,
      flushToCanvas,
    ],
  );

  const onMouseUp = useCallback(() => {
    if (!painting.current) return;
    painting.current = false;
    const t = toolRef.current;
    // Stabilizer catch-up (in Rust): draw the final segment to where the cursor
    // actually is so the stroke ends under the pointer, then clear the tip.
    if (t && settings.paintStabilizer !== "off" && rawCursor.current) {
      const { r, g, b } = brushRgb;
      const raw = rawCursor.current;
      if (
        t.paint_stab_flush(
          raw.x, raw.y,
          settings.brushSize / 2, r, g, b, settings.brushOpacity / 100,
        )
      ) {
        flushToCanvas();
      }
    }
    last.current = null;
    rawCursor.current = null;
    syncState();
  }, [
    toolRef,
    brushRgb,
    settings.brushSize,
    settings.brushOpacity,
    settings.paintStabilizer,
    flushToCanvas,
    syncState,
  ]);

  return { onMouseDown, onMouseMove, onMouseUp };
}
