// Dump and restore a page's IndexedDB as JSON (pre-v974 fixture, QC 11-26's
// "Not covered" line). Bytes become base64; Blobs keep their type. The spec
// uses `restoreIdb`; the dump itself lives in make-fixtures.mjs, in plain JS
// (it runs in Node with no TypeScript step).
//
// `restoreIdb` runs IN THE PAGE (page.evaluate), so it is self-contained.

export interface DumpedStore {
  name: string;
  keyPath: string | string[] | null;
  autoIncrement: boolean;
  indexes: { name: string; keyPath: string | string[]; unique: boolean; multiEntry: boolean }[];
  rows: { key: unknown; value: unknown }[];
}
export interface DumpedDb {
  name: string;
  version: number;
  stores: DumpedStore[];
}

/**
 * The photo's key is the SHA-256 of `e2e/fixtures/paper-1200x900.png`. The
 * fixture stores it as this placeholder instead: 64 hex characters next to a
 * field named "...Key" read as an API key to the secret scan. Swap it back
 * (in Node, before `restoreIdb`) with `fillPaperHash`.
 */
const PAPER_HASH_PLACEHOLDER = "{{PAPER_SHA256}}";

/** In Node: the fixture's JSON with the placeholder swapped for the real hash. */
export function fillPaperHash(json: string, paperSha256: string): string {
  return json.split(PAPER_HASH_PLACEHOLDER).join(paperSha256);
}

/** In the page: write the dump back, creating any database or store that
 *  isn't there (a fresh browser), into stores that are kept otherwise. */
export async function restoreIdb(dbs: DumpedDb[]): Promise<void> {
  const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  const dec = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(dec);
    if (v && typeof v === "object") {
      const o = v as Record<string, unknown>;
      if (typeof o.$u8 === "string") return unb64(o.$u8);
      if (typeof o.$u8c === "string") return new Uint8ClampedArray(unb64(o.$u8c).buffer);
      if (typeof o.$ab === "string") return unb64(o.$ab).buffer;
      if (typeof o.$blob === "string") return new Blob([unb64(o.$blob)], { type: String(o.type ?? "") });
      const out: Record<string, unknown> = {};
      for (const [k, x] of Object.entries(o)) out[k] = dec(x);
      return out;
    }
    return v;
  };
  for (const d of dbs) {
    const db = await new Promise<IDBDatabase>((res, rej) => {
      const r = indexedDB.open(d.name, d.version);
      r.onupgradeneeded = () => {
        for (const s of d.stores) {
          if (r.result.objectStoreNames.contains(s.name)) continue;
          const st = r.result.createObjectStore(s.name, { keyPath: s.keyPath ?? undefined, autoIncrement: s.autoIncrement });
          for (const ix of s.indexes) st.createIndex(ix.name, ix.keyPath, { unique: ix.unique, multiEntry: ix.multiEntry });
        }
      };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    await new Promise<void>((res, rej) => {
      const tx = db.transaction(d.stores.map((s) => s.name), "readwrite");
      for (const s of d.stores) {
        const st = tx.objectStore(s.name);
        st.clear();
        for (const row of s.rows) {
          if (s.keyPath === null) st.put(dec(row.value), dec(row.key) as IDBValidKey);
          else st.put(dec(row.value));
        }
      }
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
    db.close();
  }
}
