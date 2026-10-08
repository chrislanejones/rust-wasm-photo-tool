// ===== FILE: app/src/lib/imageLimits.ts =====
/**
 * Source-resolution ceiling, shared by every decode boundary.
 *
 * A decompression bomb or a genuinely huge image can OOM the tab during the
 * full-res decode, before any downscale applies. We can't size-limit a decode
 * without parsing headers, so each boundary rejects as soon as it knows the
 * dimensions -- turning a silent crash into a catchable error the caller can
 * surface as a toast.
 *
 * 100 MP (~12000x8333) clears every consumer camera (<=50 MP today) with
 * headroom while still blocking pathological inputs.
 *
 * The number is private: the two helpers below are the API, so no caller can
 * re-derive the comparison and drift from it.
 *
 * It lives in its own module because the HEIC decoder applies the same ceiling
 * from inside the codec worker, and `workingCopy.ts` (where this constant used
 * to live) reaches for `codecWorkerClient`, which constructs that worker --
 * importing it from worker code would nest a worker inside a worker.
 */
const MAX_SOURCE_MEGAPIXELS = 100;

/** True if `width x height` is past the ceiling above. */
export function exceedsPixelBudget(width: number, height: number): boolean {
  return width * height > MAX_SOURCE_MEGAPIXELS * 1_000_000;
}

/** The one wording for "this image is too big", used by every boundary that
 *  enforces the ceiling — including the codec worker, which can only send a
 *  message back across Comlink, never an error subclass. */
export function tooLargeMessage(width: number, height: number): string {
  return (
    `Image is too large to open (${width}x${height}, ` +
    `${Math.round((width * height) / 1_000_000)} MP). ` +
    `The limit is ${MAX_SOURCE_MEGAPIXELS} MP.`
  );
}
