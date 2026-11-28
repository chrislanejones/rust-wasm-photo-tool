// Find duplicates (ticket 232): each photo's fingerprint, computed once from
// its stored thumbnail and kept IN MEMORY.
//
// The cache is keyed by photo id, and an entry counts only while the photo's
// `thumbBlob` is the very Blob it was computed from. Every path that changes
// a photo's pixels (an edit saved, a crop, a resize, Paste look) writes a NEW
// thumbnail Blob, so a stale hash can never be served for a changed photo.
//
// ADR-112: STORED on the photo's gallery row, as optional fields (no Dexie
// bump: the gallery manifest is a plain structured-clone store):
//   • `fingerprintCurrent` + `fingerprintThumb`: the fingerprint and the very
//     thumbnail Blob it was computed from. Trusted while `fingerprintThumb`
//     IS `thumbBlob` — structured clone keeps one Blob one object, so this
//     holds across a reload, and every path that writes a new thumbnail makes
//     it stale without having to know about it. A reload hashes nothing.
//   • `fingerprintOriginal`: written once, at import (`fingerprintAtImport`),
//     so an edited photo still matches an untouched copy. A photo imported
//     before ADR-112 gets its current fingerprint as its original the first
//     time it is hashed: that can't recover a pre-edit original, and the ADR
//     says so. Nothing is backfilled.
//
// Decoding the thumbnail is the browser's job (createImageBitmap, as every
// other reader of a stored image here does); the downscale, the hash and the
// average color are the engine's (src/dhash.rs). No pixel math in this file.
import type { PhotoEntry } from "./GalleryBar";
import type { Fingerprint } from "@/lib/duplicates";
import { importEngine } from "@/lib/engineGate";

/** The engine call: `[hashHigh, hashLow, 0xRRGGBB]` then the 7 other
 *  orientations' `hi, lo` pairs (17 numbers), empty on bad input. */
type FingerprintFn = (px: Uint8Array, w: number, h: number) => Uint32Array;
/** Thumbnail → RGBA. */
type DecodeFn = (blob: Blob) => Promise<{ rgba: Uint8Array; w: number; h: number }>;

interface Entry {
  thumb: Blob;
  fp: Fingerprint | null;
}

const cache = new Map<string, Entry>();

/** The engine's numbers as a `Fingerprint`, or null for an empty answer.
 *  17 numbers carry the 7 other orientations (11-23-2026); 3 are the straight
 *  hash only (the shape before that, kept so an older engine still works). */
export function toFingerprint(raw: Uint32Array | readonly number[]): Fingerprint | null {
  if (raw.length !== 3 && raw.length !== 17) return null;
  const fp: Fingerprint = { hi: raw[0]! >>> 0, lo: raw[1]! >>> 0, rgb: raw[2]! >>> 0 };
  if (raw.length === 17) {
    const turns = [];
    for (let i = 3; i < 17; i += 2) turns.push({ hi: raw[i]! >>> 0, lo: raw[i + 1]! >>> 0 });
    fp.turns = turns;
  }
  return fp;
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

/** What `fingerprintPhotos` hands back to be stored on a photo (ADR-112). */
export type StoredPrints = Pick<PhotoEntry, "fingerprintCurrent" | "fingerprintThumb" | "fingerprintOriginal">;

type FingerprintedPhoto = Pick<PhotoEntry, "id" | "thumbBlob"> & Partial<StoredPrints>;

/**
 * Fingerprints for `photos`: the one stored on the photo when it was computed
 * from the current thumbnail, then the in-memory cache, computed (and cached)
 * otherwise. A computed one is handed to `remember` to be stored on the photo,
 * with `fingerprintOriginal` too when the photo has none (ADR-112 §6). A
 * thumbnail that will not decode gets no fingerprint and is left out of the
 * result. Entries for photos no longer in the list are dropped, so the cache
 * never outgrows the gallery.
 */
export async function fingerprintPhotos(
  photos: readonly FingerprintedPhoto[],
  deps: { fingerprint?: FingerprintFn; decode?: DecodeFn; remember?: (id: string, patch: StoredPrints) => void } = {},
): Promise<Map<string, Fingerprint>> {
  const live = new Set(photos.map((p) => p.id));
  for (const id of cache.keys()) if (!live.has(id)) cache.delete(id);

  // Stored and still for this thumbnail: no decode, no engine call.
  for (const p of photos) {
    if (p.fingerprintCurrent && p.fingerprintThumb === p.thumbBlob) {
      cache.set(p.id, { thumb: p.thumbBlob, fp: p.fingerprintCurrent });
    }
  }

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
        if (fp && deps.remember) {
          deps.remember(p.id, {
            fingerprintCurrent: fp,
            fingerprintThumb: p.thumbBlob,
            ...(p.fingerprintOriginal ? {} : { fingerprintOriginal: fp }),
          });
        }
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

/**
 * The fingerprint of a photo's FIRST thumbnail, for `fingerprintOriginal`
 * (ADR-112). Called at import. Waits for the engine the way every lazy reader
 * does (`importEngine`), so on a phone it makes no engine request until the
 * window is wide enough to edit, and nothing can be edited before that. Null
 * when the thumbnail won't decode or fingerprint.
 */
export async function fingerprintAtImport(
  thumb: Blob,
  deps: { fingerprint?: FingerprintFn; decode?: DecodeFn } = {},
): Promise<Fingerprint | null> {
  try {
    const fingerprint = deps.fingerprint ?? (await engineFingerprint());
    const { rgba, w, h } = await (deps.decode ?? decodeThumb)(thumb);
    return toFingerprint(fingerprint(rgba, w, h));
  } catch {
    return null;
  }
}
