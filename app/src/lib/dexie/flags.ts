// Persistence rollback flags — one flag, one file (the runtime kill switch).
//
// Flip `USE_DEXIE_ORIGINALS` to `false` and rebuild to route every originals
// read/write back to the legacy raw-IndexedDB store ONLY, bypassing Dexie
// entirely. This is a byte-identical revert to pre-migration behaviour — no
// data reshaping, no read-through copy — the emergency undo if the Dexie path
// misbehaves in production. See app/src/lib/dexie/originalsAdapter.ts.
export const USE_DEXIE_ORIGINALS = true;

// Op-log persistence (ADR-006: truth = original + op log). ON since
// 2026-07-17: the four-check A/B passed on a real gallery (flags-OFF baseline
// dims matched flags-ON, plain-stroke and AI round trips both came back
// "restored" with the Canvas intact — byte-level verification in the v7.36
// session). Kill switch: set localStorage ih_oplog_persist = "0" for a single
// profile, or flip this back — the module goes inert and the working-copy
// path (which never stopped writing) carries the resume.
export const USE_OPLOG_PERSISTENCE = true;
