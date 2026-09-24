// The atomic UI capture — the eleven values `syncState` publishes to React,
// and the liveness guard that makes reading them safe to await.
//
// EXTRACTED from `useEngineCore.ts` (2026-09-24, with the Time Machine's
// branch list). That file sat at exactly 900 lines, the eslint `max-lines`
// cap, so the next line added to it anywhere would have tripped the ratchet —
// and the config's own note says the answer to that is an extraction, never
// another entry on its override list. This is the coherent piece to take: one
// exported function, its two types and its own test file, none of which need
// the hook's refs, state or engine lifecycle.
//
// `readUiSnapshot`'s doc comment below is the original, unedited — the guard
// it describes is the whole reason this code has a test.
import type { UiStateCapture } from "stamp_tool";

/** The eleven values `capture_ui_state()` carries, copied out of wasm memory. */
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
  /** The Time Machine's branch list, raw (ADR-065) — parsed in `syncState`
   *  beside `layers_json`, for the same reason that one is parsed there. */
  branches_json: string;
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
 * The check is engine IDENTITY, not a counter. `tool` is the thing the capture was
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
  // Named `tool`, not `t`: `engine-call-audit.mjs` recognises an engine
  // receiver either literally (`tool` / `engine` / `toolRef.current`) or as a
  // file-local alias of `toolRef.current`. In `useEngineCore.ts` this
  // parameter was `t` and the alias rule covered it; in a file with no such
  // assignment it would not be, and the `await` below — the one the Stage 3.5
  // gate counts — would drop out of the audit silently. Moving code is exactly
  // how a gate loses sight of a call.
  tool: UiStateSource,
  stillLive: () => boolean,
): Promise<UiSnapshot | null> {
  const ui = await tool.capture_ui_state();
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
      branches_json: ui.branches_json,
    };
  } finally {
    // BOTH paths free. The stale path is the one that matters: it is the new
    // path a13 added, it runs exactly when the app is busy switching photos,
    // and a leak there would be per-photo-switch and invisible.
    ui.free();
  }
}
