// Persisted gallery manifest so an anonymous session survives a tab close
// (Ctrl+W) or reload. The original bytes and per-photo edits already live in
// IndexedDB (originalsStore / editPersistence); without this, though, the
// gallery LIST is React-only, so on return those bytes are orphaned and the app
// starts empty. This stores the lightweight list — the PhotoEntry array
// (thumbnails + content keys + metadata) plus the active id — so we can rebuild
// the gallery and offer a Resume prompt. PhotoEntry.thumbBlob is a Blob, which
// IndexedDB structured-clones natively.
import type { PhotoEntry } from "@/features/gallery/GalleryBar";

const DB_NAME = "image-horse-gallery";
const STORE = "manifest";
const KEY = "current";
const VERSION = 1;

export interface GalleryManifest {
  photos: PhotoEntry[];
  activeId: string | null;
  savedAt: number;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

export async function saveGalleryManifest(
  photos: PhotoEntry[],
  activeId: string | null,
): Promise<void> {
  const db = await openDb();
  const manifest: GalleryManifest = { photos, activeId, savedAt: Date.now() };
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const req = tx.objectStore(STORE).put(manifest, KEY);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function loadGalleryManifest(): Promise<GalleryManifest | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(KEY);
    req.onsuccess = () => resolve((req.result as GalleryManifest) ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function clearGalleryManifest(): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const req = tx.objectStore(STORE).delete(KEY);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}
