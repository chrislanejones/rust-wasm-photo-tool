import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject, MouseEvent } from "react";
import type { CloneStampTool } from "stamp_tool";
import type { SavedEdit } from "@/lib/editPersistence";

/** Decode a PNG Uint8Array → raw RGBA via an OffscreenCanvas. */
async function decodePngToRgba(
  png: Uint8Array,
): Promise<{ rgba: Uint8ClampedArray; w: number; h: number }> {
  const blob = new Blob([png], { type: "image/png" });
  const bitmap = await createImageBitmap(blob);
  const { width: w, height: h } = bitmap;
  const oc = new OffscreenCanvas(w, h);
  const ctx = oc.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  return { rgba: ctx.getImageData(0, 0, w, h).data, w, h };
}

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
  // Exposed so components can re-render when dimensions change (e.g. after rotate)
  width: number;
  height: number;
  /** True if the loaded image contains any transparent pixels (from Rust alpha scan). */
  hasTransparency: boolean;
}

export function useCloneStamp(canvasRef: RefObject<HTMLCanvasElement | null>) {
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
    width: 0,
    height: 0,
    hasTransparency: false,
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
      width: t.width(),
      height: t.height(),
      hasTransparency: t.has_transparency(),
    });
  }, []);

  const flushToCanvas = useCallback(() => {
    const t = toolRef.current;
    const canvas = canvasRef.current;
    if (!t || !canvas) return;
    // Resize canvas if dimensions changed (e.g. after rotate_90_cw)
    if (canvas.width !== t.width() || canvas.height !== t.height()) {
      canvas.width = t.width();
      canvas.height = t.height();
    }
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
        x: Math.floor(((e.clientX - rect.left) * canvas.width) / rect.width),
        y: Math.floor(((e.clientY - rect.top) * canvas.height) / rect.height),
      };
    },
    [canvasRef],
  );

  // ── Image loading ─────────────────────────────────────────────────────────
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

  /**
   * Restore a previously-persisted photo session: canvas pixels + undo/redo
   * history. Snapshots are stored as PNGs; each is decoded back to raw RGBA
   * before being injected into the WASM history stack.
   */
  const loadFromSaved = useCallback(
    async (saved: SavedEdit) => {
      const { default: init, CloneStampTool: Tool } = await import("stamp_tool");
      await init();

      // Decode current canvas PNG → raw RGBA
      const { rgba: canvasRgba } = await decodePngToRgba(saved.canvasPng);

      // Construct a fresh tool at the saved dimensions and load the canvas
      const tool = new Tool(saved.canvasW, saved.canvasH);
      tool.load_image(new Uint8Array(canvasRgba.buffer as ArrayBuffer)); // clears history

      // Re-inject undo snapshots (oldest first — preserves original order)
      for (const snap of saved.undoStack) {
        const { rgba, w, h } = await decodePngToRgba(snap.png);
        tool.inject_undo_snapshot(
          new Uint8Array(rgba.buffer as ArrayBuffer),
          w,
          h,
          snap.label,
        );
      }

      // Re-inject redo snapshots
      for (const snap of saved.redoStack) {
        const { rgba, w, h } = await decodePngToRgba(snap.png);
        tool.inject_redo_snapshot(
          new Uint8Array(rgba.buffer as ArrayBuffer),
          w,
          h,
          snap.label,
        );
      }

      toolRef.current = tool;
      sourcePosRef.current = null;

      const canvas = canvasRef.current;
      if (canvas) {
        canvas.width = saved.canvasW;
        canvas.height = saved.canvasH;
      }

      flushToCanvas();
      syncState();
    },
    [canvasRef, flushToCanvas, syncState],
  );

  // ── Basic tool setters ───────────────────────────────────────────────────
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

  // ── History ───────────────────────────────────────────────────────────────
  const undo = useCallback(() => {
    if (toolRef.current?.undo()) {
      flushToCanvas();
      syncState();
    }
  }, [flushToCanvas, syncState]);

  const redo = useCallback(() => {
    console.log("Redo function called, redoCount:", state.redoCount);
    if (toolRef.current?.redo()) {
      console.log("Redo successful");
      flushToCanvas();
      syncState();
    } else {
      console.log("Redo failed or no redo available");
    }
  }, [flushToCanvas, syncState, state.redoCount]);

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

  // ── Export ────────────────────────────────────────────────────────────────
  // Derive a download filename: strip original extension, append "-revised" + new ext.
  function revisedName(sourceName: string, ext: string): string {
    const stem = sourceName.replace(/\.[^.]+$/, "");
    return `${stem}-revised${ext}`;
  }

  const exportPng = useCallback((sourceName = "image") => {
    const t = toolRef.current;
    if (!t) return;
    const png = t.export_png();
    const blob = new Blob([new Uint8Array(png)], { type: "image/png" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = revisedName(sourceName, ".png");
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const exportAs = useCallback(
    (format: "png" | "jpeg" | "webp" | "avif", quality: number = 0.92, sourceName = "image") => {
      if (format === "png") {
        exportPng(sourceName);
        return;
      }
      const canvas = canvasRef.current;
      if (!canvas) return;
      const mimeMap: Record<string, string> = {
        jpeg: "image/jpeg",
        webp: "image/webp",
        avif: "image/avif",
      };
      const extMap: Record<string, string> = {
        jpeg: ".jpg",
        webp: ".webp",
        avif: ".avif",
      };
      canvas.toBlob(
        (blob) => {
          if (!blob) return;
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = revisedName(sourceName, extMap[format]);
          a.click();
          URL.revokeObjectURL(url);
        },
        mimeMap[format],
        quality,
      );
    },
    [canvasRef, exportPng],
  );

  // ── Mouse / stroke handlers ───────────────────────────────────────────────
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

  // ── Zoom via Alt+Scroll ───────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
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

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "z") {
        e.shiftKey ? redo() : undo();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [undo, redo]);

  // ── NEW: Thumbnail generation ─────────────────────────────────────────────
  /**
   * Generates a bilinearly-scaled thumbnail using the Rust WASM core.
   * Returns an ImageData-compatible object so JS can paint it onto a canvas
   * or convert to a Blob URL for the PhotoStrip without any extra canvas work.
   */
  const generateThumbnail = useCallback(
    (
      maxPx: number,
    ): { data: Uint8ClampedArray; width: number; height: number } | null => {
      const t = toolRef.current;
      if (!t) return null;
      const w = t.thumbnail_width(maxPx);
      const h = t.thumbnail_height(maxPx);
      const raw = t.thumbnail_data(maxPx);
      return { data: new Uint8ClampedArray(raw), width: w, height: h };
    },
    [],
  );

  /**
   * Convenience: generates a thumbnail and returns an object-URL blob,
   * ready to drop straight into an <img src=...>.
   * Caller is responsible for calling URL.revokeObjectURL when done.
   */
  const generateThumbnailUrl = useCallback(
    (maxPx: number): Promise<string | null> => {
      return new Promise((resolve) => {
        const thumb = generateThumbnail(maxPx);
        if (!thumb) return resolve(null);
        const offscreen = new OffscreenCanvas(thumb.width, thumb.height);
        const ctx = offscreen.getContext("2d")!;
        ctx.putImageData(
          new ImageData(new Uint8ClampedArray(thumb.data.buffer as ArrayBuffer), thumb.width, thumb.height),
          0,
          0,
        );
        offscreen
          .convertToBlob({ type: "image/jpeg", quality: 0.82 })
          .then((blob) => {
            resolve(URL.createObjectURL(blob));
          });
      });
    },
    [generateThumbnail],
  );

  // ── NEW: Cross-photo copy / paste ─────────────────────────────────────────
  /**
   * Extracts a rectangular region as a plain Uint8ClampedArray (RGBA).
   * Pass the result to `pasteRegion` on a different tool instance to
   * composite content between photos.
   */
  const copyRegion = useCallback(
    (x: number, y: number, w: number, h: number): Uint8ClampedArray | null => {
      const t = toolRef.current;
      if (!t) return null;
      return new Uint8ClampedArray(t.copy_region(x, y, w, h));
    },
    [],
  );

  /**
   * Alpha-composites `pixels` (srcW × srcH RGBA) onto the current image at
   * (destX, destY).  Automatically pushes an undo snapshot.
   */
  const pasteRegion = useCallback(
    (
      pixels: Uint8ClampedArray,
      srcW: number,
      srcH: number,
      destX: number,
      destY: number,
    ) => {
      const t = toolRef.current;
      if (!t) return;
      t.paste_region(new Uint8Array(pixels.buffer), srcW, srcH, destX, destY);
      flushToCanvas();
      syncState();
    },
    [flushToCanvas, syncState],
  );

  // ── NEW: Geometric transforms ─────────────────────────────────────────────
  const flipHorizontal = useCallback(() => {
    const t = toolRef.current;
    if (!t) return;
    t.flip_horizontal();
    // Mirror the tracked source position in React state too
    if (sourcePosRef.current) {
      sourcePosRef.current = {
        x: t.width() - 1 - sourcePosRef.current.x,
        y: sourcePosRef.current.y,
      };
    }
    flushToCanvas();
    syncState();
  }, [flushToCanvas, syncState]);

  const flipVertical = useCallback(() => {
    const t = toolRef.current;
    if (!t) return;
    t.flip_vertical();
    if (sourcePosRef.current) {
      sourcePosRef.current = {
        x: sourcePosRef.current.x,
        y: t.height() - 1 - sourcePosRef.current.y,
      };
    }
    flushToCanvas();
    syncState();
  }, [flushToCanvas, syncState]);

  const rotate90Cw = useCallback(() => {
    const t = toolRef.current;
    if (!t) return;
    t.rotate_90_cw();
    sourcePosRef.current = null;
    flushToCanvas();
    syncState();
  }, [flushToCanvas, syncState]);

  const rotate90Ccw = useCallback(() => {
    const t = toolRef.current;
    if (!t) return;
    t.rotate_90_ccw();
    sourcePosRef.current = null;
    flushToCanvas();
    syncState();
  }, [flushToCanvas, syncState]);

  const crop = useCallback(
    (x: number, y: number, w: number, h: number) => {
      const t = toolRef.current;
      if (!t || w < 1 || h < 1) return;
      t.crop(x, y, w, h);
      sourcePosRef.current = null;
      flushToCanvas();
      syncState();
    },
    [flushToCanvas, syncState],
  );

  const resize = useCallback(
    (newW: number, newH: number) => {
      const t = toolRef.current;
      if (!t || newW < 1 || newH < 1) return;
      t.resize(newW, newH);
      sourcePosRef.current = null;
      flushToCanvas();
      syncState();
    },
    [flushToCanvas, syncState],
  );

  // ── NEW: Pixel adjustments ────────────────────────────────────────────────
  /**
   * Adjusts brightness by `delta` (−1.0 to +1.0).
   * Each call is individually undo-able.
   */
  const adjustBrightness = useCallback(
    (delta: number) => {
      const t = toolRef.current;
      if (!t) return;
      t.adjust_brightness(delta);
      flushToCanvas();
      syncState();
    },
    [flushToCanvas, syncState],
  );

  /**
   * Adjusts contrast by `factor` (0 = grey, 1 = original, 2 = doubled).
   * Each call is individually undo-able.
   */
  const adjustContrast = useCallback(
    (factor: number) => {
      const t = toolRef.current;
      if (!t) return;
      t.adjust_contrast(factor);
      flushToCanvas();
      syncState();
    },
    [flushToCanvas, syncState],
  );

  return {
    state,
    toolRef,
    // Core
    syncState,
    loadImage,
    loadFromSaved,
    flushToCanvas,
    setBrushSize,
    setHardness,
    setOpacity,
    setSpacing,
    // History
    undo,
    redo,
    jumpToHistory,
    deleteHistoryEntry,
    clearHistory,
    // Export
    exportPng,
    exportAs,
    // Mouse
    onMouseDown,
    onMouseMove,
    onMouseUp,
    // NEW ↓
    generateThumbnail,
    generateThumbnailUrl,
    copyRegion,
    pasteRegion,
    flipHorizontal,
    flipVertical,
    rotate90Cw,
    rotate90Ccw,
    crop,
    resize,
    adjustBrightness,
    adjustContrast,
  };
}
