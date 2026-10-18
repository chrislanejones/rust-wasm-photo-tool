// The op-log undo switch: its localStorage kill switch and the push into each
// new engine. The tile-flush verification path and the Diagnostics reads
// (`tryTilesFlush`, `syncOplog`) that used to live here were removed with the
// Resources tab on 10-14-2026: they only ever ran while that window was open.

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
 *  the only push was `syncOplog` (since removed), which the Diagnostics sampler
 *  ran ONLY while the Diagnostics window was open. In an ordinary session the switch never
 *  reached the engine, so `undo()` took the snapshot path, and a snapshot
 *  restore marks a non-empty log broken (lib.rs `restore_snapshot`). That is
 *  PARKING_LOT's "in the running app, undo of ANY recorded edit breaks the op
 *  log": cursor stays 1, status "broken", every undo at snapshot depth — and
 *  why the console runs A/B, taken with Diagnostics open, replayed while the
 *  UI did not. Pinned by e2e/oplog-undo-through-ui.spec.ts (the UI) and
 *  lib/oplogFlushPath.test.ts (the flush path, call by call).
 *
 *  Like `ih_history_forks`, the key takes effect on the
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
