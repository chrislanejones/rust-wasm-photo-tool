// Find duplicates (ticket 232): each photo's fingerprint, computed once from
// its stored thumbnail and kept IN MEMORY.
//
// The cache is keyed by photo id, and an entry counts only while the photo's
// `thumbBlob` is the very Blob it was computed from. Every path that changes
// a photo's pixels (an edit saved, a crop, a resize, Paste look) writes a NEW
// thumbnail Blob, so a stale hash can never be served for a changed photo.
//
// ⚠️ Deliberately NOT persisted. Storing the hash on the photo record would
// be a new IndexedDB field, and that is a Dexie migration (the
// dexie-migration skill), which is Chris's call. A reload therefore hashes
// every thumbnail once more — about a millisecond each.
//
// Decoding the thumbnail is the browser's job (createImageBitmap, as every
// other reader of a stored image here does); the downscale, the hash and the
// average color are the engine's (src/dhash.rs). No pixel math in this file.
import type { PhotoEntry } from "./GalleryBar";
import type { Fingerprint } from "@/lib/duplicates";
import { importEngine } from "@/lib/engineGate";

/** The engine call: `[hashHigh, hashLow, 0xRRGGBB]`, empty on bad input. */
type FingerprintFn = (px: Uint8Array, w: number, h: number) => Uint32Array;
/** Thumbnail → RGBA. */
type DecodeFn = (blob: Blob) => Promise<{ rgba: Uint8Array; w: number; h: number }>;

interface Entry {
  thumb: Blob;
  fp: Fingerprint | null;
}

const cache = new Map<string, Entry>();

/** The engine's three numbers as a `Fingerprint`, or null for an empty one. */
export function toFingerprint(raw: Uint32Array | readonly number[]): Fingerprint | null {
  return raw.length === 3 ? { hi: raw[0]! >>> 0, lo: raw[1]! >>> 0, rgb: raw[2]! >>> 0 } : null;
}

async function decodeThumb(blob: Blob): Promise<{ rgba: Uint8Array; w: number; h: number }> {
  const bmp = await createImageBitmap(blob);
  try {
    const canvas = new OffscreenCanvas(bmp.width, bmp.height);
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("No 2D context");
    ctx.drawImage(bmp, 0, 0);
    const data = ctx.getImageData(0, 0, bmp.width, bmp.height).data;
    return { rgba: new Uint8Array(data.buffer, data.byteOffset, data.byteLength), w: bmp.width, h: bmp.height };
  } finally {
    bmp.close();
  }
}

async function engineFingerprint(): Promise<FingerprintFn> {
  return (await importEngine()).photo_fingerprint;
}

/** How many thumbnails decode at once. createImageBitmap decodes off the main
 *  thread, so a few in flight overlap; all 100 at once only queues them. */
const PARALLEL = 6;

/**
 * Fingerprints for `photos`, from the cache where the thumbnail is unchanged,
 * computed (and cached) otherwise. A thumbnail that will not decode gets no
 * fingerprint and is left out of the result. Entries for photos no longer in
 * the list are dropped, so the cache never outgrows the gallery.
 */
export async function fingerprintPhotos(
  photos: readonly Pick<PhotoEntry, "id" | "thumbBlob">[],
  deps: { fingerprint?: FingerprintFn; decode?: DecodeFn } = {},
): Promise<Map<string, Fingerprint>> {
  const live = new Set(photos.map((p) => p.id));
  for (const id of cache.keys()) if (!live.has(id)) cache.delete(id);

  const todo = photos.filter((p) => cache.get(p.id)?.thumb !== p.thumbBlob);
  if (todo.length > 0) {
    const fingerprint = deps.fingerprint ?? (await engineFingerprint());
    const decode = deps.decode ?? decodeThumb;
    let next = 0;
    const worker = async () => {
      while (next < todo.length) {
        const p = todo[next++]!;
        let fp: Fingerprint | null;
        try {
          const { rgba, w, h } = await decode(p.thumbBlob);
          fp = toFingerprint(fingerprint(rgba, w, h));
        } catch {
          fp = null;
        }
        cache.set(p.id, { thumb: p.thumbBlob, fp });
      }
    };
    await Promise.all(Array.from({ length: Math.min(PARALLEL, todo.length) }, worker));
  }

  const out = new Map<string, Fingerprint>();
  for (const p of photos) {
    const fp = cache.get(p.id)?.fp;
    if (fp) out.set(p.id, fp);
  }
  return out;
}
