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
