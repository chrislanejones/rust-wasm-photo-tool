// Persistence rollback flags — one flag, one file (the runtime kill switch).
//
// Flip `USE_DEXIE_ORIGINALS` to `false` and rebuild to route every originals
// read/write back to the legacy raw-IndexedDB store ONLY, bypassing Dexie
// entirely. This is a byte-identical revert to pre-migration behaviour — no
// data reshaping, no read-through copy — the emergency undo if the Dexie path
// misbehaves in production. See app/src/lib/dexie/originalsAdapter.ts.
export const USE_DEXIE_ORIGINALS = true;

// Op-log persistence (ADR-006: truth = original + op log). OFF for
// dogfooding: the existing working-copy persistence carries everything, and
// the op-log write/restore path (app/src/lib/oplogPersistence.ts) is inert.
// Flip to true (or set localStorage ih_oplog_persist = "1" for a single
// profile) once the morning real-gallery check has passed. Rollback story:
// flip back — the module goes inert, the old path never stopped working,
// and the new tables just sit there (additive schema).
export const USE_OPLOG_PERSISTENCE = false;
