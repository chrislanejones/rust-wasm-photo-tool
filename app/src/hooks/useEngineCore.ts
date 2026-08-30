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
import type { ImageHorseTool, UiStateCapture } from "stamp_tool";
import type { SavedEdit } from "@/lib/editPersistence";
import { onOplogFlush } from "@/lib/oplogPersistence";
import { checkBuildSkew } from "@/lib/pwa/skew";
import {
  registerOplogStats,
  registerTilesDirtyCount,
  registerWasmMemory,
} from "@/lib/resourceMonitor";
import { restoreLayerStack } from "@/lib/restoreLayerStack";
import {
  blitLiveEngine,
  clearLiveCanvas,
  createLiveEngine,
  detachLivePort,
  previewLiveCanvas,
  sizeLiveCanvas,
} from "@/lib/engine/port";
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
  /** The layer's non-destructive Color Overlay style (Photoshop's), or `null`
   *  when it has none. A solid colour tinting the layer's own pixels at
   *  composite time — clipped to its alpha, applied UNDER the mask, reversible
   *  until Applied. Session-lived: like `hasMask`, it does not survive a reload
   *  (`push_restored_layer` restores pixels + annotations only). */
  overlay: LayerColorOverlay | null;
}

/** A layer's Color Overlay style, mirrored from the Rust `get_layers()` JSON. */
export interface LayerColorOverlay {
  /** `#rrggbb`. */
  color: string;
  /** 0..1. */
  opacity: number;
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
  layers: [],
  activeLayerId: 0,
  // Matches DEFAULT_EXPORT_QUALITY in the crate. Both defaults are asserted
  // against each other by an engine test — they must not drift.
  exportQuality: 75,
};

/** The ten values `capture_ui_state()` carries, copied out of wasm memory. */
export type UiSnapshot = {
  has_source: boolean;
  undo_count: number;
  redo_count: number;
  history_labels: string;
  zoom: number;
  width: number;
  height: number;
  layers_json: string;
  active_layer_id: number;
  export_quality: number;
};

/** The minimum of the engine surface this needs — so a test can supply a fake
 *  without standing up a wasm module. */
type UiStateSource = { capture_ui_state: () => UiStateCapture | Promise<UiStateCapture> };

/**
 * The atomic UI capture, with the liveness guard that makes it safe to await.
 *
 * ADR-024 Stage 3.5, a13. Lifted out of `syncState` for one reason: the guard
 * below is the entire risk of making that call async, and inside a `useCallback`
 * closed over a ref it had no test. Here it does.
 *
 * ── THE GUARD ──
 * `reset()` nulls `toolRef.current` on a photo switch, and it does NOT free the
 * engine — nothing in this codebase calls `tool.free()`. So a capture issued
 * against the OUTGOING document still resolves, happily, carrying that
 * document's width, history and layer list. Without the check, that stale
 * snapshot lands on top of the `INITIAL_STATE` that `reset` just wrote, and the
 * editor shows the previous photo's dimensions and undo stack underneath the
 * new one. Nothing throws; it self-corrects on the next mutation. That is the
 * profile of an intermittent nobody files.
 *
 * The check is engine IDENTITY, not a counter. `t` is the thing the capture was
 * issued against, so comparing it answers the real question — "is this still
 * the live document?" — with no second piece of state to keep in sync.
 * `OpLog::generation` was considered for this in b2 and rejected: it bumps only
 * when a redo tail is dropped, not on edits, and it is not on the wasm surface.
 *
 * @param stillLive re-checked AFTER the await, never before — checking early
 *   tests the wrong moment and always passes.
 * @returns the copied fields, or null if the document was replaced mid-flight.
 */
export async function readUiSnapshot(
  t: UiStateSource,
  stillLive: () => boolean,
): Promise<UiSnapshot | null> {
  const ui = await t.capture_ui_state();
  try {
    if (!stillLive()) return null;
    // Read each field once, then free — the capture is a boxed wasm allocation
    // and every property access crosses the boundary.
    return {
      has_source: ui.has_source,
      undo_count: ui.undo_count,
      redo_count: ui.redo_count,
      history_labels: ui.history_labels,
      zoom: ui.zoom,
      width: ui.width,
      height: ui.height,
      layers_json: ui.layers_json,
      active_layer_id: ui.active_layer_id,
      export_quality: ui.export_quality,
    };
  } finally {
    // BOTH paths free. The stale path is the one that matters: it is the new
    // path a13 added, it runs exactly when the app is busy switching photos,
    // and a leak there would be per-photo-switch and invisible.
    ui.free();
  }
}

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
  // Async since a13, and deliberately NOT awaited by its 74 callers — the
  // reasoning is at the implementation. Returned as a Promise rather than
  // swallowed inside so a caller that ever does need to sequence on it can,
  // and so tests can await the mirror instead of polling it.
  syncState: () => Promise<void>;
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
    detachLivePort();
    sourcePosRef.current = null;
    isDrawingRef.current = false;
    sourceDisarmedRef.current = false;
    const canvas = canvasRef.current;
    // ADR-024 a12.2 — via the port: after `transferControlToOffscreen()` this
    // thread cannot get a 2D context and a width assignment throws.
    if (canvas) clearLiveCanvas(canvas);
    setState(INITIAL_STATE);
  }, [canvasRef]);

  const syncState = useCallback(async () => {
    const t = toolRef.current;
    if (!t) return;
    // ATOMIC CAPTURE (ADR-024). This used to be eleven separate engine reads
    // assembled into one object and handed to one `setState`. They describe a
    // single document state and are consumed together, so they cannot be
    // converted to eleven awaits: behind the worker React would render a
    // snapshot that never existed — a width from before a resize beside an undo
    // count from after, a layer list from one moment beside the active layer id
    // from another. Nothing throws, and it self-corrects on the next sync,
    // which is exactly the profile of a months-long intermittent.
    //
    // `syncState` runs after essentially every mutation (74 call sites), so
    // this is also eleven boundary crossings per edit reduced to one.
    //
    // ── ADR-024 Stage 3.5, a13: FIRE-AND-FORGET, NOT AWAITED BY ITS CALLERS ──
    //
    // This is async, and all 74 call sites still call it without `await`. That
    // is the decision, not an oversight, and the reasoning is worth keeping
    // because the opposite reading looks more rigorous than it is.
    //
    // Nothing consumes a return value — the only effect is `setState`, which
    // React defers anyway, so no caller can observe "the mirror is refreshed"
    // synchronously TODAY either. Awaiting would therefore buy no caller a
    // guarantee it does not already have, while turning 44 non-async handlers
    // into async ones and rippling through their shared type slots (the v8.6
    // shape) for nothing.
    //
    // What makes that safe is FIFO, which is the port's stated invariant
    // (`lib/engine/port.ts`): one port per document, and a `MessagePort` is
    // ordered. A mutation queued after this capture lands after it, so the
    // snapshot always describes the document as of the moment of the call —
    // which is exactly the ordering the synchronous version had.
    //
    // The one thing FIFO does NOT cover is the document being replaced while a
    // capture is in flight — see `readUiSnapshot`'s liveness guard.
    const snap = await readUiSnapshot(t, () => toolRef.current === t);
    if (!snap) return; // stale capture, discarded
    const {
      has_source,
      undo_count,
      redo_count,
      history_labels,
      zoom,
      width,
      height,
      layers_json,
      active_layer_id,
      export_quality,
    } = snap;

    const history: HistoryEntry[] = history_labels
      .split("|")
      .map((part: string, i: number) => {
        const colon = part.indexOf(":");
        return {
          type: part.slice(0, colon) as HistoryEntry["type"],
          label: part.slice(colon + 1),
          index: i,
        };
      });
    // The engine hands `layers_json` over raw and the parse stays here, where
    // it always was — `LayerInfo`'s shape is a JS type, and parsing it engine
    // side would put a second definition of the format in Rust.
    //
    // `activeLayerId` stays COUPLED to that parse, deliberately. It is a plain
    // u32 that cannot fail, so hoisting it out reads like an obvious tidy-up —
    // but the original reset it to 0 when the layer array failed to parse, and
    // that pairing is the self-consistent one: an empty `layers` beside a
    // non-zero `activeLayerId` describes a layer that is not in the list, and
    // anything downstream doing a lookup would find nothing. Same behaviour as
    // before this became a capture.
    let layers: LayerInfo[];
    let activeLayerId = 0;
    try {
      layers = JSON.parse(layers_json) as LayerInfo[];
      activeLayerId = active_layer_id;
    } catch {
      layers = [];
    }

    setState({
      ready: true,
      hasSource: has_source && !sourceDisarmedRef.current,
      sourcePos: sourcePosRef.current,
      undoCount: undo_count,
      redoCount: redo_count,
      history,
      zoom,
      width,
      height,
      layers,
      activeLayerId,
      // ADR-031. Published here rather than mirrored in React, so an undo that
      // restores the snapshot's quality reaches the slider through the same
      // path as every other engine change.
      exportQuality: export_quality,
    });
  }, []);

  const flushToCanvas = useCallback(() => {
    const t = toolRef.current;
    const canvas = canvasRef.current;
    if (!t || !canvas) return;
    // ADR-024 a12.2 — the five reads that used to live here are GONE, which is
    // what `DISSOLVES_AT_STAGE_4` predicted from the beginning: `width`,
    // `height`, `data_ptr`, `data_len` and the `get_image_data` fallback were
    // exempt from Stage 3.5 because the operation MOVES rather than converts.
    // `data_ptr()` is an index into an address space, not a value, so no amount
    // of awaiting makes it cross a thread.
    //
    // The local/worker choice is inside `blitLiveEngine`, not here. The contract
    // test allows exactly two modules to read the flag, and a call site that
    // branches on it has re-exposed the choice Stage 3.5 exists to hide.
    tryTilesFlush(t).then(registerTilesDirtyCount).catch(() => {});
    syncOplog(t).then(registerOplogStats).catch(() => {});
    void onOplogFlush(t);
    blitLiveEngine(t, canvas, wasmMemoryRef.current, backbufferRef);
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
        // ADR-024 a12.2 — DECODE ON A PRIVATE SURFACE, not the display canvas.
        // This used the visible canvas as scratch: size it, draw the raw image,
        // read it back. That throws once the element is transferred, and it was
        // never a good idea anyway — it flashes the undecorated image on screen
        // before the engine has composited anything. An OffscreenCanvas is
        // never transferred, so this path is identical under both modes.
        const scratch = new OffscreenCanvas(img.width, img.height);
        const ctx = scratch.getContext("2d", { willReadFrequently: true })!;
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, img.width, img.height);
        sizeLiveCanvas(canvas, img.width, img.height);
        // ADR-024 a12.1 — construction goes through the factory, which decides
        // whether the engine lives here or in the worker. `img.onload` cannot be
        // async, so this is `void`-ed; everything after it moved inside.
        void createLiveEngine({
          Tool,
          width: img.width,
          height: img.height,
          pixels: new Uint8Array(imageData.data),
        }).then((tool) => {
          toolRef.current = tool;
          sourcePosRef.current = null;
          URL.revokeObjectURL(url);
          syncState();
        });
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
        // ADR-024 a12.1 — the factory creates and loads; the artboard border
        // and the history clear below stay HERE as ordinary engine calls,
        // because they are this load path's own logic. Folding them into the
        // factory would put five load paths behind one flag branch.
        const tool = await createLiveEngine({ Tool, width, height, pixels: src });
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
        // ADR-024 Stage 3.5 (a8). The READS are awaited here; the
        // `canvas.width =` ASSIGNMENTS are a separate problem that Stage 4 owns
        // — after `transferControlToOffscreen()` they throw on the main thread
        // (see "Stage 4's real scope"). Orthogonal: awaiting the read neither
        // fixes nor worsens the assignment.
        sizeLiveCanvas(canvas, await tool.width(), await tool.height());
        // No raw putImageData here (the composite differs from the photo
        // pixels), so paint the layer composite straight away.
        flushToCanvas();
      } else {
        previewLiveCanvas(
          canvas,
          new Uint8ClampedArray(pixels.buffer as ArrayBuffer),
          width,
          height,
        );
        toolRef.current = await createLiveEngine({ Tool, width, height, pixels: src });
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
      // ADR-024 a12.1 — the one site that REUSES rather than builds. Keep that:
      // on a gallery switch the live engine (local handle or worker proxy) is
      // already the right one, and `oplog_restore` replaces the document
      // wholesale. Only the boot case needs a placeholder, and it goes through
      // the factory so a worker gets one too.
      const tool =
        toolRef.current ?? (await createLiveEngine({ Tool, width: 1, height: 1 }));
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
      // ADR-024 a12.1 — factory creates and loads (which clears history); the
      // layer-stack rebuild and history injection below stay here.
      const tool = await createLiveEngine({
        Tool,
        width: saved.canvasW,
        height: saved.canvasH,
        pixels: new Uint8Array(canvasRgba.buffer as ArrayBuffer),
      });

      // Rebuild the full layer stack (archive v5+) BEFORE injecting history —
      // begin_layer_restore clears history, so it must run first. Each layer's
      // own text/shape overlays are restored onto it (no history noise).
      // Rebuild the full layer stack (archive v5+) via the shared helper —
      // lib/restoreLayerStack.ts. It is shared with the batch-export path so
      // the two cannot drift; see that file for why (#22).
      const usedLayers = await restoreLayerStack(
        tool,
        saved.layers,
        saved.activeLayerId,
        decodePngToRgba,
      );

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
        sizeLiveCanvas(canvas, saved.canvasW, saved.canvasH);
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
