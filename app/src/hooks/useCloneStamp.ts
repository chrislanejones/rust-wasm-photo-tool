import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject, MouseEvent } from "react";
import type { CloneStampTool } from "stamp_tool";

export interface HistoryEntry {
  type: "undo" | "current" | "redo";
  label: string;
  index: number;
}

export interface CloneStampState {
  ready: boolean;
  hasSource: boolean;
  sourcePos: { x: number; y: number } | null;
  undoCount: number;
  redoCount: number;
  history: HistoryEntry[];
  zoom: number;
}

export function useCloneStamp(
  canvasRef: RefObject<HTMLCanvasElement | null>,
) {
  const toolRef = useRef<CloneStampTool | null>(null);
  const isDrawingRef = useRef(false);
  const sourcePosRef = useRef<{ x: number; y: number } | null>(null);

  const [state, setState] = useState<CloneStampState>({
    ready: false,
    hasSource: false,
    sourcePos: null,
    undoCount: 0,
    redoCount: 0,
    history: [],
    zoom: 1,
  });

  const syncState = useCallback(() => {
    const t = toolRef.current;
    if (!t) return;
    const history: HistoryEntry[] = t
      .history_labels()
      .split("|")
      .map((part: string, i: number) => {
        const colon = part.indexOf(":");
        return {
          type: part.slice(0, colon) as HistoryEntry["type"],
          label: part.slice(colon + 1),
          index: i,
        };
      });
    setState({
      ready: true,
      hasSource: t.has_source(),
      sourcePos: sourcePosRef.current,
      undoCount: t.undo_count(),
      redoCount: t.redo_count(),
      history,
      zoom: t.get_zoom(),
    });
  }, []);

  const flushToCanvas = useCallback(() => {
    const t = toolRef.current;
    const canvas = canvasRef.current;
    if (!t || !canvas) return;
    const ctx = canvas.getContext("2d")!;
    ctx.putImageData(
      new ImageData(
        new Uint8ClampedArray(t.get_image_data()),
        t.width(),
        t.height(),
      ),
      0,
      0,
    );
  }, [canvasRef]);

  const getCanvasCoords = useCallback(
    (e: MouseEvent<HTMLCanvasElement> | globalThis.MouseEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      return {
        x: Math.floor(
          ((e.clientX - rect.left) * canvas.width) / rect.width,
        ),
        y: Math.floor(
          ((e.clientY - rect.top) * canvas.height) / rect.height,
        ),
      };
    },
    [canvasRef],
  );

  const loadImage = useCallback(
    async (file: File) => {
      const { default: init, CloneStampTool: Tool } =
        await import("stamp_tool");
      await init();
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, img.width, img.height);
        const tool = new Tool(img.width, img.height);
        tool.load_image(new Uint8Array(imageData.data));
        toolRef.current = tool;
        sourcePosRef.current = null;
        URL.revokeObjectURL(url);
        syncState();
      };
      img.src = url;
    },
    [canvasRef, syncState],
  );

  const setBrushSize = useCallback((size: number) => {
    toolRef.current?.set_brush_size(size);
  }, []);

  const setHardness = useCallback((h: number) => {
    toolRef.current?.set_hardness(h);
  }, []);

  const setOpacity = useCallback((o: number) => {
    toolRef.current?.set_opacity(o);
  }, []);

  const setSpacing = useCallback((s: number) => {
    toolRef.current?.set_spacing(s);
  }, []);

  const undo = useCallback(() => {
    if (toolRef.current?.undo()) {
      flushToCanvas();
      syncState();
    }
  }, [flushToCanvas, syncState]);

  const redo = useCallback(() => {
    if (toolRef.current?.redo()) {
      flushToCanvas();
      syncState();
    }
  }, [flushToCanvas, syncState]);

  const jumpToHistory = useCallback(
    (index: number) => {
      if (toolRef.current?.jump_to_history(index)) {
        flushToCanvas();
        syncState();
      }
    },
    [flushToCanvas, syncState],
  );

  const deleteHistoryEntry = useCallback(
    (index: number) => {
      if (toolRef.current?.delete_history_entry(index)) {
        flushToCanvas();
        syncState();
      }
    },
    [flushToCanvas, syncState],
  );

  const clearHistory = useCallback(() => {
    toolRef.current?.clear_history();
    syncState();
  }, [syncState]);

  const exportPng = useCallback(() => {
    const t = toolRef.current;
    if (!t) return;
    const png = t.export_png();
    const blob = new Blob([new Uint8Array(png)], { type: "image/png" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "stamp-result.png";
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const onMouseDown = useCallback(
    (e: MouseEvent<HTMLCanvasElement>) => {
      const t = toolRef.current;
      if (!t) return;
      const { x, y } = getCanvasCoords(e);
      if (e.altKey) {
        t.set_source(x, y);
        sourcePosRef.current = { x, y };
        syncState();
        return;
      }
      if (!t.has_source()) return;
      isDrawingRef.current = true;
      t.begin_stroke(x, y);
      flushToCanvas();
    },
    [getCanvasCoords, flushToCanvas, syncState],
  );

  const onMouseMove = useCallback(
    (e: MouseEvent<HTMLCanvasElement>) => {
      if (!isDrawingRef.current) return;
      const t = toolRef.current;
      if (!t) return;
      const { x, y } = getCanvasCoords(e);
      t.continue_stroke(x, y);
      flushToCanvas();
    },
    [getCanvasCoords, flushToCanvas],
  );

  const onMouseUp = useCallback(() => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    toolRef.current?.end_stroke();
    syncState();
  }, [syncState]);

  useEffect(() => {
    const canvas = canvasRef.current;
    // Listen on the canvas wrapper (parent) so zoom works across the whole area
    const target = canvas?.parentElement ?? canvas;
    if (!target) return;
    const handler = (e: WheelEvent) => {
      if (!e.altKey || !toolRef.current) return;
      e.preventDefault();
      toolRef.current.adjust_zoom(e.deltaY < 0 ? 1 : -1);
      syncState();
    };
    target.addEventListener("wheel", handler, { passive: false });
    return () => target.removeEventListener("wheel", handler);
  }, [canvasRef, syncState]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "z") {
        e.shiftKey ? redo() : undo();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [undo, redo]);

  return {
    state,
    toolRef,
    loadImage,
    setBrushSize,
    setHardness,
    setOpacity,
    setSpacing,
    undo,
    redo,
    jumpToHistory,
    deleteHistoryEntry,
    clearHistory,
    exportPng,
    onMouseDown,
    onMouseMove,
    onMouseUp,
  };
}