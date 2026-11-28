// The facts a name pattern needs from a photo's STORED file: the EXIF date for
// `{date}`, the uploaded file name for `{original}`, and the file's own date as
// `{date}`'s fallback. lib/nameTokens.ts does the formatting; this only reads.
//
// The upload name is the `name` the originals store already keeps beside the
// bytes (putOriginal records `file.name`), read from `uploadKey`, the immutable
// upload original. The file date (`File.lastModified`) is stored on the photo's
// gallery row at import (`PhotoEntry.fileDate`, ADR-112), so `{date}` keeps it
// after a reload. It is also remembered in memory at upload, which is what a
// photo imported before ADR-112 has for this session only; after a reload such
// a photo's `{date}` without EXIF falls through to today, as it always did.
//
// Cached in memory by key. Keys are SHA-256 content hashes, so what a key's
// bytes say can never change and the cache never needs invalidating.
import { getOriginal } from "@/lib/dexie/originalsAdapter";
import { parseExifFromImage } from "@/lib/exif";

export interface NameFacts {
  /** The uploaded file's name, extension removed. Unset when unknown. */
  original?: string;
  /** EXIF capture time, "YYYY-MM-DD HH:MM". */
  dateTaken?: string;
  /** `File.lastModified` from the upload: stored on the photo (ADR-112), or
   *  remembered this session for a photo imported before that. */
  fileDate?: number;
}

/** The two keys a gallery photo carries; `PhotoEntry` satisfies it. */
export interface NameFactsKeys {
  uploadKey?: string;
  originalKey: string;
  /** The stored file date (`PhotoEntry.fileDate`, ADR-112). */
  fileDate?: number;
}

const fileDates = new Map<string, number>();
const read = new Map<string, Promise<Omit<NameFacts, "fileDate">>>();

/** Note a file's own date when it is uploaded, keyed by its content hash. */
export function rememberFileDate(key: string, lastModified: number): void {
  if (Number.isFinite(lastModified) && lastModified > 0) fileDates.set(key, lastModified);
}

async function readStored(key: string, isUpload: boolean): Promise<Omit<NameFacts, "fileDate">> {
  const rec = await getOriginal(key);
  if (!rec) return {};
  const out: Omit<NameFacts, "fileDate"> = {};
  if (isUpload && rec.name) {
    const dot = rec.name.lastIndexOf(".");
    out.original = dot > 0 ? rec.name.slice(0, dot) : rec.name;
  }
  const exif = parseExifFromImage(new Uint8Array(rec.bytes), rec.mimeType);
  if (exif?.dateTaken) out.dateTaken = exif.dateTaken;
  return out;
}

/**
 * The name facts for one photo. Never throws: a photo whose file cannot be
 * read gets no facts, and its tokens fall back (`{original}` → `{name}`,
 * `{date}` → the file's date → today).
 *
 * `{original}` is only read from `uploadKey`. A photo old enough to have no
 * `uploadKey` may have an `originalKey` that is already a re-encode, stored
 * under the photo's renamed name, so that name is not "the name before any
 * rename" and is not offered as one.
 */
export async function loadNameFacts(photo: NameFactsKeys): Promise<NameFacts> {
  const key = photo.uploadKey ?? photo.originalKey;
  const isUpload = photo.uploadKey !== undefined;
  const cacheKey = `${isUpload ? "u" : "o"}:${key}`;
  let pending = read.get(cacheKey);
  if (!pending) {
    pending = readStored(key, isUpload);
    read.set(cacheKey, pending);
    // A failed read is retried next time rather than remembered as "nothing".
    pending.catch(() => read.delete(cacheKey));
  }
  let stored: Omit<NameFacts, "fileDate">;
  try {
    stored = await pending;
  } catch {
    stored = {};
  }
  const fileDate = photo.fileDate ?? fileDates.get(key);
  return fileDate === undefined ? { ...stored } : { ...stored, fileDate };
}

/** Tests only: drop every cached read and remembered date. */
export function forgetNameFactsForTests(): void {
  fileDates.clear();
  read.clear();
}
