import { useCallback, useRef, useState } from "react";
import type { ToolType, ToolSettings } from "@/lib/types";
import type { CloneStampTool } from "stamp_tool";

interface Point {
  x: number;
  y: number;
}

export interface CropSelection {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface UseDrawingToolsOptions {
  toolRef: React.RefObject<CloneStampTool | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  activeTool: ToolType;
  settings: ToolSettings;
  flushToCanvas: () => void;
}

export function useDrawingTools({
  toolRef,
  canvasRef,
  activeTool,
  settings,
  flushToCanvas,
}: UseDrawingToolsOptions) {
  const isDrawing = useRef(false);
  const startPoint = useRef<Point | null>(null);
  const lastPoint = useRef<Point | null>(null);
  const preSnapshot = useRef<ImageData | null>(null);
  const [cropSelection, setCropSelection] = useState<CropSelection | null>(
    null,
  );

  const getCoords = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>): Point => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      return {
        x: ((e.clientX - rect.left) * canvas.width) / rect.width,
        y: ((e.clientY - rect.top) * canvas.height) / rect.height,
      };
    },
    [canvasRef],
  );

  const onMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (e.button !== 0) return;
      if (!["arrow", "shapes", "crop"].includes(activeTool)) return;
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx) return;
      const p = getCoords(e);
      isDrawing.current = true;
      startPoint.current = p;
      lastPoint.current = p;
      preSnapshot.current = ctx.getImageData(0, 0, canvas.width, canvas.height);
    },
    [activeTool, canvasRef, getCoords],
  );

  const onMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!isDrawing.current || !startPoint.current || !preSnapshot.current)
        return;
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx) return;
      const p = getCoords(e);
      lastPoint.current = p;
      const start = startPoint.current;
      ctx.putImageData(preSnapshot.current, 0, 0);

      if (activeTool === "arrow") {
        drawArrowPreview(
          ctx,
          start,
          p,
          settings.strokeColor,
          settings.strokeWidth,
          settings.arrowStyle,
        );
      } else if (activeTool === "shapes") {
        drawShapePreview(
          ctx,
          start,
          p,
          settings.shape ?? "rect",
          settings.strokeColor,
          settings.strokeWidth,
        );
      } else if (activeTool === "crop") {
        const x = Math.min(start.x, p.x);
        const y = Math.min(start.y, p.y);
        const w = Math.abs(p.x - start.x);
        const h = Math.abs(p.y - start.y);
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.fillRect(0, 0, canvas.width, y);
        ctx.fillRect(0, y + h, canvas.width, canvas.height - (y + h));
        ctx.fillRect(0, y, x, h);
        ctx.fillRect(x + w, y, canvas.width - (x + w), h);
        ctx.strokeStyle = "white";
        ctx.setLineDash([5, 5]);
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, w, h);
        ctx.setLineDash([]);
      }
    },
    [activeTool, canvasRef, getCoords, settings],
  );

  const onMouseUp = useCallback(() => {
    if (!isDrawing.current || !startPoint.current) return;
    isDrawing.current = false;
    const tool = toolRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    const start = startPoint.current;
    const end = lastPoint.current ?? start;

    if (activeTool === "crop") {
      if (preSnapshot.current && ctx) {
        ctx.putImageData(preSnapshot.current, 0, 0);
      }
      const x = Math.min(start.x, end.x);
      const y = Math.min(start.y, end.y);
      const w = Math.abs(end.x - start.x);
      const h = Math.abs(end.y - start.y);
      if (w > 5 && h > 5) {
        setCropSelection({
          x: Math.round(x),
          y: Math.round(y),
          width: Math.round(w),
          height: Math.round(h),
        });
        if (ctx && canvas) {
          ctx.fillStyle = "rgba(0,0,0,0.5)";
          ctx.fillRect(0, 0, canvas.width, y);
          ctx.fillRect(0, y + h, canvas.width, canvas.height - (y + h));
          ctx.fillRect(0, y, x, h);
          ctx.fillRect(x + w, y, canvas.width - (x + w), h);
          ctx.strokeStyle = "white";
          ctx.setLineDash([5, 5]);
          ctx.lineWidth = 1;
          ctx.strokeRect(x, y, w, h);
          ctx.setLineDash([]);
        }
      }
    } else if (tool && (activeTool === "arrow" || activeTool === "shapes")) {
      if (activeTool === "arrow") {
        tool.begin_draw_stroke("Arrow");
        tool.draw_arrow(
          start.x,
          start.y,
          end.x,
          end.y,
          settings.strokeColor,
          settings.strokeWidth,
          settings.arrowStyle === "double" ? 1 : 0,
        );
      } else {
        // Shape map: 0=rect, 1=circle, 2=line, 3=handCircle (Rust)
        const shapeMap: Record<string, number> = {
          rect: 0,
          circle: 1,
          handCircle: 3,
          line: 2,
        };
        tool.begin_draw_stroke("Shape");
        tool.draw_shape(
          start.x,
          start.y,
          end.x,
          end.y,
          shapeMap[settings.shape ?? "rect"] ?? 0,
          settings.strokeColor,
          settings.strokeWidth,
        );
      }
      flushToCanvas();
    }
    startPoint.current = null;
    lastPoint.current = null;
    preSnapshot.current = null;
  }, [activeTool, toolRef, canvasRef, settings, flushToCanvas]);

  const applyCrop = useCallback(() => {
    const tool = toolRef.current;
    const sel = cropSelection;
    if (!tool || !sel) return;
    tool.crop(sel.x, sel.y, sel.width, sel.height);
    flushToCanvas();
    setCropSelection(null);
  }, [toolRef, cropSelection, flushToCanvas]);

  return {
    onMouseDown,
    onMouseMove,
    onMouseUp,
    cropSelection,
    applyCrop,
    clearCropSelection: () => setCropSelection(null),
  };
}

/* ------------------------------------------------------------------ */
/* JS preview functions (used during drag only, not committed)         */
/* These run on Canvas2D for real-time feedback. The Rust commit        */
/* happens in onMouseUp above via tool.draw_arrow / tool.draw_shape.   */
/* ------------------------------------------------------------------ */

function drawArrowPreview(
  ctx: CanvasRenderingContext2D,
  from: { x: number; y: number },
  to: { x: number; y: number },
  color: string,
  width: number,
  style: "single" | "double",
) {
  const headLength = Math.max(20, width * 3);
  const headWidth = Math.PI / 5;
  const angle = Math.atan2(to.y - from.y, to.x - from.x);

  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  const endX = to.x - headLength * 0.5 * Math.cos(angle);
  const endY = to.y - headLength * 0.5 * Math.sin(angle);
  const startX =
    style === "double" ? from.x + headLength * 0.5 * Math.cos(angle) : from.x;
  const startY =
    style === "double" ? from.y + headLength * 0.5 * Math.sin(angle) : from.y;

  ctx.beginPath();
  ctx.moveTo(startX, startY);
  ctx.lineTo(endX, endY);
  ctx.stroke();

  const drawHead = (x: number, y: number, a: number) => {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(
      x - headLength * Math.cos(a - headWidth),
      y - headLength * Math.sin(a - headWidth),
    );
    ctx.lineTo(
      x - headLength * Math.cos(a + headWidth),
      y - headLength * Math.sin(a + headWidth),
    );
    ctx.closePath();
    ctx.fill();
  };

  drawHead(to.x, to.y, angle);
  if (style === "double") drawHead(from.x, from.y, angle + Math.PI);
}

function drawShapePreview(
  ctx: CanvasRenderingContext2D,
  from: { x: number; y: number },
  to: { x: number; y: number },
  shape: string,
  color: string,
  width: number,
) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  const x = Math.min(from.x, to.x);
  const y = Math.min(from.y, to.y);
  const w = Math.abs(to.x - from.x);
  const h = Math.abs(to.y - from.y);

  ctx.beginPath();

  switch (shape) {
    case "rect":
      ctx.strokeRect(x, y, w, h);
      break;

    case "circle": {
      const r = Math.min(w, h) / 2;
      ctx.arc(x + w / 2, y + h / 2, r, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }

    case "handCircle": {
      // Hand-drawn circle preview — wobbly ellipse with tail
      const cx = x + w / 2;
      const cy = y + h / 2;
      const rx = w / 2;
      const ry = h / 2;
      const points = 60;

      const startOffset = (from.x * 31.17 + from.y * 47.53) % (Math.PI * 2);
      const mainArc = Math.PI * 2 - Math.PI * 0.15;
      const seed =
        from.x * 31.17 + from.y * 47.53 + to.x * 13.91 + to.y * 67.37;

      const getNoise = (angle: number) =>
        Math.sin(angle * 2.3 + seed) * 3 +
        Math.sin(angle * 1.1 + seed * 0.7) * 2 +
        Math.cos(angle * 3.7 + seed * 1.3) * 1.5;

      const tilt = (((seed * 1000) % 1000) / 1000 - 0.5) * 0.15;

      // Tail
      const tailLength = Math.PI * 0.3;
      ctx.beginPath();
      for (let i = 0; i <= 10; i++) {
        const t = i / 10;
        const angle = startOffset - tailLength * (1 - t);
        const noise = getNoise(angle) * t;
        const squeeze = 1 + Math.sin(angle * 2 + seed) * 0.03;
        const inward = (1 - t) * (rx * 0.15);
        const px =
          cx + (rx * squeeze - inward + noise) * Math.cos(angle + tilt);
        const py =
          cy + (ry / squeeze - inward + noise) * Math.sin(angle + tilt);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }

      // Main circle
      for (let i = 0; i <= points; i++) {
        const t = i / points;
        const angle = startOffset + t * mainArc;
        const noise = getNoise(angle);
        const squeeze = 1 + Math.sin(angle * 2 + seed) * 0.03;
        const px = cx + (rx * squeeze + noise) * Math.cos(angle + tilt);
        const py = cy + (ry / squeeze + noise) * Math.sin(angle + tilt);
        ctx.lineTo(px, py);
      }
      ctx.stroke();
      break;
    }

    case "line":
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
      break;
  }
}
