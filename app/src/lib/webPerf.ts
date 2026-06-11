// app/src/lib/webPerf.ts
//
// Web-performance indicators for the Resize & Compress panel. The math lives in
// Rust (`web_perf_metrics` in src/lib.rs) so the WASM layer stays the single
// source of truth — this module just initializes the wasm module (same pattern
// as photoLimits.ts) and forwards the call.

export interface WebPerfInput {
  /** Current working width of the active photo, in px. */
  curW: number;
  /** Current working height of the active photo, in px. */
  curH: number;
  /** Current on-disk size of the active photo, in bytes (0 if unknown). */
  curBytes: number;
  /** Immutable size at upload, in bytes — the gain baseline (0 if unknown). */
  origBytes: number;
  /** Pending output width, in px. */
  newW: number;
  /** Pending output height, in px. */
  newH: number;
  /** Pending encode quality, 0..100. */
  quality: number;
}

export interface WebPerfResult {
  /** Google-Lighthouse-style score (0..100); low for big, uncompressed images. */
  lighthouseScore: number;
  /** Byte savings vs. the current file (0..100); 0 when nothing changed. */
  performanceGain: number;
}

/**
 * Compute the Lighthouse score and Web Performance Gain from the Rust/WASM
 * source of truth. Async: it lazily initializes the wasm module before calling
 * the exported `web_perf_metrics` function.
 */
export async function getWebPerfMetrics(
  input: WebPerfInput,
): Promise<WebPerfResult> {
  const mod = await import("stamp_tool");
  await mod.default();
  const [score, gain] = mod.web_perf_metrics(
    input.curW,
    input.curH,
    input.curBytes,
    input.origBytes,
    input.newW,
    input.newH,
    input.quality,
  );
  return {
    lighthouseScore: Math.round(score),
    performanceGain: Math.round(gain),
  };
}
