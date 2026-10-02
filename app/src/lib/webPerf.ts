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
  /** Pending output format from the panel's Format dropdown. Undefined means
   *  the file keeps its current format (no compression pending). */
  newFormat?: "png" | "jpeg" | "webp" | "avif";
}

export interface WebPerfResult {
  /**
   * The budget USED, as a percentage. 100 or less clears the audit; above 100
   * is the flagged case, and says by how much.
   *
   * Deliberately NOT a 0–100 Lighthouse score — the audit has no such thing
   * for one image, and the old fabricated curve gave a small clean photo ~90
   * and a large heavy one ~50, which is backwards for the case users bring.
   */
  budgetUsed: number;
  /** Byte savings vs. the current file (0..100); 0 when nothing changed. */
  performanceGain: number;
}

/**
 * THE BUDGET LIGHTHOUSE ACTUALLY MEASURES AGAINST.
 *
 * From `ImageDelivery.js` in `@paulirish/trace_engine`, which backs Lighthouse's
 * current `image-delivery-insight` (it replaced `modern-image-formats`,
 * `uses-optimized-images` and `uses-responsive-images`):
 *
 *     const TARGET_BYTES_PER_PIXEL_AVIF = 2 * 1 / 12;   // 0.1667 bytes/px
 *     const bytesPerPixel = imageBytes / imageFilePixels;
 *     if (bytesPerPixel > TARGET_BYTES_PER_PIXEL_AVIF) { /* flagged *\/ }
 *
 * So the rule is BYTES PER PIXEL, not absolute bytes, and there is no 0–100
 * image score anywhere in it. An image passes when
 * `bytes <= width * height / 6`.
 *
 * This matters in both directions, which is why the old flat 200 KB was wrong
 * for every image: a 400×300 thumbnail needs ~20 KB (200 KB would be flagged)
 * and a 24 MP photo is allowed 4 MB (200 KB over-compresses it).
 *
 * The 4096-byte minimum is Lighthouse's own `BYTE_SAVINGS_THRESHOLD`: below it
 * an image is never listed, so there is nothing to gain by encoding smaller.
 *
 * The clamp keeps this reachable. A tiny image's ideal size is smaller than any
 * encoder will usefully reach, and an unbounded target would send the budget
 * loop spinning at a floor it cannot pass.
 */
/** Lighthouse does not list an image saving fewer bytes than this. */
const BYTE_SAVINGS_THRESHOLD = 4096;
const MIN_BUDGET_BYTES = 24 * 1024;
const MAX_BUDGET_BYTES = 1024 * 1024;

/**
 * The byte budget for an image of `w × h` — the size at which Lighthouse stops
 * flagging it. One definition, shared by the Auto Compress loop and anything
 * else that has to hit the target.
 */
export function webTargetBytes(w: number, h: number): number {
  const ideal = Math.round((w * h) / 6);
  return Math.max(
    MIN_BUDGET_BYTES + BYTE_SAVINGS_THRESHOLD,
    Math.min(MAX_BUDGET_BYTES, ideal),
  );
}

/** True when `bytes` at `w × h` clears the budget. */
export function passesWebBudget(bytes: number, w: number, h: number): boolean {
  if (w <= 0 || h <= 0) return false;
  return bytes <= webTargetBytes(w, h);
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
 * Compute the PageSpeed budget-used percentage and Web Performance Gain from
 * the Rust/WASM source of truth. Async: it lazily initializes the wasm module
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
    formatCode(input.newFormat ?? input.curMime),
  );
  return {
    budgetUsed: Math.round(score),
    performanceGain: Math.round(gain),
  };
}
