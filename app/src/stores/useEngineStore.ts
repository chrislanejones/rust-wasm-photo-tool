// The engine's SERIALIZABLE snapshot — dimensions, layer stack, history, zoom,
// clone-source mirror — as a Zustand store so components subscribe to the
// slices they actually use instead of receiving the whole thing through props.
//
// Why this exists (step 2 of the clonestamp-split): `CloneStampState` lived in
// a `useState` inside the engine hook, so every engine sync re-rendered
// AppShell, and AppShell handed CanvasArea the entire 62-key hook result as a
// prop. Measured before this change: **20 quality-slider changes produced 20
// CanvasArea renders** — a 1:1 coupling to AppShell for state CanvasArea never
// reads. Selectors cut that.
//
// WHAT DOES NOT GO IN HERE, deliberately:
//   - `toolRef` / the WASM handle — not serializable, and a store is the wrong
//     home for an imperative resource with a lifecycle. It stays in
//     useEngineCore.
//   - Callbacks (undo, addLayer, exportPng…) — stores hold DATA. The domain
//     hooks own behaviour; putting functions here would just relocate the
//     coupling into a different file.
//   - Anything persisted. This mirrors live engine state and is rebuilt from
//     the engine on every load; persisting it would let a stale snapshot
//     contradict the WASM instance, which is exactly the skew the op-log
//     hash-check exists to catch.
import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";

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

export interface EngineSnapshot {
  ready: boolean;
  hasSource: boolean;
  sourcePos: { x: number; y: number } | null;
  undoCount: number;
  redoCount: number;
  history: HistoryEntry[];
  zoom: number;
  /** Exposed so components re-render when dimensions change (e.g. after rotate). */
  width: number;
  height: number;
  /** True if the loaded image contains any transparent pixels (Rust alpha scan). */
  hasTransparency: boolean;
  /** Layer stack, bottom → top, mirrored from Rust. */
  layers: LayerInfo[];
  /** Id of the active layer (receives all tool edits). */
  activeLayerId: number;
}

/** Kept exported under the historical name: `StatusBar`, `ReviewPanel` and the
 *  session hooks all type against `CloneStampState`, and this refactor is not
 *  the place to rename a type across 17 files. */
export type CloneStampState = EngineSnapshot;

export const INITIAL_ENGINE_STATE: EngineSnapshot = {
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

interface EngineStoreState extends EngineSnapshot {
  /** Replace the whole snapshot — called by useEngineCore.syncState after any
   *  engine mutation. One write per sync keeps the store a faithful mirror
   *  rather than a second source of truth that can drift. */
  setSnapshot: (s: EngineSnapshot) => void;
  /** Back to not-ready (gallery emptied / engine released). */
  resetSnapshot: () => void;
}

export const useEngineStore = create<EngineStoreState>()((set) => ({
  ...INITIAL_ENGINE_STATE,
  setSnapshot: (s) => set(s),
  resetSnapshot: () => set(INITIAL_ENGINE_STATE),
}));

/** The whole snapshot as one object, shallow-compared.
 *
 *  For consumers that genuinely need most of it (the facade's `state`, the
 *  status bar). Shallow comparison is the point: `setSnapshot` writes a fresh
 *  object every sync, so a plain subscription would re-render on every engine
 *  tick even when nothing it reads changed. `history` and `layers` are new
 *  array identities per sync, so those DO still re-render — which is correct,
 *  they're the things that actually changed. */
export function useEngineSnapshot(): EngineSnapshot {
  return useEngineStore(
    useShallow((s) => ({
      ready: s.ready,
      hasSource: s.hasSource,
      sourcePos: s.sourcePos,
      undoCount: s.undoCount,
      redoCount: s.redoCount,
      history: s.history,
      zoom: s.zoom,
      width: s.width,
      height: s.height,
      hasTransparency: s.hasTransparency,
      layers: s.layers,
      activeLayerId: s.activeLayerId,
    })),
  );
}

/** Just the document dimensions — what CanvasArea needs for layout math.
 *  Scalar-only, so it re-renders on a resize/rotate/crop and nothing else. */
export function useEngineDimensions(): { width: number; height: number } {
  return useEngineStore(
    useShallow((s) => ({ width: s.width, height: s.height })),
  );
}
