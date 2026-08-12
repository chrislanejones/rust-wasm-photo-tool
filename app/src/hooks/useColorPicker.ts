import { useCallback, useRef, useState } from "react";
import type { ImageHorseTool } from "stamp_tool";

const RADIUS = 5; // 11×11 pixel grid

function rgbaToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

interface UseColorPickerOptions {
  toolRef: React.RefObject<ImageHorseTool | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  containerRef: React.RefObject<HTMLDivElement | null>;
  active: boolean;
  onPickColor: (hex: string) => void;
}

export interface MagnifierState {
  /** Screen position of the cursor inside the container */
  screenX: number;
  screenY: number;
  /** Pixel grid from Rust: flat RGBA, side = 2*RADIUS+1 */
  pixels: Uint8Array;
  /** Hex color of the center pixel */
  centerColor: string;
  visible: boolean;
}

export function useColorPicker({
  toolRef,
  canvasRef,
  containerRef,
  active,
  onPickColor,
}: UseColorPickerOptions) {
  const [magnifier, setMagnifier] = useState<MagnifierState>({
    screenX: 0,
    screenY: 0,
    pixels: new Uint8Array(0),
    centerColor: "#000000",
    visible: false,
  });

  const lastPos = useRef<{ canvasX: number; canvasY: number } | null>(null);

  const getCanvasCoords = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return null;
      const cr = canvas.getBoundingClientRect();
      const ctr = container.getBoundingClientRect();
      const canvasX = Math.round(((e.clientX - cr.left) * canvas.width) / cr.width);
      const canvasY = Math.round(((e.clientY - cr.top) * canvas.height) / cr.height);
      const screenX = e.clientX - ctr.left;
      const screenY = e.clientY - ctr.top;
      return { canvasX, canvasY, screenX, screenY };
    },
    [canvasRef, containerRef],
  );

  // ── ADR-024 a10 ─────────────────────────────────────────────────────────
  //
  // `get_pixel_region` is a pure read feeding the magnifier, so this is the
  // DROP-STALE shape (like `handleLassoMove`, unlike `usePaintTool`): a
  // superseded magnifier frame is worthless and skipping it costs nothing.
  //
  // Un-awaited this fails in the quietest way of any site in a10. `pixels`
  // would be a Promise, `pixels[centerIdx]` would be `undefined`, and the
  // `?? 0` right below turns that into 0 — so the magnifier would show a
  // confident, perfectly rendered BLACK swatch over every part of the image.
  // No throw, no NaN, nothing in the console. `tsc` cannot help either: it is
  // indexing an object, which is legal.
  const pickSeq = useRef(0);

  const onMouseMove = useCallback(
    async (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!active) return;
      const tool = toolRef.current;
      const coords = getCanvasCoords(e);
      if (!tool || !coords) return;
      const { canvasX, canvasY, screenX, screenY } = coords;
      lastPos.current = { canvasX, canvasY };
      const seq = ++pickSeq.current;
      const pixels = await tool.get_pixel_region(canvasX, canvasY, RADIUS);
      if (seq !== pickSeq.current) return; // a later move owns the magnifier
      const side = 2 * RADIUS + 1;
      const centerIdx = (Math.floor(side / 2) * side + Math.floor(side / 2)) * 4;
      const r = pixels[centerIdx] ?? 0;
      const g = pixels[centerIdx + 1] ?? 0;
      const b = pixels[centerIdx + 2] ?? 0;
      setMagnifier({ screenX, screenY, pixels, centerColor: rgbaToHex(r, g, b), visible: true });
    },
    [active, toolRef, getCanvasCoords],
  );

  const onMouseLeave = useCallback(() => {
    setMagnifier((prev) => ({ ...prev, visible: false }));
  }, []);

  const onMouseDown = useCallback(
    async (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!active || e.button !== 0) return;
      const tool = toolRef.current;
      const coords = getCanvasCoords(e);
      // Every read off the event happens BEFORE the await, deliberately: after
      // one, `e` is only safe for the values already destructured out of it.
      if (!tool || !coords) return;
      const px = await tool.get_pixel(coords.canvasX, coords.canvasY);
      const hex = rgbaToHex(px[0] ?? 0, px[1] ?? 0, px[2] ?? 0);
      onPickColor(hex);
    },
    [active, toolRef, getCanvasCoords, onPickColor],
  );

  return { magnifier, onMouseMove, onMouseLeave, onMouseDown, RADIUS };
}
