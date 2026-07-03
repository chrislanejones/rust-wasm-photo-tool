// Persistence rollback flags — one flag, one file (the runtime kill switch).
//
// Flip `USE_DEXIE_ORIGINALS` to `false` and rebuild to route every originals
// read/write back to the legacy raw-IndexedDB store ONLY, bypassing Dexie
// entirely. This is a byte-identical revert to pre-migration behaviour — no
// data reshaping, no read-through copy — the emergency undo if the Dexie path
// misbehaves in production. See app/src/lib/dexie/originalsAdapter.ts.
export const USE_DEXIE_ORIGINALS = true;
