// Test harness globals for the persistence tests.
//
// `fake-indexeddb/auto` installs an in-memory `indexedDB` + `IDBKeyRange` onto
// globalThis so both the raw-IndexedDB legacy store and Dexie run unchanged.
// Each test file gets a fresh in-memory DB via `IDBFactory` reset in beforeEach
// (see the specs). Node 25 already provides `crypto.subtle`, `Blob`, and
// `structuredClone`; we only polyfill `URL.createObjectURL`/`revokeObjectURL`,
// which Node does not expose as globals and which a couple of helpers touch.
import "fake-indexeddb/auto";

if (typeof URL.createObjectURL !== "function") {
  let n = 0;
  // Minimal stub: the adapter tests never dereference the URL, they only check
  // that a non-null string is produced from a stored blob.
  URL.createObjectURL = () => `blob:fake/${n++}`;
  URL.revokeObjectURL = () => {};
}
