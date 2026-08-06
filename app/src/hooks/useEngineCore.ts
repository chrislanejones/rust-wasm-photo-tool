// Engine core — the WASM tool's lifecycle, state mirror, and blit path.
//
// Extracted VERBATIM from useCloneStamp.ts (the 1,467-line accretion hook) in
// the clonestamp-split refactor. The name finally says what it is: this is not
// clone-stamp code, it is the engine boundary — the one place that owns the
// `ImageHorseTool` instance, the WASM memory handle, the zero-copy flush, and
// the load/restore paths. Everything here predates or outgrew the clone stamp;
// the actual clone-stamp residue (mouse handlers, source arming) stays behind
// in useCloneStamp, which now composes this hook and the domain hooks
// (useHistory / useLayers / useExport / useTransforms) into the same 62-key
// surface it always returned — zero call-site churn across the importers.
//
// The shared refs are deliberate: `syncState` mirrors `hasSource`/`sourcePos`
// into state (they are part of CloneStampState), and the transforms remap
// `sourcePosRef` on flip. So the clone-source refs live HERE, in the shared
// context, even though the gestures that write them live in the residual hook.
// That is the honest seam — the state shape is the contract, and the state
// shape includes the source.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RefObject, MouseEvent } from "react";
import type { ImageHorseTool } from "stamp_tool";
import type { SavedEdit } from "@/lib/editPersistence";
import { onOplogFlush } from "@/lib/oplogPersistence";
import { checkBuildSkew } from "@/lib/pwa/skew";
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
  /** What this layer IS to the document (ADR-016). `"canvas"` is the artboard
   *  fill — a layer the user sees and can toggle, but document METADATA to the
   *  op log, which counts only `"content"` layers.
   *
   *  Always gate on this, never on `name`: "Background" means the FILL on an
   *  artboard document and the PHOTO on a single-layer one, and the name is
   *  user-editable besides. */
  kind: "canvas" | "content";
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
  /** Export quality, 1..=100 — ADR-031. Engine-owned so undo can reverse it.
   *
   *  This is the value to DISPLAY and to EXPORT with. `useToolStore.quality`
   *  still exists but has a different job: it is the persisted preference that
   *  seeds a new document, and is never read for display. Two roles, not two
   *  owners — reading the store for display is what would make it a mirror. */
  exportQuality: number;
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
  // Matches DEFAULT_EXPORT_QUALITY in the crate. Both defaults are asserted
  // against each other by an engine test — they must not drift.
  exportQuality: 75,
};

/** The engine context + public core surface. Domain hooks (useHistory,
 *  useLayers, useExport, useTransforms) and the clone-stamp residual receive
 *  this whole object; the facade re-exposes the public members. */
export interface EngineCore {
  state: CloneStampState;
  toolRef: RefObject<ImageHorseTool | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  /** Clone-source position mirror (drawn by CanvasArea, remapped on flip). */
  sourcePosRef: RefObject<{ x: number; y: number } | null>;
  /** JS-side clone-source disarm — see the comment at the ref site. */
  sourceDisarmedRef: RefObject<boolean>;
  /** True while a clone-stamp stroke is in flight. */
  isDrawingRef: RefObject<boolean>;
  syncState: () => void;
  flushToCanvas: () => void;
  getCanvasCoords: (
    e: MouseEvent<HTMLCanvasElement> | globalThis.MouseEvent,
  ) => { x: number; y: number };
  /** Bump the annotation revision so consumers re-sync derived state after an
   *  operation that may have swapped the overlay set (undo/redo/jump, layer
   *  switch, merge, flatten, oplog restore). */
  broadcastAnnotationsChanged: () => void;
  reset: () => void;
  loadImage: (file: File) => Promise<void>;
  loadImageFromPixels: (
    pixels: Uint8ClampedArray,
    width: number,
    height: number,
    artboard?: { pad: number; r: number; g: number; b: number; a: number },
  ) => Promise<void>;
  loadFromSaved: (saved: SavedEdit) => Promise<void>;
  restoreFromOplog: (photoId: string) => Promise<boolean>;
  setBrushSize: (size: number) => void;
  setHardness: (h: number) => void;
  setOpacity: (o: number) => void;
  setSpacing: (s: number) => void;
  setMaxHistory: (n: number) => void;
}

export function useEngineCore(
  canvasRef: RefObject<HTMLCanvasElement | null>,
): EngineCore {
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
    let layers: LayerInfo[];
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
      // ADR-031. Published here rather than mirrored in React, so an undo that
      // restores the snapshot's quality reaches the slider through the same
      // path as every other engine change.
      exportQuality: t.export_quality(),
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

  /** Bump the annotation revision so consumers (e.g. the text tool) can re-sync
   *  any derived state (the live annotation list, hover/edit selection, etc.)
   *  after an undo/redo/jump that may have restored a different overlay.
   *  (Was a `text-annotations-changed` window event before stage 4.) */
  const broadcastAnnotationsChanged = useCallback(() => {
    useAnnotationStore.getState().bumpAnnotations();
  }, []);

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
      // Skew guard (no-op in default builds): stale cached WASM/JS must not
      // start real work silently — see lib/pwa/skew.ts.
      void checkBuildSkew("engine-init");
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
      // Skew guard (no-op in default builds): stale cached WASM/JS must not
      // start real work silently — see lib/pwa/skew.ts.
      void checkBuildSkew("engine-init");
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
      // Skew guard (no-op in default builds): stale cached WASM/JS must not
      // start real work silently — see lib/pwa/skew.ts.
      void checkBuildSkew("engine-init");
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
   *
   * MOVED VERBATIM from useCloneStamp — 111 cyclomatic, deliberately NOT
   * refactored here (its own session, with persistence tests open).
   */
  const loadFromSaved = useCallback(
    async (saved: SavedEdit) => {
      const { default: init, ImageHorseTool: Tool } = await import("stamp_tool");
      const wasmExports = (await init()) as unknown as {
        memory: WebAssembly.Memory;
      };
      wasmMemoryRef.current = wasmExports.memory;
      registerWasmMemory(wasmExports.memory);
      // Skew guard (no-op in default builds): stale cached WASM/JS must not
      // start real work silently — see lib/pwa/skew.ts.
      void checkBuildSkew("engine-init");

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

  return useMemo(
    () => ({
      state,
      toolRef,
      canvasRef,
      sourcePosRef,
      sourceDisarmedRef,
      isDrawingRef,
      syncState,
      flushToCanvas,
      getCanvasCoords,
      broadcastAnnotationsChanged,
      reset,
      loadImage,
      loadImageFromPixels,
      loadFromSaved,
      restoreFromOplog,
      setBrushSize,
      setHardness,
      setOpacity,
      setSpacing,
      setMaxHistory,
    }),
    [
      state,
      canvasRef,
      syncState,
      flushToCanvas,
      getCanvasCoords,
      broadcastAnnotationsChanged,
      reset,
      loadImage,
      loadImageFromPixels,
      loadFromSaved,
      restoreFromOplog,
      setBrushSize,
      setHardness,
      setOpacity,
      setSpacing,
      setMaxHistory,
    ],
  );
}
