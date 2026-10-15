// Diagnostics go to the browser console (DevTools → Console), tagged by source.
//
// This used to be a 500-entry in-memory buffer shown in the Diagnostics
// window's System Telemetry tab, plus a wrapper around console.error/warn/info
// that copied every console line into that buffer. Chris (10-14-2026): "can't
// this just be in the terminal". So it is: one line per event, nothing kept,
// nothing wrapped. Timed operations print at debug level (Chrome's "Verbose"
// filter) so they don't crowd the default view.

export type LogSource =
  | "WASM_ENGINE"
  | "CONVEX_DB"
  // Local IndexedDB, distinct from CONVEX_DB — that one is the cloud.
  | "INDEXEDDB"
  | "REPLICATE_AI"
  | "UI_THREAD"
  | "CONSOLE";

export function logDiagnostic(source: LogSource, message: string, durationMs?: number): void {
  if (typeof console === "undefined") return;
  if (durationMs === undefined) console.info(`[${source}] ${message}`);
  else console.debug(`[${source}] ${message} (${durationMs.toFixed(1)} ms)`);
}
