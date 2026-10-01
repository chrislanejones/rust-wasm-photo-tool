// Where an added plugin lives on this device: IndexedDB, one record per
// plugin id, the manifest beside the module's source text. Its own database
// (`image-horse-plugins`), not a table in the content layer: a plugin is not
// a photo, and the photo stores' migrations should never have to know one
// exists. Raw IndexedDB in the shape of originalsStore.ts — small enough that
// Dexie would be more code than the store.
//
// localStorage was the other choice and is wrong for this: its quota is a few
// MB for the whole origin and the sync preferences already live there. A
// plugin can be hundreds of KB.
import type { InstalledPlugin } from "./types";

const DB_NAME = "image-horse-plugins";
const STORE = "plugins";
const VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  const p = new Promise<IDBDatabase>((resolve, reject) => {
    let req: IDBOpenDBRequest;
    try {
      req = indexedDB.open(DB_NAME, VERSION);
    } catch (err) {
      reject(err);
      return;
    }
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" });
    };
    req.onsuccess = () => {
      const db = req.result;
      // A browser closes idle connections on its own; a cached closed one
      // throws on every transaction. Drop the cache so the next call reopens.
      db.onclose = () => {
        if (dbPromise === p) dbPromise = null;
      };
      resolve(db);
    };
    req.onerror = () => reject(req.error);
  });
  p.catch(() => {
    if (dbPromise === p) dbPromise = null;
  });
  dbPromise = p;
  return p;
}

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Every plugin this device has added, oldest first. An unavailable
 *  IndexedDB (a sandboxed document) reads as none — off is the fallback. */
export async function listStoredPlugins(): Promise<InstalledPlugin[]> {
  try {
    const db = await openDb();
    const all = await request(db.transaction(STORE, "readonly").objectStore(STORE).getAll());
    return (all as InstalledPlugin[]).sort((a, b) => a.addedAt - b.addedAt);
  } catch {
    return [];
  }
}

export async function putStoredPlugin(plugin: InstalledPlugin): Promise<void> {
  const db = await openDb();
  await request(db.transaction(STORE, "readwrite").objectStore(STORE).put(plugin));
}

export async function deleteStoredPlugin(id: string): Promise<void> {
  const db = await openDb();
  await request(db.transaction(STORE, "readwrite").objectStore(STORE).delete(id));
}
