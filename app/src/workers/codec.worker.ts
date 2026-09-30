// app/src/workers/codec.worker.ts
//
// ONE module Web Worker that owns off-main-thread image ENCODING and
// THUMBNAILING. It runs the CPU/codec-heavy `OffscreenCanvas.convertToBlob`
// step so large JPEG/WebP/AVIF encodes and gallery thumbnails don't jank the
// UI thread.
//
// Scope guardrails (see SESSION_LOG):
//   - No ENGINE wasm here. The Rust engine stays out of this worker; thumbnail
//     resize uses OffscreenCanvas drawImage instead of the Rust bilinear
//     resizer. The one wasm this worker loads is the AVIF encoder, lazily, on
//     the first AVIF encode (lib/avifEncoder.ts, ADR-074).
//   - Pixel buffers arrive as transferables (see codecWorkerClient.ts). Each
//     call builds its own OffscreenCanvas and holds no shared state, so
//     concurrent calls are safe.
//
// Exposed via Comlink; the main-thread facade lives in
// app/src/lib/codecWorkerClient.ts and always keeps a main-thread fallback.

import * as Comlink from "comlink";
import { encodeAvif } from "@/lib/avifEncoder";

/**
 * Wrap raw RGBA bytes as ImageData over a fresh (non-shared) ArrayBuffer.
 * The incoming `pixels` was transferred in, so its buffer is owned by us here;
 * ImageData requires a Uint8ClampedArray, which we can view over the same
 * buffer without another copy.
 */
function toImageData(
  pixels: Uint8Array,
  width: number,
  height: number,
): ImageData {
  const clamped = new Uint8ClampedArray(
    pixels.buffer as ArrayBuffer,
    pixels.byteOffset,
    pixels.byteLength,
  );
  return new ImageData(clamped, width, height);
}

const codecApi = {
  /**
   * Liveness probe. The facade calls this once to confirm the worker actually
   * loaded (module workers that fail to load never answer a message) before it
   * commits to transferring a real pixel buffer.
   */
  ping(): true {
    return true;
  },

  /**
   * Encode an RGBA buffer to `type` (a MIME string, e.g. "image/webp") at the
   * given quality. `pixels` is consumed (transferred in).
   *
   * AVIF goes through the shipped wasm encoder (lib/avifEncoder.ts) — no
   * browser can encode it from a canvas. If that encoder fails, fall through
   * to `convertToBlob`, which answers with an honest image/png blob.
   */
  async encodeImage(
    pixels: Uint8Array,
    width: number,
    height: number,
    type: string,
    quality: number,
  ): Promise<Blob> {
    if (type === "image/avif") {
      try {
        return await encodeAvif(pixels, width, height, quality);
      } catch (err) {
        console.warn("AVIF encoder failed, falling back to canvas", err);
      }
    }
    const oc = new OffscreenCanvas(width, height);
    const ctx = oc.getContext("2d")!;
    ctx.putImageData(toImageData(pixels, width, height), 0, 0);
    return oc.convertToBlob({ type, quality });
  },

  /**
   * Downscale RGBA `pixels` to fit `maxEdge` on the long edge and encode a
   * small WebP thumbnail (quality 0.78 — matches the main-thread path).
   * Resize is done with OffscreenCanvas drawImage (no WASM in the worker).
   * `pixels` is consumed (transferred in).
   */
  async makeThumbnail(
    pixels: Uint8Array,
    width: number,
    height: number,
    maxEdge: number,
  ): Promise<Blob> {
    const longEdge = Math.max(width, height);
    let tw = width;
    let th = height;
    if (longEdge > maxEdge) {
      const scale = maxEdge / longEdge;
      tw = Math.max(1, Math.round(width * scale));
      th = Math.max(1, Math.round(height * scale));
    }

    if (tw === width && th === height) {
      const oc = new OffscreenCanvas(tw, th);
      oc.getContext("2d")!.putImageData(toImageData(pixels, width, height), 0, 0);
      return oc.convertToBlob({ type: "image/webp", quality: 0.78 });
    }

    // Paint full-size, then draw scaled into the thumbnail canvas.
    const full = new OffscreenCanvas(width, height);
    full.getContext("2d")!.putImageData(toImageData(pixels, width, height), 0, 0);

    const thumb = new OffscreenCanvas(tw, th);
    const tctx = thumb.getContext("2d")!;
    tctx.imageSmoothingEnabled = true;
    tctx.imageSmoothingQuality = "high";
    tctx.drawImage(full, 0, 0, tw, th);
    return thumb.convertToBlob({ type: "image/webp", quality: 0.78 });
  },
};

export type CodecAPI = typeof codecApi;

Comlink.expose(codecApi);
