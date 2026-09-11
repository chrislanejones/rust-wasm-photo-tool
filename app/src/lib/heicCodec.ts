// ===== FILE: app/src/lib/heicCodec.ts =====
/**
 * HEIC/HEIF → RGBA, via libheif compiled to WebAssembly.
 *
 * DOM-FREE ON PURPOSE. This module runs inside the codec worker
 * (workers/codec.worker.ts) and must not reach for `document`, `Image` or any
 * other main-thread-only API.
 *
 * IT CANNOT RUN ON THE MAIN THREAD AT ALL, which is the reason the codec
 * worker — and not lib/heic.ts — owns the decode. The libheif bundle
 * initializes with a synchronous `new WebAssembly.Module(bytes)`, and browsers
 * refuse synchronous WASM compilation on the main thread for anything over
 * 4 KB; this binary is ~1.4 MB. In a worker there is no such limit. (The
 * package's other build is pure JS with no WASM and would work on the main
 * thread, but it is ~3 MB of JavaScript and decodes an iPhone photo in
 * double-digit seconds.)
 *
 * Nothing here is loaded until a HEIC actually arrives: the import is dynamic,
 * so the ~2 MB bundle is its own chunk that a session which never opens a HEIC
 * never fetches.
 */

import type { LibHeif } from "libheif-js/libheif-wasm/libheif-bundle.mjs";
import { exceedsPixelBudget, tooLargeMessage } from "@/lib/imageLimits";

export interface DecodedImage {
  /** Straight (non-premultiplied) RGBA, `width * height * 4` bytes. */
  pixels: Uint8ClampedArray<ArrayBuffer>;
  width: number;
  height: number;
}

/** Memoized module instance — compiling 1.4 MB of WASM once per worker is
 *  plenty, and a gallery import decodes many files back to back. */
let libheifPromise: Promise<LibHeif> | null = null;

function loadLibheif(): Promise<LibHeif> {
  if (!libheifPromise) {
    libheifPromise = import("libheif-js/libheif-wasm/libheif-bundle.mjs").then(
      (mod) => mod.default(),
    );
  }
  return libheifPromise;
}

/**
 * Undo alpha premultiplication in place. libheif reports whether the container
 * stored premultiplied alpha; canvas `ImageData` is defined as straight alpha,
 * so a premultiplied buffer painted as-is comes out too dark at the edges.
 */
function unpremultiply(rgba: Uint8ClampedArray): void {
  for (let i = 0; i < rgba.length; i += 4) {
    const a = rgba[i + 3];
    if (a === 0 || a === 255) continue;
    const scale = 255 / a;
    rgba[i] = Math.min(255, Math.round(rgba[i] * scale));
    rgba[i + 1] = Math.min(255, Math.round(rgba[i + 1] * scale));
    rgba[i + 2] = Math.min(255, Math.round(rgba[i + 2] * scale));
  }
}

/**
 * Decode the primary image out of a HEIC/HEIF container.
 *
 * Rotation is NOT applied here because libheif already applied it: the
 * `irot`/`imir` transform boxes an iPhone writes instead of an EXIF
 * orientation tag are honored by `heif_decode_image` itself, so the pixels
 * come back the way up the photo was taken.
 *
 * Throws on a container we can't read, and on one whose primary image is past
 * the shared source-resolution ceiling (checked BEFORE the decode allocates,
 * since that is the allocation that would OOM the tab).
 */
export async function decodeHeicToRgba(bytes: Uint8Array): Promise<DecodedImage> {
  const libheif = await loadLibheif();
  const images = new libheif.HeifDecoder().decode(bytes);
  if (!images || images.length === 0) {
    throw new Error("No image found in this HEIC file");
  }

  // A HEIC can hold several top-level images (a burst, or a Live Photo's
  // still + its thumbnail). The container names one of them primary; that is
  // the one every viewer shows, so it is the one we open.
  const image = images.find((img) => img.is_primary()) ?? images[0];
  try {
    const width = image.get_width();
    const height = image.get_height();
    if (!(width > 0) || !(height > 0)) {
      throw new Error("HEIC image reports no usable size");
    }
    if (exceedsPixelBudget(width, height)) {
      throw new Error(tooLargeMessage(width, height));
    }

    const target = {
      data: new Uint8ClampedArray(width * height * 4),
      width,
      height,
    };
    const filled = await new Promise<{ data: Uint8ClampedArray<ArrayBuffer> }>((resolve, reject) => {
      image.display(target, (result) => {
        if (result) resolve(result);
        else reject(new Error("HEIC decode failed"));
      });
    });

    if (image.is_premultiplied_alpha()) unpremultiply(filled.data);
    return { pixels: filled.data, width, height };
  } finally {
    // Every image in the container holds WASM heap; the decoder hands them all
    // out at once, so releasing only the primary would leak the rest.
    for (const img of images) {
      try {
        img.free();
      } catch {
        /* a handle that never allocated is not worth a thrown import */
      }
    }
  }
}
