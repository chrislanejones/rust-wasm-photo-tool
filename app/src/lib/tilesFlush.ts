// Tile-engine flush path — verification-only, NOT a shipped preference.
//
// `tiles_flush`/`tiles_dirty_tile_count`/`tiles_clear_dirty`/
// `tiles_supported_for_document` only exist on a wasm build compiled with
// `--features tiles` (see Cargo.toml's `tiles` feature comment) — the
// default, shipped `pkg/` never has them. They are deliberately NOT added to
// the shared ambient `app/src/hooks/stamp_tool.d.ts` (which describes what
// the shipped build actually has) — same precedent as
// `app/src/lib/threadedBlurBench.ts`'s `ThreadedWasmExports` — so feature-
// detect at runtime via a local interface + cast instead of widening the
// ambient surface to something that isn't always true.
//
// Runtime toggle: `localStorage.setItem("ih_tiles_flush", "1")` in DevTools.
// This is a MORNING_SESSION_tile-wiring.md Stage 1/2 verification switch,
// not a Settings-panel preference — there is no UI for it.

export interface TilesWasmExports {
  tiles_flush(): boolean;
  tiles_dirty_tile_count(): number;
  tiles_clear_dirty(): void;
  tiles_supported_for_document(): boolean;
}

/** Op-log recorder + replay-undo surface (tile-wiring Stage 4) — present
 *  only on a `--features tiles` build, same as the flush exports. */
export interface OplogWasmExports {
  set_oplog_undo(enabled: boolean): void;
  oplog_active(): boolean;
  oplog_op_count(): number;
  oplog_cursor(): number;
  oplog_keyframe_count(): number;
  oplog_is_broken(): boolean;
}

function hasTilesExports(t: object): t is TilesWasmExports {
  return typeof (t as Partial<TilesWasmExports>).tiles_flush === "function";
}

function hasOplogExports(t: object): t is OplogWasmExports {
  return (
    typeof (t as Partial<OplogWasmExports>).set_oplog_undo === "function"
  );
}

/** Whether the verification toggle is on (see module doc above). */
export function isTilesFlushEnabled(): boolean {
  try {
    return (
      typeof window !== "undefined" &&
      window.localStorage.getItem("ih_tiles_flush") === "1"
    );
  } catch {
    return false;
  }
}

/** Whether op-log replay should drive undo/redo. Same verification-switch
 *  pattern as `ih_tiles_flush`: `localStorage.setItem("ih_oplog_undo", "1")`
 *  in DevTools, no UI. Recording happens regardless on a tiles build; this
 *  only decides whether `undo()`/`redo()` consult the log. */
export function isOplogUndoEnabled(): boolean {
  try {
    return (
      typeof window !== "undefined" &&
      window.localStorage.getItem("ih_oplog_undo") === "1"
    );
  } catch {
    return false;
  }
}

/**
 * Route the just-recomposited `composite_cache` through the tile engine, if
 * (a) the toggle is on, (b) this wasm build actually has the exports (a
 * default build never does), and (c) the current document is in scope
 * (single layer — see `tiles_flush`'s Rust-side doc comment).
 *
 * Returns the dirty-tile count for this flush, or `null` if the tile path
 * isn't active for this call (toggle off, build lacks the exports, or a
 * multi-layer document) — kept distinct from `0` (active, but nothing
 * changed since the last flush) so the diagnostics display can show "n/a"
 * instead of a misleading zero.
 */
export function tryTilesFlush(tool: object): number | null {
  if (!isTilesFlushEnabled() || !hasTilesExports(tool)) return null;
  if (!tool.tiles_supported_for_document()) return null;
  const applied = tool.tiles_flush();
  if (!applied) return null;
  const dirty = tool.tiles_dirty_tile_count();
  tool.tiles_clear_dirty();
  return dirty;
}

/**
 * Push the op-log-undo preference into the engine and read back the
 * recorder's state for diagnostics. Returns `null` when this wasm build has
 * no op-log surface (the default, shipped build never does) — 100% inert
 * there, same as `tryTilesFlush`.
 */
export function syncOplog(
  tool: object,
): import("@/lib/resourceMonitor").OplogStats | null {
  if (!hasOplogExports(tool)) return null;
  const undoEnabled = isOplogUndoEnabled();
  tool.set_oplog_undo(undoEnabled);
  return {
    active: tool.oplog_active(),
    broken: tool.oplog_is_broken(),
    ops: tool.oplog_op_count(),
    cursor: tool.oplog_cursor(),
    keyframes: tool.oplog_keyframe_count(),
    undoEnabled,
  };
}
