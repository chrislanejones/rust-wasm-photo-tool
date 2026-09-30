// app/src/lib/avifEncoder.ts
//
// The one AVIF encoder Image Horse ships.
//
// No browser can encode AVIF from a canvas — Chrome decodes it but
// `convertToBlob({ type: "image/avif" })` hands back a PNG, silently (see
// lib/encodeSupport.ts). So "export as AVIF" used to mean "export as PNG".
// This wraps `@jsquash/avif` (libavif + libaom, repackaged from Squoosh) —
// option (1) in the PARKING_LOT AVIF entry, recorded in ADR-074.
//
// The encoder is ~3.5 MB of wasm, so it is NEVER in the initial bundle: the
// dynamic `import()` below is the only reference, and it resolves on the first
// AVIF encode. Both the codec worker and the main-thread fallback call this
// same function, so the two backends cannot drift in options.

/** libaom speed, 0 (slowest, smallest) … 10. The library default is 6.
 *  Measured on a 6 MP image in single-threaded wasm: speed 6 took ~3.3 s,
 *  speed 8 ~0.8 s, for a file ~1–20% larger. Auto Compress and the export
 *  size-fit loop encode more than once per save, so 4× faster wins. */
const AVIF_SPEED = 8;

type AvifModule = typeof import("@jsquash/avif/encode.js");
let modulePromise: Promise<AvifModule> | null = null;

function loadEncoder(): Promise<AvifModule> {
  if (!modulePromise) {
    modulePromise = import("@jsquash/avif/encode.js").catch((err: unknown) => {
      // Let a later call retry — a failed chunk fetch is often transient.
      modulePromise = null;
      throw err;
    });
  }
  return modulePromise;
}

/** Map the app's 0..1 quality onto libavif's 0..100. Clamped so a stray
 *  out-of-range value cannot reach the encoder. */
export function avifQuality(quality01: number): number {
  if (!Number.isFinite(quality01)) return 50;
  return Math.min(100, Math.max(0, Math.round(quality01 * 100)));
}

/**
 * Encode straight-alpha RGBA to an AVIF Blob. Alpha is kept (AVIF carries
 * it). Throws if the encoder cannot load or fails — callers decide the
 * fallback. Does not detach or mutate `pixels`.
 */
export async function encodeAvif(
  pixels: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
  quality01: number,
): Promise<Blob> {
  const { default: encode } = await loadEncoder();
  const data = new Uint8ClampedArray(
    pixels.buffer as ArrayBuffer,
    pixels.byteOffset,
    pixels.byteLength,
  );
  const out = await encode(
    { data, width, height, colorSpace: "srgb" } as ImageData,
    { quality: avifQuality(quality01), speed: AVIF_SPEED },
  );
  return new Blob([out], { type: "image/avif" });
}
