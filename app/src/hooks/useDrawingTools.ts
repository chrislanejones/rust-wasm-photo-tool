// ===== FILE: app/src/hooks/useDrawingTools.ts =====
// Arrow, shape, and crop tool mouse interactions.
// - Live preview: JS canvas (restore snapshot + draw preview each frame)
// - Final commit: WASM draw_arrow/draw_shape on the WASM buffer directly
// - Key fix: NO load_image — that clears history. WASM buffer already has
//   the current image state. We just call begin_draw_stroke (saves undo),
//   then draw_arrow/draw_shape (modifies buffer), then flush to canvas.

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
      // Save JS canvas snapshot for live preview restore
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

      // Restore clean canvas for preview
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

  // () => void to match stamp.onMouseUp
  const onMouseUp = useCallback(() => {
    if (!isDrawing.current || !startPoint.current) return;
    isDrawing.current = false;

    const tool = toolRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    const start = startPoint.current;
    const end = lastPoint.current ?? start;

    if (activeTool === "crop") {
      // Restore clean image for crop selection display
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
        // Re-draw overlay so user sees the selection
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
      // ── KEY FIX: draw directly in WASM, no load_image ──
      // The WASM buffer already has the current image pixels.
      // 1. begin_draw_stroke saves undo snapshot from WASM buffer
      // 2. draw_arrow/draw_shape modifies the WASM buffer in place
      // 3. flushToCanvas copies WASM buffer → JS canvas
      // No load_image needed (that would clear history!)

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
        const shapeMap: Record<string, number> = {
          rect: 0,
          circle: 1,
          handCircle: 1,
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

/* ── JS Canvas Preview Helpers (lightweight, for drag feedback only) ── */

function drawArrowPreview(
  ctx: CanvasRenderingContext2D,
  from: Point,
  to: Point,
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
  from: Point,
  to: Point,
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

  switch (shape) {
    case "rect":
      ctx.beginPath();
      ctx.strokeRect(x, y, w, h);
      break;
    case "circle": {
      const r = Math.min(w, h) / 2;
      ctx.beginPath();
      ctx.arc(x + w / 2, y + h / 2, r, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }
    case "handCircle": {
      const cx = x + w / 2;
      const cy = y + h / 2;
      const rx = w / 2;
      const ry = h / 2;
      const pts = 50;
      const seed = from.x * 7 + from.y * 13;
      ctx.beginPath();
      for (let i = 0; i <= pts; i++) {
        const a = (2 * Math.PI * i) / pts;
        const noise = Math.sin(a * 3 + seed) * 3 + Math.cos(a * 5 + seed) * 2;
        const px = cx + (rx + noise) * Math.cos(a);
        const py = cy + (ry + noise) * Math.sin(a);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      break;
    }
    case "line":
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
      break;
  }
}
