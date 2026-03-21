import { useCallback, useEffect, useRef } from "react";
import type { CloneStampTool } from "stamp_tool";

interface PendingStamp {
  label: string;
  color: string;
}

interface UseRedStampToolOptions {
  toolRef: React.RefObject<CloneStampTool | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  flushToCanvas: () => void;
  syncState: () => void;
  active: boolean;
}

function renderStampPixels(
  label: string,
  color: string,
): { data: Uint8Array; w: number; h: number } | null {
  const fontSize = 48;
  const font = `bold ${fontSize}px "Arial Black", Impact, sans-serif`;

  // Measure text
  const measure = new OffscreenCanvas(1, 1);
  const mctx = measure.getContext("2d")!;
  mctx.font = font;
  const metrics = mctx.measureText(label);
  const textW = Math.ceil(metrics.width);
  const textH = fontSize;

  // Pad for border + rotation
  const pad = 20;
  const w = textW + pad * 2;
  const h = textH + pad * 2;

  const oc = new OffscreenCanvas(w, h);
  const ctx = oc.getContext("2d")!;

  // Rotate -5deg around center
  ctx.translate(w / 2, h / 2);
  ctx.rotate((-5 * Math.PI) / 180);
  ctx.translate(-w / 2, -h / 2);

  // Border rect
  const bx = pad / 2;
  const by = pad / 2;
  const bw = w - pad;
  const bh = h - pad;
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.strokeRect(bx, by, bw, bh);

  // Text
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.globalAlpha = 0.85;
  ctx.fillText(label, w / 2, h / 2);

  const imgData = ctx.getImageData(0, 0, w, h);
  return { data: new Uint8Array(imgData.data), w, h };
}

export function useRedStampTool({
  toolRef,
  canvasRef,
  flushToCanvas,
  syncState,
  active,
}: UseRedStampToolOptions) {
  const pendingStamp = useRef<PendingStamp | null>(null);

  useEffect(() => {
    if (!active) return;
    const handler = (e: CustomEvent<PendingStamp>) => {
      pendingStamp.current = { label: e.detail.label, color: e.detail.color };
    };
    window.addEventListener("red-stamp-select", handler as EventListener);
    return () =>
      window.removeEventListener("red-stamp-select", handler as EventListener);
  }, [active]);

  const onMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (e.button !== 0 || !pendingStamp.current) return;
      const tool = toolRef.current;
      const canvas = canvasRef.current;
      if (!tool || !canvas) return;

      const rect = canvas.getBoundingClientRect();
      const cx = ((e.clientX - rect.left) * canvas.width) / rect.width;
      const cy = ((e.clientY - rect.top) * canvas.height) / rect.height;

      const { label, color } = pendingStamp.current;
      const pixels = renderStampPixels(label, color);
      if (!pixels) return;

      const destX = Math.round(cx - pixels.w / 2);
      const destY = Math.round(cy - pixels.h / 2);

      tool.stamp_pixels(pixels.data, pixels.w, pixels.h, destX, destY);
      flushToCanvas();
      syncState();
    },
    [toolRef, canvasRef, flushToCanvas, syncState],
  );

  const onMouseMove = useCallback(() => {}, []);
  const onMouseUp = useCallback(() => {}, []);

  return { onMouseDown, onMouseMove, onMouseUp };
}
