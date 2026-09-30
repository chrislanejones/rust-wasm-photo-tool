// Can THIS browser actually encode this image type from a canvas?
//
// The HTML spec says that when `toBlob`/`convertToBlob` is handed a type it
// cannot encode, the user agent must produce a PNG instead — silently. No
// throw, no warning, and `blob.type` quietly reads "image/png". Chrome decodes
// AVIF but cannot encode it, so "export as AVIF" has always written PNG bytes
// into a file named `.avif`: not merely larger than expected, but a file whose
// contents do not match its name.
//
// The only honest test is therefore empirical — encode one pixel and read back
// what actually arrived. Feature strings and UA sniffing cannot answer this.
//
// AVIF is the exception — see `hasShippedEncoder` below.
//
// Probes are cached per MIME because the answer cannot change within a page
// session, and the probe itself allocates a canvas.

const cache = new Map<string, Promise<boolean>>();

async function probe(mime: string): Promise<boolean> {
  try {
    if (typeof OffscreenCanvas === "undefined") return false;
    const oc = new OffscreenCanvas(1, 1);
    const ctx = oc.getContext("2d");
    if (!ctx) return false;
    ctx.fillRect(0, 0, 1, 1);
    const blob = await oc.convertToBlob({ type: mime });
    // Equality, not `includes` — a PNG fallback reports exactly "image/png".
    return blob.type === mime;
  } catch {
    return false;
  }
}

/** AVIF is the one type we do not leave to the canvas: Image Horse ships its
 *  own wasm encoder for it (lib/avifEncoder.ts), so the question is whether
 *  THIS browser can run WebAssembly, not whether its canvas can write AVIF.
 *  Probing by actually encoding would fetch ~3.5 MB of encoder just to open
 *  a dialog. If the encoder later fails anyway, the canvas fallback writes an
 *  honest image/png and callers name the file from `blob.type`. */
function hasShippedEncoder(mime: string): boolean {
  return mime === "image/avif" && typeof WebAssembly === "object";
}

/** Resolves true only if `mime` round-trips as itself. Cached per type. */
export function canEncode(mime: string): Promise<boolean> {
  let p = cache.get(mime);
  if (!p) {
    p = hasShippedEncoder(mime) ? Promise.resolve(true) : probe(mime);
    cache.set(mime, p);
  }
  return p;
}
