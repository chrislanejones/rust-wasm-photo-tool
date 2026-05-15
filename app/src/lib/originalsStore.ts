// Content-addressed storage for original photo bytes.
// Bytes live in IndexedDB keyed by SHA-256. App state only carries the key string.

const DB_NAME = "image-horse-originals";
const STORE = "originals";
const VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export interface StoredOriginal {
  bytes: ArrayBuffer;
  mimeType: string;
  name: string;
  width: number;
  height: number;
}

export async function putOriginal(
  file: File,
  width: number,
  height: number,
): Promise<string> {
  const bytes = await file.arrayBuffer();
  const key = await sha256Hex(bytes);
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const getReq = store.get(key);
    getReq.onsuccess = () => {
      if (getReq.result) {
        resolve();
        return;
      }
      const payload: StoredOriginal = {
        bytes,
        mimeType: file.type || "application/octet-stream",
        name: file.name,
        width,
        height,
      };
      const putReq = store.put(payload, key);
      putReq.onsuccess = () => resolve();
      putReq.onerror = () => reject(putReq.error);
    };
    getReq.onerror = () => reject(getReq.error);
  });
  return key;
}

export async function getOriginal(key: string): Promise<StoredOriginal | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(key);
    req.onsuccess = () => resolve((req.result as StoredOriginal) ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function getOriginalAsBlobUrl(key: string): Promise<string | null> {
  const r = await getOriginal(key);
  if (!r) return null;
  const blob = new Blob([r.bytes], { type: r.mimeType });
  return URL.createObjectURL(blob);
}

export async function deleteOriginal(key: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const req = tx.objectStore(STORE).delete(key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}
