// Dexie.js content layer for Image Horse — a typed, declarative IndexedDB
// schema for the heavy data (originals, edited working copies, gallery
// metadata). See app/src/lib/dexie/USAGE.md and docs/IndexedDB-Investigation.md.
//
// This is a NEW, parallel database ("image-horse-dexie") — it does NOT touch the
// three live hand-rolled stores (image-horse-originals / -edits / -gallery). It
// exists so the app can migrate to Dexie incrementally and reversibly:
// `putOriginal` mirrors the legacy `originalsStore.putOriginal` signature so
// `originalsAdapter` can dual-write with no call-site changes. (The rest of the
// never-wired convenience mirror was removed in the 2026-07-17 fallow cleanup;
// the op-log tables + helpers below are the live surface.)
import Dexie, { type Table } from "dexie";
import { logDiagnostic } from "@/lib/diagnosticsLog";

// ── Records ────────────────────────────────────────────────────────────────

/** Raw uploaded image, content-addressed (id = SHA-256 of the bytes) so
 *  identical uploads dedupe. Stored as a Blob — IndexedDB clones it natively. */
interface OriginalRecord {
  id: string;
  blob: Blob;
  mimeType: string;
  name: string;
  width: number;
  height: number;
  createdAt: number;
}

/** An edited render of a photo, kept separate from its original so the original
 *  is never overwritten. One working copy per photo (id = photoId). */
interface WorkingCopyRecord {
  id: string;
  photoId: string;
  blob: Blob;
  width: number;
  height: number;
  updatedAt: number;
}

/** Lightweight gallery row — what the gallery list renders from, plus pointers
 *  into `originals` / `workingCopies`. Keeps the gallery fast: load this table,
 *  not the megabytes of pixels.
 *
 *  Kept exported: it is `upsertPhotoMetadata`'s parameter type — callers
 *  need it to build the row. */
export interface PhotoMeta {
  id: string;
  name: string;
  width: number;
  height: number;
  originalId: string;
  workingCopyId?: string;
  /** Small preview Blob for the gallery thumbnail. */
  thumbBlob?: Blob;
  createdAt: number;
  updatedAt: number;
}

/** Head-state for a photo's persisted op log — the small record the save
 *  transaction updates LAST, which is what makes a torn multi-table write
 *  harmless: chunks/keyframes beyond the manifest's counts are ignored by
 *  the restore path and overwritten by the next save.
 *
 *  Lives in its OWN table (keyed by the gallery photo id) rather than on
 *  the Dexie `photos` rows: the live gallery still runs on the legacy
 *  hand-rolled manifest (Dexie `photos` is the parallel, not-yet-adopted
 *  layer), so photo rows don't exist for real photos yet. */
export interface PhotoOplogManifest {
  photoId: string;
  branch: string;
  /** Total ops persisted across all chunks (the replay target). */
  opCount: number;
  /** Chunks making up those ops (chunkSeq 0..chunkCount-1). */
  chunkCount: number;
  /** Engine op-encoding version (OP_FORMAT_VERSION at write time). */
  formatVersion: number;
  /** Engine `oplog_generation()` at write time: unchanged ⇒ persisted
   *  chunks are a valid prefix (append the delta); changed ⇒ history
   *  branched and the log gets rewritten. */
  generation: number;
  /** Applied-op position the user last saw — resume seeks here, keeping
   *  the persisted redo tail redoable. */
  cursor: number;
  /** Set when the engine's log stopped describing this photo's document —
   *  an unrecorded edit desynced it (`oplog_is_broken`) or the document
   *  went multi-layer (out of op-log scope). The log is then a faithful
   *  description of a document the user no longer has, so `restoreOplog`
   *  treats it as "nothing persisted" and the working-copy/archive path
   *  (which IS current) carries the resume. Cleared by the next save from
   *  a healthy log, which rewrites the log wholesale.
   *
   *  NOT INDEXED — an optional field on an existing record needs no
   *  `.version()` bump and no upgrade function (Dexie only versions key
   *  paths and indexes). Manifests written by the shipped v2 code have no
   *  `stale` field: `undefined` ⇒ falsy ⇒ they restore exactly as before. */
  stale?: boolean;
  updatedAt: number;
}

/** One appended chunk of a photo's operation log (ADR-006: truth = original
 *  + op log; the render cache stays disposable). `bytes` holds one or more
 *  op frames, each framed `[u32 LE frame-length][frame bytes]`, where the
 *  frame bytes are the engine's own encoding
 *  (`[format-version u8][postcard(op)]`). Chunks are append-only and
 *  immutable once the manifest covers them. */
export interface OpLogChunkRecord {
  photoId: string;
  /** History branch — always "main" until the DAG lands (the key column
   *  exists now so branching is a schema no-op later, per ADR-003). */
  branch: string;
  /** 0-based append order within (photoId, branch). */
  chunkSeq: number;
  bytes: Uint8Array;
  /** Ops contained in this chunk. */
  opCount: number;
  formatVersion: number;
  createdAt: number;
}

/** A keyframe snapshot of the document composite at `atOp` applied ops
 *  (atOp 0 = the base image the log replays over). Restore = nearest
 *  keyframe ≤ target + replay of the remaining ops. The blob must be
 *  LOSSLESS (PNG) — restore hash-parity is asserted against it. */
export interface KeyframeRecord {
  photoId: string;
  branch: string;
  atOp: number;
  /** Encoded PIXEL plane (annotations are NOT baked in — they live in
   *  `annotations` so they stay re-editable after a restore). */
  blob: Blob;
  /** Postcard-encoded live annotation lists at this keyframe (the engine's
   *  `encode_annotations` output). Empty/absent = no annotations. */
  annotations?: Uint8Array;
  width: number;
  height: number;
  createdAt: number;
}

// ── Database ─────────────────────────────────────────────────────────────────

class ImageHorseDB extends Dexie {
  // `!` — Dexie's documented late-init pattern; the tables are wired by
  // `this.version().stores()` in the constructor.
  originals!: Table<OriginalRecord, string>;
  workingCopies!: Table<WorkingCopyRecord, string>;
  photos!: Table<PhotoMeta, string>;
  opLogs!: Table<OpLogChunkRecord, [string, string, number]>;
  keyframes!: Table<KeyframeRecord, [string, string, number]>;
  oplogManifests!: Table<PhotoOplogManifest, string>;

  constructor() {
    super("image-horse-dexie");
    // Schema strings: first field is the primary key, the rest are indexes.
    // Bump the version + add a new `.version(n).stores({...}).upgrade(...)`
    // block to evolve the schema (see docs/IndexedDB-Investigation.md §6).
    // SHIPPED versions below are frozen — never edit or remove them
    // (dexie-migration skill hard rule).
    this.version(1).stores({
      originals: "id",
      workingCopies: "id, photoId",
      photos: "id, updatedAt, originalId",
    });
    // v2 (op-log persistence, ADR-006): ADDITIVE ONLY. Two new tables with
    // compound primary keys ordered for range scans per (photoId, branch);
    // the plain photoId index serves cascade deletes. No existing table or
    // index changes, no data reshaping — so there is no .upgrade() to be
    // interrupted, and re-running the (empty) upgrade is trivially
    // idempotent. Old code opening a v2 database ignores the new tables
    // and keeps working (rollback story: additive).
    this.version(2).stores({
      originals: "id",
      workingCopies: "id, photoId",
      photos: "id, updatedAt, originalId",
      opLogs: "[photoId+branch+chunkSeq], photoId",
      keyframes: "[photoId+branch+atOp], photoId",
      oplogManifests: "photoId",
    });
  }
}

/** The singleton database. Import for `useLiveQuery(() => db.photos.toArray())`
 *  and ad-hoc queries; prefer the helpers below for the common operations. */
export const db = new ImageHorseDB();

// ── Upgrade deadlock guard ──────────────────────────────────────────────────
//
// NOT a schema or storage change — no table, field, index, version or stored
// byte is touched here, so this is outside the `dexie-migration` procedure.
// It is connection lifecycle, and without it the NEXT migration can hang.
//
// The failure it prevents: a user has an old tab open when a release bumps the
// schema. The new tab calls `db.open()`, IndexedDB refuses to upgrade while the
// old connection is live, Dexie fires `blocked`, and with nobody listening the
// open promise never settles. Every Dexie call then waits forever — including
// the local save in `savePhotoEdit`, which deliberately has NO timeout because
// it writes the only copy of the user's work. The whole app wedges, exactly the
// way the gallery did when a Convex mutation hung (v7.57).
//
// `versionchange` is the half that actually fixes it. It fires in the OLD tab
// when another tab wants to upgrade; closing the connection there lets the
// upgrade proceed instead of deadlocking. The old tab's Dexie calls will then
// fail rather than hang — the right trade, and it is already parked behind
// MultiTabScreen, which claims a single editing tab.
db.on("versionchange", () => {
  logDiagnostic(
    "INDEXEDDB",
    "Another tab is upgrading the database; closing this connection so the upgrade is not blocked. Reload this tab to keep using it.",
  );
  db.close();
});

// `blocked` fires in the NEW tab when something still holds the old version
// open — a tab that ignored `versionchange`, or another browser window. Nothing
// can be done from here except make it visible instead of silent.
//
// DECIDED 2026-07-29 — a Diagnostics line, NOT a "close your other tabs" modal
// (which is what PARKING_LOT originally specified; that entry now says this).
// Three reasons, in order of weight:
//   1. `MultiTabScreen` shipped in v7.57 and already claims a single editing
//      tab with a visible screen. A modal here would be a second feature
//      telling the user the same thing about the same situation.
//   2. `blocked` is a WAIT, not a failure — it clears by itself the moment the
//      other connection goes away. A modal that appears and then has to be
//      dismissed for a condition that resolved itself is worse than a log.
//   3. With `versionchange` above in place, every Image Horse tab drops its
//      connection on demand, so `blocked` should only ever be reached by a tab
//      from a build that predates this guard, or by another browser profile
//      that BroadcastChannel cannot reach.
// RESIDUAL GAP, deliberately accepted and parked: if a block does persist, the
// app still waits with only a Diagnostics entry the user has no reason to open.
// The fix for that is a timeout that raises MultiTabScreen's shape rather than
// a new modal, and it is its own change.
db.on("blocked", () => {
  logDiagnostic(
    "INDEXEDDB",
    "Database upgrade is blocked by another open tab. Close other Image Horse tabs and reload.",
  );
});

// ── Hashing (content address) ────────────────────────────────────────────────

/** SHA-256 of a byte source as lowercase hex — the content-address key for
 *  originals. Inlined so this module stands alone from the legacy store. */
async function sha256Hex(bytes: BufferSource): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ── Originals ────────────────────────────────────────────────────────────────

/** Store an original image; returns its content-address id. No-ops (returns the
 *  existing id) if identical bytes are already stored. Drop-in for the legacy
 *  `originalsStore.putOriginal`. */
export async function putOriginal(
  file: File,
  width: number,
  height: number,
): Promise<string> {
  const buf = await file.arrayBuffer();
  const id = await sha256Hex(buf);
  const exists = await db.originals.get(id);
  if (!exists) {
    const mimeType = file.type || "application/octet-stream";
    await db.originals.put({
      id,
      blob: new Blob([buf], { type: mimeType }),
      mimeType,
      name: file.name,
      width,
      height,
      createdAt: Date.now(),
    });
  }
  return id;
}

// ── Photo metadata (the gallery) ─────────────────────────────────────────────

/** Insert or update a gallery row (refreshes `updatedAt`). */
export async function upsertPhotoMetadata(meta: PhotoMeta): Promise<string> {
  await db.photos.put({ ...meta, updatedAt: Date.now() });
  return meta.id;
}

/** Cascade-delete a photo: its row, its working copy, its op log + keyframes,
 *  and the original IFF no other photo still references that
 *  (content-addressed, shared) original. */
export async function deletePhoto(id: string): Promise<void> {
  await db.transaction(
    "rw",
    [db.photos, db.workingCopies, db.originals, db.opLogs, db.keyframes, db.oplogManifests],
    async () => {
      const photo = await db.photos.get(id);
      await db.photos.delete(id);
      await db.workingCopies.where("photoId").equals(id).delete();
      await db.opLogs.where("photoId").equals(id).delete();
      await db.keyframes.where("photoId").equals(id).delete();
      await db.oplogManifests.delete(id);
      if (photo) {
        const refs = await db.photos.where("originalId").equals(photo.originalId).count();
        if (refs === 0) await db.originals.delete(photo.originalId);
      }
    },
  );
}

// ── Op-log tables (low-level; the save/restore logic lives in
//    @/lib/oplogPersistence) ────────────────────────────────────────────────

/** Every persisted chunk for (photoId, branch), ordered by chunkSeq. */
export async function getOpLogChunks(
  photoId: string,
  branch: string,
): Promise<OpLogChunkRecord[]> {
  return db.opLogs
    .where("[photoId+branch+chunkSeq]")
    .between([photoId, branch, 0], [photoId, branch, Infinity], true, true)
    .toArray();
}

/** The nearest persisted keyframe at or before `atOp`, or undefined. */
export async function latestKeyframeAtOrBefore(
  photoId: string,
  branch: string,
  atOp: number,
): Promise<KeyframeRecord | undefined> {
  const all = await db.keyframes
    .where("[photoId+branch+atOp]")
    .between([photoId, branch, 0], [photoId, branch, atOp], true, true)
    .toArray();
  return all.length ? all[all.length - 1] : undefined;
}
