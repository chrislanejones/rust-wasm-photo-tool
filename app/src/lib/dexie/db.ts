// Dexie.js content layer for Image Horse — a typed, declarative IndexedDB
// schema for the heavy data (originals, edited working copies, gallery
// metadata). See app/src/lib/dexie/USAGE.md and docs/IndexedDB-Investigation.md.
//
// This is a NEW, parallel database ("image-horse-dexie") — it does NOT touch the
// three live hand-rolled stores (image-horse-originals / -edits / -gallery). It
// exists so the app can migrate to Dexie incrementally and reversibly: the
// public function names mirror the current `originalsStore` API
// (putOriginal / getOriginal / getOriginalAsBlobUrl / deleteOriginal) so call
// sites can switch import paths with no other change.
import Dexie, { type Table } from "dexie";

// ── Records ────────────────────────────────────────────────────────────────

/** Raw uploaded image, content-addressed (id = SHA-256 of the bytes) so
 *  identical uploads dedupe. Stored as a Blob — IndexedDB clones it natively. */
export interface OriginalRecord {
  id: string;
  blob: Blob;
  mimeType: string;
  name: string;
  width: number;
  height: number;
  createdAt: number;
}

/** An edited render of a photo, kept separate from its original so the original
 *  is never overwritten. One working copy per photo (id = photoId). */
export interface WorkingCopyRecord {
  id: string;
  photoId: string;
  blob: Blob;
  width: number;
  height: number;
  updatedAt: number;
}

/** Lightweight gallery row — what the gallery list renders from, plus pointers
 *  into `originals` / `workingCopies`. Keeps the gallery fast: load this table,
 *  not the megabytes of pixels. */
export interface PhotoMeta {
  id: string;
  name: string;
  width: number;
  height: number;
  originalId: string;
  workingCopyId?: string;
  /** Small preview Blob for the gallery thumbnail. */
  thumbBlob?: Blob;
  createdAt: number;
  updatedAt: number;
}

// ── Database ─────────────────────────────────────────────────────────────────

class ImageHorseDB extends Dexie {
  // `!` — Dexie's documented late-init pattern; the tables are wired by
  // `this.version().stores()` in the constructor.
  originals!: Table<OriginalRecord, string>;
  workingCopies!: Table<WorkingCopyRecord, string>;
  photos!: Table<PhotoMeta, string>;

  constructor() {
    super("image-horse-dexie");
    // Schema strings: first field is the primary key, the rest are indexes.
    // Bump the version + add a new `.version(n).stores({...}).upgrade(...)`
    // block to evolve the schema (see docs/IndexedDB-Investigation.md §6).
    this.version(1).stores({
      originals: "id",
      workingCopies: "id, photoId",
      photos: "id, updatedAt, originalId",
    });
  }
}

/** The singleton database. Import for `useLiveQuery(() => db.photos.toArray())`
 *  and ad-hoc queries; prefer the helpers below for the common operations. */
export const db = new ImageHorseDB();

// ── Hashing (content address) ────────────────────────────────────────────────

/** SHA-256 of a byte source as lowercase hex — the content-address key for
 *  originals. Inlined so this module stands alone from the legacy store. */
async function sha256Hex(bytes: BufferSource): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ── Originals ────────────────────────────────────────────────────────────────

/** Store an original image; returns its content-address id. No-ops (returns the
 *  existing id) if identical bytes are already stored. Drop-in for the legacy
 *  `originalsStore.putOriginal`. */
export async function putOriginal(
  file: File,
  width: number,
  height: number,
): Promise<string> {
  const buf = await file.arrayBuffer();
  const id = await sha256Hex(buf);
  const exists = await db.originals.get(id);
  if (!exists) {
    const mimeType = file.type || "application/octet-stream";
    await db.originals.put({
      id,
      blob: new Blob([buf], { type: mimeType }),
      mimeType,
      name: file.name,
      width,
      height,
      createdAt: Date.now(),
    });
  }
  return id;
}

export async function getOriginal(id: string): Promise<OriginalRecord | undefined> {
  return db.originals.get(id);
}

/** Object URL for an original's bytes (caller must `URL.revokeObjectURL`). */
export async function getOriginalAsBlobUrl(id: string): Promise<string | null> {
  const r = await db.originals.get(id);
  return r ? URL.createObjectURL(r.blob) : null;
}

export async function deleteOriginal(id: string): Promise<void> {
  await db.originals.delete(id);
}

// ── Working copies ───────────────────────────────────────────────────────────

/** Save (or replace) the edited render for a photo, and refresh the photo
 *  row's pointer + `updatedAt`. */
export async function saveWorkingCopy(
  photoId: string,
  blob: Blob,
  width: number,
  height: number,
): Promise<string> {
  const now = Date.now();
  await db.transaction("rw", db.workingCopies, db.photos, async () => {
    await db.workingCopies.put({ id: photoId, photoId, blob, width, height, updatedAt: now });
    await db.photos.update(photoId, { workingCopyId: photoId, updatedAt: now });
  });
  return photoId;
}

export async function getWorkingCopy(
  photoId: string,
): Promise<WorkingCopyRecord | undefined> {
  return db.workingCopies.get(photoId);
}

/** Object URL for a photo's edited render, else its original (caller revokes). */
export async function getDisplayBlobUrl(photoId: string): Promise<string | null> {
  const wc = await db.workingCopies.get(photoId);
  if (wc) return URL.createObjectURL(wc.blob);
  const photo = await db.photos.get(photoId);
  return photo ? getOriginalAsBlobUrl(photo.originalId) : null;
}

// ── Photo metadata (the gallery) ─────────────────────────────────────────────

/** Insert or update a gallery row (refreshes `updatedAt`). */
export async function upsertPhotoMetadata(meta: PhotoMeta): Promise<string> {
  await db.photos.put({ ...meta, updatedAt: Date.now() });
  return meta.id;
}

export async function getPhoto(id: string): Promise<PhotoMeta | undefined> {
  return db.photos.get(id);
}

/** The whole gallery, newest-edited first. Pair with Dexie `liveQuery` /
 *  `useLiveQuery` for components that should re-render on DB changes. */
export async function getAllPhotos(): Promise<PhotoMeta[]> {
  return db.photos.orderBy("updatedAt").reverse().toArray();
}

/** Cascade-delete a photo: its row, its working copy, and the original IFF no
 *  other photo still references that (content-addressed, shared) original. */
export async function deletePhoto(id: string): Promise<void> {
  await db.transaction("rw", db.photos, db.workingCopies, db.originals, async () => {
    const photo = await db.photos.get(id);
    await db.photos.delete(id);
    await db.workingCopies.where("photoId").equals(id).delete();
    if (photo) {
      const refs = await db.photos.where("originalId").equals(photo.originalId).count();
      if (refs === 0) await db.originals.delete(photo.originalId);
    }
  });
}

/** Wipe every table (e.g. "Delete all"). Originals included. */
export async function clearAll(): Promise<void> {
  await db.transaction("rw", db.photos, db.workingCopies, db.originals, async () => {
    await Promise.all([db.photos.clear(), db.workingCopies.clear(), db.originals.clear()]);
  });
}
