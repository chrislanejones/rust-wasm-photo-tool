import { useCallback, useRef, useState } from "react";
import type { CloneStampTool } from "stamp_tool";

interface Point {
  x: number;
  y: number;
}

interface UseTextExtractOptions {
  toolRef: React.RefObject<CloneStampTool | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  active: boolean;
  flushToCanvas: () => void;
}

/**
 * Drag-to-OCR hook. When `active` is true, mouse events on the canvas
 * draw a dashed selection rectangle. On release, the selected region
 * is run through Tesseract.js OCR and the recognized text is returned.
 */
export function useTextExtract({
  toolRef: _toolRef,
  canvasRef,
  active,
  flushToCanvas,
}: UseTextExtractOptions) {
  const isDrawing = useRef(false);
  const startPoint = useRef<Point | null>(null);
  const lastPoint = useRef<Point | null>(null);
  const preSnapshot = useRef<ImageData | null>(null);
  const [recognizedText, setRecognizedText] = useState("");
  const [isRecognizing, setIsRecognizing] = useState(false);

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
      if (!active || e.button !== 0) return;
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx) return;
      const p = getCoords(e);
      isDrawing.current = true;
      startPoint.current = p;
      lastPoint.current = p;
      preSnapshot.current = ctx.getImageData(0, 0, canvas.width, canvas.height);
    },
    [active, canvasRef, getCoords],
  );

  const onMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!active || !isDrawing.current || !startPoint.current || !preSnapshot.current) {
        return;
      }
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx) return;
      const p = getCoords(e);
      lastPoint.current = p;
      const start = startPoint.current;
      ctx.putImageData(preSnapshot.current, 0, 0);
      const x = Math.min(start.x, p.x);
      const y = Math.min(start.y, p.y);
      const w = Math.abs(p.x - start.x);
      const h = Math.abs(p.y - start.y);
      ctx.fillStyle = "rgba(0, 120, 215, 0.18)";
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = "#4FA3FF";
      ctx.setLineDash([6, 4]);
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, w, h);
      ctx.setLineDash([]);
    },
    [active, canvasRef, getCoords],
  );

  const onMouseUp = useCallback(async () => {
    if (!active || !isDrawing.current || !startPoint.current) return;
    isDrawing.current = false;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    const start = startPoint.current;
    const end = lastPoint.current ?? start;
    startPoint.current = null;
    lastPoint.current = null;

    if (preSnapshot.current && ctx) {
      ctx.putImageData(preSnapshot.current, 0, 0);
    }
    preSnapshot.current = null;

    const x = Math.round(Math.min(start.x, end.x));
    const y = Math.round(Math.min(start.y, end.y));
    const w = Math.round(Math.abs(end.x - start.x));
    const h = Math.round(Math.abs(end.y - start.y));
    if (w < 5 || h < 5 || !canvas || !ctx) {
      flushToCanvas();
      return;
    }

    // Extract the region pixels from the canvas
    const regionData = ctx.getImageData(x, y, w, h);
    const tmpCanvas = document.createElement("canvas");
    tmpCanvas.width = w;
    tmpCanvas.height = h;
    const tmpCtx = tmpCanvas.getContext("2d")!;
    tmpCtx.putImageData(regionData, 0, 0);

    flushToCanvas();
    setIsRecognizing(true);
    setRecognizedText("");

    try {
      const Tesseract = await import("tesseract.js");
      const { data } = await Tesseract.recognize(tmpCanvas, "eng");
      setRecognizedText(data.text.trim());
    } catch {
      setRecognizedText("[OCR failed]");
    } finally {
      setIsRecognizing(false);
    }
  }, [active, canvasRef, flushToCanvas]);

  const clearText = useCallback(() => setRecognizedText(""), []);

  return {
    recognizedText,
    isRecognizing,
    onMouseDown,
    onMouseMove,
    onMouseUp,
    clearText,
  };
}
