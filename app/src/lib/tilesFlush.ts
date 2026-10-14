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
// Runtime kill switch: `localStorage.setItem("ih_tiles_flush", "0")` in
// DevTools disables the path for one profile (default is ON since the
// 2026-07-17 flip). Not a Settings-panel preference — there is no UI for it.

interface TilesWasmExports {
  tiles_flush(): boolean;
  tiles_dirty_tile_count(): number;
  tiles_clear_dirty(): void;
  tiles_supported_for_document(): boolean;
}

/** Op-log recorder + replay-undo surface (tile-wiring Stage 4) — present
 *  only on a `--features tiles` build, same as the flush exports. */
interface OplogWasmExports {
  set_oplog_undo(enabled: boolean): void;
  oplog_active(): boolean;
  oplog_op_count(): number;
  oplog_cursor(): number;
  oplog_keyframe_count(): number;
  oplog_is_broken(): boolean;
  /** WHY it is (not) recording — "recording", "broken — …", "out of scope — …". */
  oplog_status(): string;
  /** Which layer an edit would land on. "Canvas" means nothing will record. */
  active_layer_name(): string;
  layer_count(): number;
  content_layer_count(): number;
}

function hasTilesExports(t: object): t is TilesWasmExports {
  return typeof (t as Partial<TilesWasmExports>).tiles_flush === "function";
}

function hasOplogExports(t: object): t is OplogWasmExports {
  return (
    typeof (t as Partial<OplogWasmExports>).set_oplog_undo === "function"
  );
}

/** Whether the tile flush path is on. Default ON since the 2026-07-17 flip
 *  (four-check A/B passed); `localStorage.setItem("ih_tiles_flush", "0")` is
 *  the per-profile kill switch. */
export function isTilesFlushEnabled(): boolean {
  try {
    return (
      typeof window === "undefined" ||
      window.localStorage.getItem("ih_tiles_flush") !== "0"
    );
  } catch {
    return true;
  }
}

/** Whether op-log replay should drive undo/redo. Default ON since the
 *  2026-07-17 flip; `localStorage.setItem("ih_oplog_undo", "0")` is the
 *  per-profile kill switch. Recording happens regardless on a tiles build;
 *  this only decides whether `undo()`/`redo()` consult the log — and a
 *  hash-check mismatch still falls back to snapshot undo per ADR-013. */
export function isOplogUndoEnabled(): boolean {
  try {
    return (
      typeof window === "undefined" ||
      window.localStorage.getItem("ih_oplog_undo") !== "0"
    );
  } catch {
    return true;
  }
}

/** The engine surface the push needs. Optional on purpose: a feature-free
 *  wasm (no `tiles`) has no op log, and the fake engines in tests have no
 *  such method either; both simply keep snapshot undo. */
interface OplogUndoEngine {
  set_oplog_undo?: (on: boolean) => void | Promise<void>;
}

/** Push the replay switch into a freshly created engine and hand it back, so
 *  it chains onto `createLiveEngine(...)` beside `withHistoryForks`.
 *
 *  WHY THIS EXISTS (10-11-2026). The engine's `oplog_use_for_undo` defaults to
 *  OFF — it is the runtime verification switch, and the app owns it. Until now
 *  the only push was `syncOplog` below, which `useDiagnosticsSampler` runs ONLY
 *  while the Diagnostics window is open. In an ordinary session the switch never
 *  reached the engine, so `undo()` took the snapshot path, and a snapshot
 *  restore marks a non-empty log broken (lib.rs `restore_snapshot`). That is
 *  PARKING_LOT's "in the running app, undo of ANY recorded edit breaks the op
 *  log": cursor stays 1, status "broken", every undo at snapshot depth — and
 *  why the console runs A/B, taken with Diagnostics open, replayed while the
 *  UI did not. Pinned by e2e/oplog-undo-through-ui.spec.ts (the UI) and
 *  lib/oplogFlushPath.test.ts (the flush path, call by call).
 *
 *  Like `ih_tiles_flush` / `ih_history_forks`, the key takes effect on the
 *  NEXT LOAD: every load path creates its engine through `createLiveEngine`
 *  and chains this, so a mid-session flip is inert until then. */
export async function withOplogUndo<T extends object>(tool: T): Promise<T> {
  await applyOplogUndo(tool);
  return tool;
}

/** Push the switch into a live engine. Never throws. */
export async function applyOplogUndo(tool: OplogUndoEngine | null | undefined): Promise<void> {
  if (!tool || typeof tool.set_oplog_undo !== "function") return;
  try {
    await tool.set_oplog_undo(isOplogUndoEnabled());
  } catch {
    // An engine replaced mid-call, or one without the export: snapshot undo,
    // which is what every undo was before this push existed.
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
export async function tryTilesFlush(tool: object): Promise<number | null> {
  if (!isTilesFlushEnabled() || !hasTilesExports(tool)) return null;
  // ADR-024 a10/3.5. Both guards below are TRUTHY TRAPS: un-awaited, each
  // Promise is truthy, so `!supported` and `!applied` both go false and the
  // function would report a dirty count for documents the tile path does not
  // handle. These were invisible to the audit until v8.21 — `tiles_*` was one
  // of the 31 methods missing from the shadow .d.ts.
  if (!(await tool.tiles_supported_for_document())) return null;
  const applied = await tool.tiles_flush();
  if (!applied) return null;
  const dirty = await tool.tiles_dirty_tile_count();
  tool.tiles_clear_dirty();
  return dirty;
}

/**
 * Push the op-log-undo preference into the engine and read back the recorder's
 * state for diagnostics.
 *
 * `supported: false` means THE ENGINE IN THIS BUILD HAS NO OP-LOG SURFACE — the
 * functions simply aren't in the wasm. That was silently true of every shipped
 * binary until v7.28 (`build:wasm` didn't pass `--features tiles`), which made the
 * three flags gate calls into code that did not exist: everything fell back to
 * snapshot undo with no error, and the panel showed nothing at all. Reporting it
 * loudly instead of hiding the row is the cheap insurance against that recurring.
 */
// ⚠️ ADR-024 — NINE ENGINE READS, ONCE PER FLUSH, FOR A DIAGNOSTICS PANEL.
//
// Nothing here is user-visible: `registerOplogStats` stores the result in a
// module variable that only `useDiagnostics` reads. But `flushToCanvas` calls
// this on every flush, so behind the worker it is nine round trips per frame —
// ~0.9 ms of the 16.7 ms budget spent answering a question nobody is looking at
// unless the diagnostics window is open.
//
// NOT fixed here, deliberately: this batch converts, it does not redesign, and
// the honest options (one `capture_oplog_stats()` on the Rust side, the a3/a5
// atomic-capture pattern; or throttling to a few Hz; or only running it while
// the panel is open) each change behavior and deserve their own decision.
// Recorded in PARKING_LOT.md so Stage 5's frame timeline is read with it in
// mind rather than blamed on the architecture.
export async function syncOplog(
  tool: object,
): Promise<import("@/lib/resourceMonitor").OplogStats> {
  if (!hasOplogExports(tool)) {
    return {
      supported: false,
      active: false,
      broken: false,
      ops: 0,
      cursor: 0,
      keyframes: 0,
      undoEnabled: false,
      status: "ABSENT — this wasm build has no op-log (see ADR-017)",
      activeLayer: "",
      layers: 0,
      contentLayers: 0,
    };
  }
  const undoEnabled = isOplogUndoEnabled();
  tool.set_oplog_undo(undoEnabled);
  return {
    supported: true,
    active: await tool.oplog_active(),
    broken: await tool.oplog_is_broken(),
    ops: await tool.oplog_op_count(),
    cursor: await tool.oplog_cursor(),
    keyframes: await tool.oplog_keyframe_count(),
    undoEnabled,
    // The line that answers "why is this zero?" — see ImageHorseTool::oplog_status.
    status: await tool.oplog_status(),
    activeLayer: await tool.active_layer_name(),
    layers: await tool.layer_count(),
    contentLayers: await tool.content_layer_count(),
  };
}
