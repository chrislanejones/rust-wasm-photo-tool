import { useCallback, useRef, useState } from "react";
import type { CloneStampTool } from "stamp_tool";

const RADIUS = 5; // 11×11 pixel grid

function rgbaToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

interface UseColorPickerOptions {
  toolRef: React.RefObject<CloneStampTool | null>;
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

  const onMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!active) return;
      const tool = toolRef.current;
      const coords = getCanvasCoords(e);
      if (!tool || !coords) return;
      const { canvasX, canvasY, screenX, screenY } = coords;
      lastPos.current = { canvasX, canvasY };
      const pixels = tool.get_pixel_region(canvasX, canvasY, RADIUS);
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
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!active || e.button !== 0) return;
      const tool = toolRef.current;
      const coords = getCanvasCoords(e);
      if (!tool || !coords) return;
      const px = tool.get_pixel(coords.canvasX, coords.canvasY);
      const hex = rgbaToHex(px[0] ?? 0, px[1] ?? 0, px[2] ?? 0);
      onPickColor(hex);
    },
    [active, toolRef, getCanvasCoords, onPickColor],
  );

  return { magnifier, onMouseMove, onMouseLeave, onMouseDown, RADIUS };
}
