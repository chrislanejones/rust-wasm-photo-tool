// app/src/lib/resourceMonitor.ts
//
// Registration point for the WASM engine's live memory handle, plus the
// shared byte formatter. The actual polling/tiering lives in
// app/src/hooks/useDiagnostics.ts — this file only holds the primitive
// useCloneStamp needs to hand off its WebAssembly.Memory without the
// diagnostics hook owning a second instance of the engine.

let wasmMemory: WebAssembly.Memory | null = null;

export function registerWasmMemory(mem: WebAssembly.Memory): void {
  wasmMemory = mem;
}

/** WASM linear memory size in bytes, or null until the engine loads. */
export function getWasmMemoryBytes(): number | null {
  return wasmMemory ? wasmMemory.buffer.byteLength : null;
}

// ── Tile-engine dirty-tile count (MORNING_SESSION_tile-wiring.md, Stage 2) ──
// useCloneStamp's flushToCanvas reports the result of each tiles_flush() call
// here (see @/lib/tilesFlush) — null when the tile path isn't active for this
// flush (toggle off / build lacks the exports / multi-layer document), a
// count otherwise. This is the live instrument Stage 2's "does a small stroke
// only dirty a few tiles, not the whole image" verification reads. Read via
// getTilesDirtyCount() by useDiagnostics.ts, same pattern as the wasm handle
// above — this file stays the single registration point for engine-side
// instruments the diagnostics hook doesn't own.
let lastTilesDirtyCount: number | null = null;

export function registerTilesDirtyCount(n: number | null): void {
  lastTilesDirtyCount = n;
}

export function getTilesDirtyCount(): number | null {
  return lastTilesDirtyCount;
}

// ── Op-log recorder stats (tile-wiring Stage 4) ─────────────────────────────
// Same pattern as the dirty-tile count: flushToCanvas reports the engine's
// op-log state after each flush (null when the build lacks the exports).
// This is the live instrument for "op count climbs, keyframes appear,
// restored-from-log" verification.
export interface OplogStats {
  active: boolean;
  broken: boolean;
  ops: number;
  cursor: number;
  keyframes: number;
  undoEnabled: boolean;
}

let lastOplogStats: OplogStats | null = null;

export function registerOplogStats(s: OplogStats | null): void {
  lastOplogStats = s;
}

export function getOplogStats(): OplogStats | null {
  return lastOplogStats;
}

/** Format a byte count as a compact human string (e.g. "18.4 MB"). */
export function fmtBytes(bytes: number | null): string {
  if (bytes == null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let v = bytes / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v.toFixed(v < 10 ? 1 : 0)} ${units[i]}`;
}
