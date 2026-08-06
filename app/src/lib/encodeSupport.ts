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

/** Resolves true only if `mime` round-trips as itself. Cached per type. */
export function canEncode(mime: string): Promise<boolean> {
  let p = cache.get(mime);
  if (!p) {
    p = probe(mime);
    cache.set(mime, p);
  }
  return p;
}

/** Test seam — the probe caches for the page's lifetime, which unit tests
 *  spanning multiple fake browsers would otherwise inherit from each other. */
export function __resetEncodeSupportCache(): void {
  cache.clear();
}
