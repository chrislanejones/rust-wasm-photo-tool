// Dump and restore a page's IndexedDB as JSON (pre-v974 fixture, QC 11-26's
// "Not covered" line). Bytes become base64; Blobs keep their type. The spec
// uses `restoreIdb`; make-fixtures.mjs has a plain-JS copy of `dumpIdb`
// (it runs in Node with no TypeScript step).
//
// Both functions run IN THE PAGE (page.evaluate), so they are self-contained.

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

/** In the page: every row of every store of each named database. */
export async function dumpIdb(names: string[]): Promise<DumpedDb[]> {
  const b64 = (u8: Uint8Array) => {
    let s = "";
    for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000));
    return btoa(s);
  };
  const enc = async (v: unknown): Promise<unknown> => {
    if (v instanceof Uint8Array) return { $u8: b64(v) };
    if (v instanceof Uint8ClampedArray) return { $u8c: b64(new Uint8Array(v.buffer, v.byteOffset, v.byteLength)) };
    if (v instanceof ArrayBuffer) return { $ab: b64(new Uint8Array(v)) };
    if (v instanceof Blob) return { $blob: b64(new Uint8Array(await v.arrayBuffer())), type: v.type };
    if (Array.isArray(v)) return Promise.all(v.map(enc));
    if (v && typeof v === "object") {
      const out: Record<string, unknown> = {};
      for (const [k, x] of Object.entries(v)) out[k] = await enc(x);
      return out;
    }
    return v;
  };
  const req = <T>(r: IDBRequest<T>) => new Promise<T>((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const out: DumpedDb[] = [];
  for (const name of names) {
    const db = await req(indexedDB.open(name));
    const stores: DumpedStore[] = [];
    for (const sName of Array.from(db.objectStoreNames)) {
      const store = db.transaction(sName, "readonly").objectStore(sName);
      const keys = await req(store.getAllKeys());
      const values = await req(store.getAll());
      const indexes = Array.from(store.indexNames).map((i) => {
        const ix = store.index(i);
        return { name: i, keyPath: ix.keyPath, unique: ix.unique, multiEntry: ix.multiEntry };
      });
      const rows = [];
      for (let i = 0; i < keys.length; i++) rows.push({ key: await enc(keys[i]), value: await enc(values[i]) });
      stores.push({ name: sName, keyPath: store.keyPath, autoIncrement: store.autoIncrement, indexes, rows });
    }
    out.push({ name, version: db.version, stores });
    db.close();
  }
  return out;
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
