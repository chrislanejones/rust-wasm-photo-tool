// The two per-frame instruments the Diagnostics window reads, and the gate that
// stops them running when it is closed.
//
// WHY ITS OWN MODULE. `useEngineCore.ts` sits at 899 lines against a 900-line
// `max-lines` warning — it is at its limit, and this is not its subject. The
// sampler is also the kind of thing that grows (a third instrument, a throttle,
// a per-tier split), and growing it here costs nothing.
//
// WHAT IT COSTS TO NOT GATE THIS. `flushToCanvas` is the per-frame path, and
// these two are ~14 engine calls between them: `tryTilesFlush` runs
// `tiles_supported_for_document`, `tiles_flush` (a FULL-IMAGE diff of the
// composite), `tiles_dirty_tile_count` and `tiles_clear_dirty`; `syncOplog`
// makes ten reads. Behind the engine worker every one is a postMessage round
// trip. `tilesFlush.ts` measured it at ~0.9 ms of a 16.7 ms budget and said
// "NOT fixed here, deliberately" — this is where it gets fixed.
//
// ⚠️ SKIPPING `tiles_flush` IS SAFE, checked rather than assumed. `tile_buf` has
// no reader outside `tiles_flush` / `tiles_dirty_tile_count` /
// `tiles_clear_dirty`; it round-trips composite → tiles → composite purely to
// verify the tile path. And `ih_tiles_flush=0` has been a supported,
// A/B-verified configuration since the 2026-07-17 flip, so "not calling it" is
// a shape the app already ships.

import { useCallback, useEffect } from "react";
import type { ImageHorseTool } from "stamp_tool";
import { syncOplog, tryTilesFlush } from "@/lib/tilesFlush";
import {
  collectIfDiagnosticsListening,
  registerDiagnosticsResample,
  registerOplogStats,
  registerTilesDirtyCount,
} from "@/lib/resourceMonitor";

/**
 * Returns the per-frame sampler for `flushToCanvas` to call, and keeps
 * `resourceMonitor` supplied with a one-shot collector so opening the window
 * samples immediately instead of waiting for the next edit.
 */
export function useDiagnosticsSampler(
  toolRef: React.MutableRefObject<ImageHorseTool | null>,
): (tool: object) => void {
  /** One definition of "what gets published", shared by the per-frame path and
   *  the open-the-window path, so the two cannot drift. */
  const collect = useCallback((t: object) => {
    tryTilesFlush(t).then(registerTilesDirtyCount).catch(() => {});
    syncOplog(t).then(registerOplogStats).catch(() => {});
  }, []);

  // Registered here rather than imported over there: `resourceMonitor` must not
  // depend on the engine, so the dependency is inverted.
  useEffect(() => {
    registerDiagnosticsResample(() => {
      const t = toolRef.current;
      if (t) collect(t);
    });
    return () => registerDiagnosticsResample(null);
  }, [collect, toolRef]);

  return useCallback(
    (t: object) => collectIfDiagnosticsListening(() => collect(t)),
    [collect],
  );
}
