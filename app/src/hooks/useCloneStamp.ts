import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject, MouseEvent } from "react";
import type { ImageHorseTool } from "stamp_tool";
import type { SavedEdit } from "@/lib/editPersistence";
import { onOplogFlush } from "@/lib/oplogPersistence";
import {
  registerOplogStats,
  registerTilesDirtyCount,
  registerWasmMemory,
} from "@/lib/resourceMonitor";
import { syncOplog, tryTilesFlush } from "@/lib/tilesFlush";
import { useAnnotationStore } from "@/stores/useAnnotationStore";

/** Decode a PNG Uint8Array → raw RGBA via an OffscreenCanvas. */
async function decodePngToRgba(
  png: Uint8Array,
): Promise<{ rgba: Uint8ClampedArray; w: number; h: number }> {
  const blob = new Blob([png.buffer as ArrayBuffer], { type: "image/png" });
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

/** A single layer in the stack, as reported by the Rust `get_layers()` JSON. */
export interface LayerInfo {
  id: number;
  name: string;
  visible: boolean;
  opacity: number; // 0..1
  active: boolean;
  /** Whether this layer has a non-destructive mask (paint it in Edit-mask mode). */
  hasMask: boolean;
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
  /** Layer stack, bottom → top, mirrored from Rust. */
  layers: LayerInfo[];
  /** Id of the active layer (receives all tool edits). */
  activeLayerId: number;
}

const INITIAL_STATE: CloneStampState = {
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
  layers: [],
  activeLayerId: 0,
};

export function useCloneStamp(canvasRef: RefObject<HTMLCanvasElement | null>) {
  const toolRef = useRef<ImageHorseTool | null>(null);
  const isDrawingRef = useRef(false);
  const sourcePosRef = useRef<{ x: number; y: number } | null>(null);
  // JS-side clone-source disarm. The engine has no clear_source API (and the
  // Rust crate is frozen for this fix), so leaving the Stamp tool / switching
  // sub-mode "disarms" the stale engine source here instead: the stroke gate
  // in onMouseDown and the hasSource mirrored into state both honor it, and
  // the next Alt+Click re-arms by setting a fresh source.
  const sourceDisarmedRef = useRef(false);
  // WASM linear memory captured from the `init()` return so flushToCanvas can
  // view the pixel buffer in-place instead of going through get_image_data()
  // which allocates a fresh Vec<u8> each frame. The view must be reconstructed
  // every flush because WASM memory can grow and invalidate any previously-
  // created view.
  const wasmMemoryRef = useRef<WebAssembly.Memory | null>(null);
  // Stable, JS-owned blit backbuffer. We copy the WASM composite into this
  // (reused across frames) and hand *it* to putImageData — never an ImageData
  // backed directly by WASM memory. When the WASM heap grows (≈ stroke 5-8 as
  // undo snapshots accumulate) the shared ArrayBuffer detaches; with a
  // desynchronized 2D context Firefox reads that detached buffer on its
  // deferred present and paints garbage. A private copy is immune.
  const backbufferRef = useRef<ImageData | null>(null);

  const [state, setState] = useState<CloneStampState>(INITIAL_STATE);

  /**
   * Drop the loaded image entirely: blank the <canvas>, release the WASM tool
   * instance, and return the hook state to its initial not-ready shape.
   * Called whenever the gallery empties (Delete All, bulk delete, removing the
   * last photo) so no ghost frame lingers behind the upload dialog.
   */
  const reset = useCallback(() => {
    toolRef.current = null;
    sourcePosRef.current = null;
    isDrawingRef.current = false;
    sourceDisarmedRef.current = false;
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
      canvas.width = 0;
      canvas.height = 0;
    }
    setState(INITIAL_STATE);
  }, [canvasRef]);

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
    let layers: LayerInfo[] = [];
    let activeLayerId = 0;
    try {
      layers = JSON.parse(t.get_layers()) as LayerInfo[];
      activeLayerId = t.active_layer_id();
    } catch {
      layers = [];
    }
    setState({
      ready: true,
      hasSource: t.has_source() && !sourceDisarmedRef.current,
      sourcePos: sourcePosRef.current,
      undoCount: t.undo_count(),
      redoCount: t.redo_count(),
      history,
      zoom: t.get_zoom(),
      width: t.width(),
      height: t.height(),
      hasTransparency: t.has_transparency(),
      layers,
      activeLayerId,
    });
  }, []);

  const flushToCanvas = useCallback(() => {
    const t = toolRef.current;
    const canvas = canvasRef.current;
    if (!t || !canvas) return;
    const w = t.width();
    const h = t.height();
    // Resize canvas if dimensions changed (e.g. after rotate_90_cw)
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    const ctx = canvas.getContext("2d", { desynchronized: true })!;
    // Rebuild the Rust-side composite of all visible layers (pixels + overlays
    // + opacity) into its cache, then blit it. The zero-copy path views WASM
    // linear memory directly — the view MUST be reconstructed every call
    // because the backing ArrayBuffer is replaced if WASM memory grows.
    t.recomposite();
    registerTilesDirtyCount(tryTilesFlush(t));
    registerOplogStats(syncOplog(t));
    onOplogFlush(t);
    const wasmMem = wasmMemoryRef.current;
    if (wasmMem) {
      const ptr = t.data_ptr();
      const len = t.data_len();
      // View WASM linear memory, then COPY into a stable JS-owned backbuffer.
      // Handing putImageData an ImageData backed by the live WASM heap is the
      // root of the Firefox "garbage after ~5-8 strokes" bug: a later
      // memory.grow() detaches the shared ArrayBuffer and the desynchronized
      // present reads it stale. Copying into a private (reused) buffer is safe
      // in every browser. The view is rebuilt each call against the current
      // (post-grow) buffer.
      const view = new Uint8ClampedArray(wasmMem.buffer as ArrayBuffer, ptr, len);
      let back = backbufferRef.current;
      if (!back || back.width !== w || back.height !== h) {
        back = new ImageData(w, h);
        backbufferRef.current = back;
      }
      if (view.length === back.data.length) {
        back.data.set(view);
        ctx.putImageData(back, 0, 0);
        return;
      }
      // Length mismatch (shouldn't happen) — fall through to the safe copy.
    }
    // Fallback (no WASM memory handle): copy the composite out of Rust.
    const composed = t.get_image_data();
    ctx.putImageData(
      new ImageData(new Uint8ClampedArray(composed), w, h),
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
      const { default: init, ImageHorseTool: Tool } =
        await import("stamp_tool");
      const wasmExports = (await init()) as unknown as {
        memory: WebAssembly.Memory;
      };
      wasmMemoryRef.current = wasmExports.memory;
      registerWasmMemory(wasmExports.memory);
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d", { desynchronized: true })!;
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
   * Load pre-decoded RGBA pixels directly — skips a second decode and respects
   * the 2048 cap. Pass `artboard` (Settings → Canvas on import) to land the
   * photo on a larger backing canvas as two layers (Background + Photo); omit
   * it for the classic single full-bleed Background layer.
   */
  const loadImageFromPixels = useCallback(
    async (
      pixels: Uint8ClampedArray,
      width: number,
      height: number,
      artboard?: { pad: number; r: number; g: number; b: number; a: number },
    ) => {
      // A zero-size buffer must never reach the engine — it would resize the
      // canvas to 0×0 and blank the app (seen when a caller passed dimensions
      // read from a closed ImageBitmap).
      if (!width || !height || pixels.length < width * height * 4) {
        console.error(
          `loadImageFromPixels: rejected invalid input ${width}×${height} (${pixels.length} bytes)`,
        );
        return;
      }
      const { default: init, ImageHorseTool: Tool } = await import("stamp_tool");
      const wasmExports = (await init()) as unknown as {
        memory: WebAssembly.Memory;
      };
      wasmMemoryRef.current = wasmExports.memory;
      registerWasmMemory(wasmExports.memory);
      const canvas = canvasRef.current;
      if (!canvas) return;
      const src = new Uint8Array(pixels.buffer as ArrayBuffer);
      if (artboard) {
        // Two-layer artboard (Background canvas + Photo). Load the photo native,
        // then border it with the IDEMPOTENT, ABSOLUTE `set_artboard_border`:
        // the doc becomes exactly photo + 2×pad (a pad of 0 still yields the
        // two-layer structure). Routing every artboard load through the same
        // Rust method as the live border keeps the result uniform on every load
        // path (fresh import, gallery switch, AI result). The flush blits the
        // composite; the canvas is sized from the tool's resulting dimensions.
        const tool = new Tool(width, height);
        tool.load_image(src);
        tool.set_artboard_border(
          artboard.pad,
          artboard.r,
          artboard.g,
          artboard.b,
          artboard.a,
        );
        // The border is part of OPENING the photo, not a user edit. Clear the
        // "Canvas Border" snapshot it pushed so a freshly-loaded artboard doc
        // has undoCount 0 (clean baseline) — exactly like the non-artboard
        // branch (load_image clears history). Otherwise every loaded photo
        // reads as modified, lighting the gallery "edited" dot and dotting
        // each photo you switch past.
        tool.clear_history();
        toolRef.current = tool;
        canvas.width = tool.width();
        canvas.height = tool.height();
        // No raw putImageData here (the composite differs from the photo
        // pixels), so paint the layer composite straight away.
        flushToCanvas();
      } else {
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d", { desynchronized: true })!;
        const clamped = new Uint8ClampedArray(pixels.buffer as ArrayBuffer);
        ctx.putImageData(new ImageData(clamped, width, height), 0, 0);
        const tool = new Tool(width, height);
        tool.load_image(src);
        toolRef.current = tool;
      }
      sourcePosRef.current = null;
      syncState();
    },
    [canvasRef, syncState, flushToCanvas],
  );

  /**
   * Restore a photo from its persisted OPERATION LOG (ADR-006) — the
   * op-log sibling of `loadFromSaved`. Owns the engine lifecycle the same
   * way the other load paths do: initializes wasm, creates the tool when
   * none exists yet (page boot), and hands it to the persistence module,
   * which rebuilds the document + replayable undo history and swaps it
   * into the engine. Returns true only on a successful restore; false
   * means "use the existing archive/original paths" (flag off, nothing
   * persisted, invalid data, or a non-tiles wasm build — all inert).
   */
  const restoreFromOplog = useCallback(
    async (photoId: string): Promise<boolean> => {
      const { isOplogPersistenceEnabled, restoreOplog } = await import(
        "@/lib/oplogPersistence"
      );
      if (!isOplogPersistenceEnabled()) return false;
      const { default: init, ImageHorseTool: Tool } = await import("stamp_tool");
      const wasmExports = (await init()) as unknown as {
        memory: WebAssembly.Memory;
      };
      wasmMemoryRef.current = wasmExports.memory;
      registerWasmMemory(wasmExports.memory);
      // Reuse the live engine on a gallery switch; create one on boot —
      // oplog_restore replaces the document (dimensions included) wholesale.
      const tool = toolRef.current ?? new Tool(1, 1);
      if ((await restoreOplog(tool, photoId)) !== "restored") return false;
      toolRef.current = tool;
      sourcePosRef.current = null;
      flushToCanvas(); // resizes the canvas to the restored dimensions
      syncState();
      // Restored annotation lists differ from whatever was showing — same
      // re-sync the undo path performs.
      useAnnotationStore.getState().bumpAnnotations();
      return true;
    },
    [flushToCanvas, syncState],
  );

  /**
   * Restore a previously-persisted photo session: canvas pixels + undo/redo
   * history. Snapshots are stored as PNGs; each is decoded back to raw RGBA
   * before being injected into the WASM history stack.
   */
  const loadFromSaved = useCallback(
    async (saved: SavedEdit) => {
      const { default: init, ImageHorseTool: Tool } = await import("stamp_tool");
      const wasmExports = (await init()) as unknown as {
        memory: WebAssembly.Memory;
      };
      wasmMemoryRef.current = wasmExports.memory;
      registerWasmMemory(wasmExports.memory);

      // Decode current canvas PNG → raw RGBA
      const { rgba: canvasRgba } = await decodePngToRgba(saved.canvasPng);

      // Construct a fresh tool at the saved dimensions and load the canvas
      const tool = new Tool(saved.canvasW, saved.canvasH);
      tool.load_image(new Uint8Array(canvasRgba.buffer as ArrayBuffer)); // clears history

      // Rebuild the full layer stack (archive v5+) BEFORE injecting history —
      // begin_layer_restore clears history, so it must run first. Each layer's
      // own text/shape overlays are restored onto it (no history noise).
      const usedLayers = !!(saved.layers && saved.layers.length > 0);
      if (usedLayers) {
        tool.begin_layer_restore();
        for (const layer of saved.layers!) {
          const { rgba, w, h } = await decodePngToRgba(layer.png);
          tool.push_restored_layer(
            new Uint8Array(rgba.buffer as ArrayBuffer),
            w,
            h,
            layer.name,
            layer.visible,
            layer.opacity,
          );
          for (const a of layer.annotations ?? []) {
            tool.restore_text_annotation(
              a.text,
              a.font_size,
              a.r, a.g, a.b,
              a.bold,
              a.x, a.y,
              a.rotation_deg,
              a.background_kind ?? 0,
              a.bg_r ?? 255,
              a.bg_g ?? 255,
              a.bg_b ?? 255,
              a.bg_a ?? 255,
              a.bg_padding ?? 8,
              a.bg_corner_radius ?? 8,
              a.bg_tail ?? 0,
              a.shadow_box ?? false,
              a.shadow_text ?? false,
              a.shadow_r ?? 0,
              a.shadow_g ?? 0,
              a.shadow_b ?? 0,
              a.shadow_a ?? 0,
              a.shadow_dx ?? 0,
              a.shadow_dy ?? 0,
              a.shadow_blur ?? 0,
            );
          }
          for (const s of layer.shapes ?? []) {
            if (s.kind === 5) {
              tool.restore_pin_annotation(
                s.x0, s.y0, s.x1, s.y1,
                s.number ?? 0, s.r, s.g, s.b,
                s.label_kind ?? 0,
              );
            } else if (s.kind === 6) {
              const flat = new Float64Array((s.points ?? []).flat());
              tool.restore_polyline_annotation(flat, s.r, s.g, s.b, s.stroke_width);
            } else if (s.kind === 7) {
              const flat = new Float64Array((s.points ?? []).flat());
              tool.restore_bezier_annotation(
                flat, s.r, s.g, s.b, s.stroke_width,
                s.fill_kind ?? 0,
                s.fill_r ?? 0, s.fill_g ?? 0, s.fill_b ?? 0, s.fill_a ?? 0,
              );
            } else {
              tool.restore_shape_annotation(
                s.kind,
                s.x0, s.y0, s.x1, s.y1,
                s.r, s.g, s.b,
                s.stroke_width,
                s.arrow_style,
                s.fill_kind ?? 0,
                s.fill_r ?? 0, s.fill_g ?? 0, s.fill_b ?? 0, s.fill_a ?? 0,
                s.fill2_r ?? 0, s.fill2_g ?? 0, s.fill2_b ?? 0, s.fill2_a ?? 0,
                s.fill_angle ?? 0,
                s.fill_block ?? 0,
              );
            }
          }
        }
        const activeIdx = saved.layers!.findIndex(
          (l) => l.id === saved.activeLayerId,
        );
        tool.finish_layer_restore(
          activeIdx >= 0 ? activeIdx : saved.layers!.length - 1,
        );
      }

      // Re-inject undo snapshots (oldest first — preserves original order).
      // Each snapshot's annotations are pushed via per-annotation calls so
      // Rust rebuilds the tile cache (we don't store tile bytes on disk).
      for (let i = 0; i < saved.undoStack.length; i++) {
        const snap = saved.undoStack[i];
        const { rgba, w, h } = await decodePngToRgba(snap.png);
        tool.inject_undo_snapshot(
          new Uint8Array(rgba.buffer as ArrayBuffer),
          w,
          h,
          snap.label,
        );
        if (snap.annotations) {
          for (const a of snap.annotations) {
            tool.push_annotation_to_undo_snapshot(
              i,
              a.text,
              a.font_size,
              a.r, a.g, a.b,
              a.bold,
              a.x, a.y,
              a.rotation_deg,
              a.background_kind ?? 0,
              a.bg_r ?? 255,
              a.bg_g ?? 255,
              a.bg_b ?? 255,
              a.bg_a ?? 255,
              a.bg_padding ?? 8,
              a.bg_corner_radius ?? 8,
              a.bg_tail ?? 0,
            );
          }
        }
      }

      // Re-inject redo snapshots
      for (let i = 0; i < saved.redoStack.length; i++) {
        const snap = saved.redoStack[i];
        const { rgba, w, h } = await decodePngToRgba(snap.png);
        tool.inject_redo_snapshot(
          new Uint8Array(rgba.buffer as ArrayBuffer),
          w,
          h,
          snap.label,
        );
        if (snap.annotations) {
          for (const a of snap.annotations) {
            tool.push_annotation_to_redo_snapshot(
              i,
              a.text,
              a.font_size,
              a.r, a.g, a.b,
              a.bold,
              a.x, a.y,
              a.rotation_deg,
              a.background_kind ?? 0,
              a.bg_r ?? 255,
              a.bg_g ?? 255,
              a.bg_b ?? 255,
              a.bg_a ?? 255,
              a.bg_padding ?? 8,
              a.bg_corner_radius ?? 8,
              a.bg_tail ?? 0,
            );
          }
        }
      }

      toolRef.current = tool;
      sourcePosRef.current = null;

      const canvas = canvasRef.current;
      if (canvas) {
        canvas.width = saved.canvasW;
        canvas.height = saved.canvasH;
      }

      // Re-create live text annotations (non-destructive overlay layer).
      // Skipped when the layer stack was restored above (overlays already
      // re-attached per-layer) to avoid duplicating them on the active layer.
      if (!usedLayers && saved.annotations && saved.annotations.length > 0) {
        for (const a of saved.annotations) {
          tool.add_text_annotation(
            a.text,
            a.font_size,
            a.r, a.g, a.b,
            a.bold,
            a.x, a.y,
            a.rotation_deg,
            a.background_kind ?? 0,
            a.bg_r ?? 255,
            a.bg_g ?? 255,
            a.bg_b ?? 255,
            a.bg_a ?? 255,
            a.bg_padding ?? 8,
            a.bg_corner_radius ?? 8,
            a.bg_tail ?? 0,
          );
        }
      }

      // Re-create live shape annotations (non-destructive overlay layer).
      // restore_shape_annotation does NOT push history (the undo/redo stacks
      // were injected above).
      if (!usedLayers && saved.shapes && saved.shapes.length > 0) {
        for (const s of saved.shapes) {
          if (s.kind === 5) {
            tool.restore_pin_annotation(
              s.x0, s.y0, s.x1, s.y1,
              s.number ?? 0, s.r, s.g, s.b,
              s.label_kind ?? 0,
            );
          } else if (s.kind === 6) {
            const flat = new Float64Array((s.points ?? []).flat());
            tool.restore_polyline_annotation(flat, s.r, s.g, s.b, s.stroke_width);
          } else if (s.kind === 7) {
            const flat = new Float64Array((s.points ?? []).flat());
            tool.restore_bezier_annotation(
              flat, s.r, s.g, s.b, s.stroke_width,
              s.fill_kind ?? 0,
              s.fill_r ?? 0, s.fill_g ?? 0, s.fill_b ?? 0, s.fill_a ?? 0,
            );
          } else {
            tool.restore_shape_annotation(
              s.kind,
              s.x0, s.y0, s.x1, s.y1,
              s.r, s.g, s.b,
              s.stroke_width,
              s.arrow_style,
              s.fill_kind ?? 0,
              s.fill_r ?? 0, s.fill_g ?? 0, s.fill_b ?? 0, s.fill_a ?? 0,
              s.fill2_r ?? 0, s.fill2_g ?? 0, s.fill2_b ?? 0, s.fill2_a ?? 0,
              s.fill_angle ?? 0,
              s.fill_block ?? 0,
            );
          }
        }
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

  /** Set the undo-history depth on the live engine (50–1000). Safe no-op until
   *  an image/engine exists; re-applied after each load from AppShell. */
  const setMaxHistory = useCallback((n: number) => {
    toolRef.current?.set_max_history(n);
  }, []);

  // ── History ───────────────────────────────────────────────────────────────
  /** Bump the annotation revision so consumers (e.g. the text tool) can re-sync
   *  any derived state (the live annotation list, hover/edit selection, etc.)
   *  after an undo/redo/jump that may have restored a different overlay.
   *  (Was a `text-annotations-changed` window event before stage 4.) */
  const broadcastAnnotationsChanged = useCallback(() => {
    useAnnotationStore.getState().bumpAnnotations();
  }, []);

  const undo = useCallback(() => {
    if (toolRef.current?.undo()) {
      flushToCanvas();
      syncState();
      broadcastAnnotationsChanged();
    }
  }, [flushToCanvas, syncState, broadcastAnnotationsChanged]);

  const redo = useCallback(() => {
    if (toolRef.current?.redo()) {
      flushToCanvas();
      syncState();
      broadcastAnnotationsChanged();
    }
  }, [flushToCanvas, syncState, broadcastAnnotationsChanged]);

  const jumpToHistory = useCallback(
    (index: number) => {
      if (toolRef.current?.jump_to_history(index)) {
        flushToCanvas();
        syncState();
        broadcastAnnotationsChanged();
      }
    },
    [flushToCanvas, syncState, broadcastAnnotationsChanged],
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
    // export_png composites every visible layer (pixels + live overlays +
    // opacity) — no destructive flatten needed.
    const png = t.export_png();
    const blob = new Blob([new Uint8Array(png)], { type: "image/png" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = revisedName(sourceName, ".png");
    a.click();
    URL.revokeObjectURL(url);
  }, [flushToCanvas, syncState]);

  // Return the encoded export bytes as a Blob (no download). Lets callers
  // post-process — e.g. apply the EXIF keep/strip policy — before saving.
  const exportBlob = useCallback(
    async (
      format: "png" | "jpeg" | "webp" | "avif",
      quality: number = 0.92,
    ): Promise<Blob | null> => {
      const t = toolRef.current;
      if (format === "png") {
        if (!t) return null;
        return new Blob([new Uint8Array(t.export_png())], { type: "image/png" });
      }
      const canvas = canvasRef.current;
      if (!canvas) return null;
      flushToCanvas();
      const mimeMap: Record<string, string> = {
        jpeg: "image/jpeg",
        webp: "image/webp",
        avif: "image/avif",
      };
      return await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((blob) => resolve(blob), mimeMap[format], quality),
      );
    },
    [canvasRef, flushToCanvas],
  );

  const exportAs = useCallback(
    (format: "png" | "jpeg" | "webp" | "avif", quality: number = 0.92, sourceName = "image") => {
      if (format === "png") {
        exportPng(sourceName);
        return;
      }
      const canvas = canvasRef.current;
      if (!canvas) return;
      // Non-PNG export reads the canvas pixels via toBlob. flushToCanvas paints
      // the full composite (all visible layers + overlays), so just ensure the
      // canvas is current — no destructive flatten needed.
      flushToCanvas();
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
    [canvasRef, exportPng, flushToCanvas, syncState],
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
        sourceDisarmedRef.current = false; // fresh source re-arms the stamp
        syncState();
        return;
      }
      if (!t.has_source() || sourceDisarmedRef.current) return;
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

  /**
   * Clone-stamp teardown — called when the Stamp tool is deactivated or its
   * sub-mode changes (useStampTeardown). Aborts any in-flight stroke so no
   * pointer state leaks past the exit, then disarms the source: the engine
   * keeps its (now stale) source point because there's no clear_source API,
   * but the JS gate makes it inert until the user Alt+Clicks a new one, and
   * the "Source set" badge flips back to "Alt+Click to set source".
   */
  const clearCloneSource = useCallback(() => {
    if (isDrawingRef.current) {
      isDrawingRef.current = false;
      toolRef.current?.end_stroke();
    }
    if (!sourceDisarmedRef.current || sourcePosRef.current) {
      sourceDisarmedRef.current = true;
      sourcePosRef.current = null;
      syncState(); // no-op until an image/engine exists
    }
  }, [syncState]);

  // ── Zoom via Alt+Scroll ───────────────────────────────────────────────────
  // Attached to window so it works even before the canvas element mounts
  // (CanvasArea is conditionally rendered and canvasRef.current starts null).
  useEffect(() => {
    const handler = (e: WheelEvent) => {
      if (!e.altKey || !toolRef.current) return;
      e.preventDefault();
      toolRef.current.adjust_zoom(e.deltaY < 0 ? 1 : -1);
      syncState();
    };
    window.addEventListener("wheel", handler, { passive: false });
    return () => window.removeEventListener("wheel", handler);
  }, [syncState]);

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

  /** Resize with a selectable resampling filter (0=nearest, 1=bilinear, 2=catmull-rom, 3=lanczos3). */
  const resizeWithFilter = useCallback(
    (newW: number, newH: number, filter: number) => {
      const t = toolRef.current;
      if (!t || newW < 1 || newH < 1) return;
      t.resize_with_filter(newW, newH, filter);
      sourcePosRef.current = null;
      flushToCanvas();
      syncState();
    },
    [flushToCanvas, syncState],
  );

  /**
   * Photoshop-style **Canvas Size**: resize the document WITHOUT resampling any
   * layer. Re-blits each layer's native pixels at the anchor (4 = centre) and
   * refills the backing layer with the given color (a = 0 ⇒ transparent ⇒
   * checkerboard). Undoable; mirrors `resize`/`resizeWithFilter` bookkeeping.
   */
  const resizeCanvas = useCallback(
    (
      newW: number,
      newH: number,
      anchor: number,
      r: number,
      g: number,
      b: number,
      a: number,
    ) => {
      const t = toolRef.current;
      if (!t || newW < 1 || newH < 1) return;
      t.resize_canvas(newW, newH, anchor, r, g, b, a);
      sourcePosRef.current = null;
      flushToCanvas();
      syncState();
    },
    [flushToCanvas, syncState],
  );

  /**
   * Normalize the CURRENT document to an artboard: the photo at native size,
   * centred, with a `pad`-px border filled with (r,g,b,a) (a = 0 ⇒ transparent
   * ⇒ checkerboard). ABSOLUTE + IDEMPOTENT — the doc becomes exactly
   * photo + 2×pad no matter its current size, so it both shrinks a "jumbo"
   * canvas back to size and re-applies cleanly without accumulating. Backs the
   * live "Canvas border" / "Backing color" re-apply.
   */
  const setArtboardBorder = useCallback(
    (pad: number, r: number, g: number, b: number, a: number) => {
      const t = toolRef.current;
      if (!t) return;
      t.set_artboard_border(pad, r, g, b, a);
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

  /**
   * Blurs the whole image. `intensity` is the Effects panel's Blur slider as
   * a 0..1 fraction. Rust's `blur_region` takes an *integer* Gaussian kernel
   * radius (u32, clamped 1..30) — passing the raw fraction got truncated to 0
   * by the wasm-bindgen ABI and clamped up to a radius-1 kernel, i.e. a
   * visually imperceptible blur. Map the fraction onto the 1..30 radius range
   * before crossing into WASM. One "Blur" history snapshot per call.
   */
  const applyGlobalBlur = useCallback(
    (intensity: number) => {
      const t = toolRef.current;
      if (!t) return;
      const kernelRadius = Math.max(1, Math.round(intensity * 30));
      const cx = t.width() / 2;
      const cy = t.height() / 2;
      const r = Math.max(t.width(), t.height());
      t.begin_blur_stroke();
      t.blur_region(cx, cy, r, kernelRadius);
      flushToCanvas();
      syncState();
    },
    [flushToCanvas, syncState],
  );

  /**
   * Adjusts saturation by `factor` (0 = grayscale, 1 = unchanged, >1 = more
   * saturated) — grayscale-lerp against the pixel's own luminance, same
   * technique as CSS `filter: saturate()`. Each call is individually undo-able.
   */
  const adjustSaturation = useCallback(
    (factor: number) => {
      const t = toolRef.current;
      if (!t) return;
      t.adjust_saturation(factor);
      flushToCanvas();
      syncState();
    },
    [flushToCanvas, syncState],
  );

  /**
   * Lifts (brightens) shadows by `amount`, masked to peak in dark tones and
   * taper to ~0 in bright tones. Each call is individually undo-able.
   */
  const adjustShadows = useCallback(
    (amount: number) => {
      const t = toolRef.current;
      if (!t) return;
      t.adjust_shadows(amount);
      flushToCanvas();
      syncState();
    },
    [flushToCanvas, syncState],
  );

  /**
   * Recovers (darkens) blown highlights by `amount`, masked to peak in bright
   * tones and taper to ~0 in dark tones. Each call is individually undo-able.
   */
  const adjustHighlights = useCallback(
    (amount: number) => {
      const t = toolRef.current;
      if (!t) return;
      t.adjust_highlights(amount);
      flushToCanvas();
      syncState();
    },
    [flushToCanvas, syncState],
  );

  /**
   * Unsharp-mask sharpen over the whole image. `amount` 0 = no sharpening.
   * Each call is individually undo-able.
   */
  const adjustSharpen = useCallback(
    (amount: number) => {
      const t = toolRef.current;
      if (!t) return;
      t.adjust_sharpen(amount);
      flushToCanvas();
      syncState();
    },
    [flushToCanvas, syncState],
  );

  // ── Layers ────────────────────────────────────────────────────────────────
  // Each mutates the Rust layer stack, then repaints the composite and re-syncs
  // the mirrored layer list into React state.
  const addLayer = useCallback(
    (name = ""): number => {
      const t = toolRef.current;
      if (!t) return 0;
      const id = t.add_layer(name);
      flushToCanvas();
      syncState();
      return id;
    },
    [flushToCanvas, syncState],
  );

  const removeLayer = useCallback(
    (id: number) => {
      const t = toolRef.current;
      if (!t) return;
      if (t.remove_layer(id)) {
        flushToCanvas();
        syncState();
      }
    },
    [flushToCanvas, syncState],
  );

  const duplicateLayer = useCallback(
    (id: number): number => {
      const t = toolRef.current;
      if (!t) return 0;
      const newId = t.duplicate_layer(id);
      flushToCanvas();
      syncState();
      return newId;
    },
    [flushToCanvas, syncState],
  );

  const setActiveLayer = useCallback(
    (id: number) => {
      const t = toolRef.current;
      if (!t) return;
      if (t.set_active_layer(id)) {
        flushToCanvas();
        syncState();
        broadcastAnnotationsChanged();
      }
    },
    [flushToCanvas, syncState, broadcastAnnotationsChanged],
  );

  const setLayerVisible = useCallback(
    (id: number, visible: boolean) => {
      const t = toolRef.current;
      if (!t) return;
      if (t.set_layer_visible(id, visible)) {
        flushToCanvas();
        syncState();
      }
    },
    [flushToCanvas, syncState],
  );

  const setLayerOpacity = useCallback(
    (id: number, opacity: number) => {
      const t = toolRef.current;
      if (!t) return;
      if (t.set_layer_opacity(id, opacity)) {
        flushToCanvas();
        syncState();
      }
    },
    [flushToCanvas, syncState],
  );

  const renameLayer = useCallback(
    (id: number, name: string) => {
      const t = toolRef.current;
      if (!t) return;
      if (t.rename_layer(id, name)) {
        syncState();
      }
    },
    [syncState],
  );

  const moveLayer = useCallback(
    (id: number, newIndex: number) => {
      const t = toolRef.current;
      if (!t) return;
      if (t.move_layer(id, newIndex)) {
        flushToCanvas();
        syncState();
      }
    },
    [flushToCanvas, syncState],
  );

  const mergeDown = useCallback(
    (id: number) => {
      const t = toolRef.current;
      if (!t) return;
      if (t.merge_down(id)) {
        flushToCanvas();
        syncState();
        broadcastAnnotationsChanged();
      }
    },
    [flushToCanvas, syncState, broadcastAnnotationsChanged],
  );

  const flattenAll = useCallback(() => {
    const t = toolRef.current;
    if (!t) return;
    t.flatten_all();
    flushToCanvas();
    syncState();
    broadcastAnnotationsChanged();
  }, [flushToCanvas, syncState, broadcastAnnotationsChanged]);

  // ── Layer masks (non-destructive) ──
  const addLayerMask = useCallback(
    (id: number) => {
      if (toolRef.current?.add_layer_mask(id)) {
        flushToCanvas();
        syncState();
      }
    },
    [flushToCanvas, syncState],
  );
  const removeLayerMask = useCallback(
    (id: number) => {
      if (toolRef.current?.remove_layer_mask(id)) {
        flushToCanvas();
        syncState();
      }
    },
    [flushToCanvas, syncState],
  );
  const applyLayerMask = useCallback(
    (id: number) => {
      if (toolRef.current?.apply_layer_mask(id)) {
        flushToCanvas();
        syncState();
      }
    },
    [flushToCanvas, syncState],
  );
  const invertLayerMask = useCallback(
    (id: number) => {
      if (toolRef.current?.invert_layer_mask(id)) {
        flushToCanvas();
        syncState();
      }
    },
    [flushToCanvas, syncState],
  );

  return {
    state,
    toolRef,
    // Core
    syncState,
    loadImage,
    loadImageFromPixels,
    loadFromSaved,
    restoreFromOplog,
    flushToCanvas,
    reset,
    setBrushSize,
    setHardness,
    setOpacity,
    setSpacing,
    setMaxHistory,
    // History
    undo,
    redo,
    jumpToHistory,
    deleteHistoryEntry,
    clearHistory,
    // Export
    exportPng,
    exportAs,
    exportBlob,
    // Mouse
    onMouseDown,
    onMouseMove,
    onMouseUp,
    clearCloneSource,
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
    resizeWithFilter,
    resizeCanvas,
    setArtboardBorder,
    adjustBrightness,
    adjustContrast,
    applyGlobalBlur,
    adjustSaturation,
    adjustShadows,
    adjustHighlights,
    adjustSharpen,
    // Layers
    addLayer,
    removeLayer,
    duplicateLayer,
    setActiveLayer,
    setLayerVisible,
    setLayerOpacity,
    renameLayer,
    moveLayer,
    mergeDown,
    flattenAll,
    addLayerMask,
    removeLayerMask,
    applyLayerMask,
    invertLayerMask,
  };
}
