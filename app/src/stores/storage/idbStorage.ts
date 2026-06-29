// IndexedDB-backed `StateStorage` for Zustand's `persist` middleware.
//
// Why hand-rolled (no `idb-keyval` / Dexie): `persist` only needs a string
// key/value store, this is ~40 LOC, it matches the three content stores we
// already maintain (originalsStore / editPersistence / galleryManifest), and it
// avoids touching the lockfile (the pnpm store-v11 install gotcha — see
// docs/IndexedDB-Investigation.md §4).
//
// Lives in its OWN database, separate from the content DBs, so a corrupt or
// cleared preferences cache can never take down originals or edit history.
import type { StateStorage } from "zustand/middleware";

const DB_NAME = "image-horse-zustand";
const STORE = "kv";
const VERSION = 1;

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

async function idbGet(key: string): Promise<string | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, "readonly").objectStore(STORE).get(key);
    req.onsuccess = () => resolve((req.result as string | undefined) ?? null);
    req.onerror = () => reject(req.error);
  });
}

async function idbSet(key: string, value: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db
      .transaction(STORE, "readwrite")
      .objectStore(STORE)
      .put(value, key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function idbDel(key: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db
      .transaction(STORE, "readwrite")
      .objectStore(STORE)
      .delete(key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/**
 * Zustand persist storage backed by IndexedDB. Wrap with `createJSONStorage`:
 *
 *   storage: createJSONStorage(() => idbStorage)
 *
 * All three methods are async — `persist` hydrates the store after first paint,
 * so only persist small, cosmetic "remember my choice" prefs (never transient
 * dialog flags or heavy data). See docs/State-Management.md §6.
 */
export const idbStorage: StateStorage = {
  getItem: (name) => idbGet(name),
  setItem: (name, value) => idbSet(name, value),
  removeItem: (name) => idbDel(name),
};
