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
  /** Current file's MIME type (e.g. "image/jpeg"); undefined if unknown. */
  curMime?: string;
  /** Pending output format from the panel's Format dropdown. */
  newFormat?: "png" | "jpeg" | "webp" | "avif";
}

export interface WebPerfResult {
  /** PageSpeed-Insights-style score (0..100); low for big, unoptimized images. */
  lighthouseScore: number;
  /** Byte savings vs. the current file (0..100); 0 when nothing changed. */
  performanceGain: number;
}

/** Map a MIME type or format id to the Rust format code (PSI next-gen audit). */
function formatCode(value?: string): number {
  switch (value) {
    case "image/png":
    case "png":
      return 0;
    case "image/jpeg":
    case "jpeg":
      return 1;
    case "image/webp":
    case "webp":
      return 2;
    case "image/avif":
    case "avif":
      return 3;
    default:
      return 255; // unknown → neutral 1.0 weight in Rust
  }
}

/**
 * Compute the PageSpeed Insights score and Web Performance Gain from the
 * Rust/WASM source of truth. Async: it lazily initializes the wasm module
 * before calling the exported `web_perf_metrics` function.
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
    formatCode(input.curMime),
    formatCode(input.newFormat),
  );
  return {
    lighthouseScore: Math.round(score),
    performanceGain: Math.round(gain),
  };
}
