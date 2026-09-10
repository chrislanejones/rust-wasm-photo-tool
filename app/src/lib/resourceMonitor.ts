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

// ── Is anyone actually reading these instruments? ───────────────────────────
//
// `flushToCanvas` published the tile-dirty count and the op-log stats on EVERY
// FRAME, for a window that is closed almost always. That is ~14 engine calls
// per flush — four for `tryTilesFlush` (including `tiles_flush`, a full-image
// diff of the composite) and ten for `syncOplog` — and behind the engine worker
// every one is a postMessage round trip. `tilesFlush.ts` has said so since the
// Stage 3.5 batch: "~0.9 ms of the 16.7 ms budget spent answering a question
// nobody is looking at unless the diagnostics window is open. NOT fixed here,
// deliberately."
//
// This is that fix. `useDiagnostics` declares interest while it is active, and
// the flush path asks before it collects.
//
// ⚠️ WHY THE FLAG LIVES HERE and not in the UI store. `useEngineCore` reading a
// Zustand UI slice would put the engine's per-frame path behind a React
// subscription and invert the layering — this module is already "the single
// registration point for engine-side instruments the diagnostics hook doesn't
// own", so "is anything consuming them" is the same question one level up.
//
// ⚠️ SKIPPING `tiles_flush` IS SAFE, and that was checked rather than assumed:
// `tile_buf` has no reader outside `tiles_flush` / `tiles_dirty_tile_count` /
// `tiles_clear_dirty` — it round-trips composite → tiles → composite purely to
// verify the tile path. `ih_tiles_flush=0` has also been a supported,
// A/B-verified configuration since the 2026-07-17 flip, so "not calling it" is
// a shape the app already ships.
let listening = false;
let resample: (() => void) | null = null;

/** Called by `useDiagnostics` while the window is open and this tab visible. */
export function setDiagnosticsListening(on: boolean): void {
  const was = listening;
  listening = on;
  // A gate alone would leave the panel showing whatever the last edit left
  // behind — or nothing at all, if the user opens it without drawing. On the
  // false → true edge, collect once so the first render has real numbers.
  if (!was && on) resample?.();
}

/** Whether the per-frame instruments are worth collecting. */
export function diagnosticsListening(): boolean {
  return listening;
}

/**
 * Run `collect` only if something is reading the result.
 *
 * ⚠️ A WRAPPER RATHER THAN AN `if` AT THE CALL SITE, on purpose. The call site
 * is the per-frame path, and a bare `if (diagnosticsListening())` there is one
 * deleted line away from silently reinstating ~14 engine calls per frame — with
 * nothing failing, because the app behaves identically either way and only the
 * frame budget notices. Owning the decision here means the gate can be unit
 * tested, and bypassing it takes removing a named function rather than an `if`.
 */
export function collectIfDiagnosticsListening(collect: () => void): void {
  if (listening) collect();
}

/** `useEngineCore` registers the one-shot collector here. Registration is
 *  inverted so this module never imports the engine. */
export function registerDiagnosticsResample(fn: (() => void) | null): void {
  resample = fn;
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
  /** False = the op-log functions are NOT IN THIS WASM BUILD (the v7.28 bug —
   *  see ADR-017). Reported loudly rather than hidden: an absent feature and an
   *  idle one look identical on a counter, and that cost a day. */
  supported: boolean;
  active: boolean;
  broken: boolean;
  ops: number;
  cursor: number;
  keyframes: number;
  undoEnabled: boolean;
  /** WHY it is (not) recording, in one phrase, straight from the engine. */
  status: string;
  /** The layer an edit would land on. "Canvas" ⇒ nothing will record. */
  activeLayer: string;
  layers: number;
  /** The count that decides op-log scope: the Canvas is NOT counted (ADR-016). */
  contentLayers: number;
}

let lastOplogStats: OplogStats | null = null;

export function registerOplogStats(s: OplogStats | null): void {
  lastOplogStats = s;
}

export function getOplogStats(): OplogStats | null {
  return lastOplogStats;
}

// ── Op-log PERSISTENCE stats (what's on disk, vs. the live log above) ────────
// Pushed by @/lib/oplogPersistence on every save / restore / invalidation, so
// the diagnostics window can answer the two questions the dogfooding period
// actually asks: "is my work being written?" and "did this photo come back
// from the op log?". Null whenever persistence is off (the flag's default) —
// the row hides. Register-and-read (not an import from useDiagnostics) keeps
// the lazily-imported persistence module out of the diagnostics import graph.
export interface OplogPersistStats {
  /** The photo these numbers describe. */
  photoId: string;
  /** How this photo's document was obtained. */
  source: "restored" | "saved" | "retired";
  /** Ops / keyframes / chunks currently persisted for it. */
  ops: number;
  keyframes: number;
  chunks: number;
  /** Set when the persisted log was retired (broken log / multi-layer): it is
   *  no longer eligible for restore and the working copy carries the resume. */
  stale: boolean;
  at: number;
}

let lastOplogPersistStats: OplogPersistStats | null = null;

export function registerOplogPersistStats(s: OplogPersistStats | null): void {
  lastOplogPersistStats = s;
}

export function getOplogPersistStats(): OplogPersistStats | null {
  return lastOplogPersistStats;
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
