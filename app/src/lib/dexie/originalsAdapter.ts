// Originals storage adapter — the single seam through which the app reads and
// writes original photo bytes during the Dexie cut-over.
//
// WHY A SEPARATE FILE (not db.ts's getOriginal): the legacy `originalsStore`
// returns `StoredOriginal { bytes: ArrayBuffer, ... }`, but the Dexie
// `OriginalRecord` stores `blob: Blob`. Every call site reads `.bytes`. To keep
// the cut-over a mechanical import-path swap (no behaviour change at call
// sites), this adapter presents the *legacy* `StoredOriginal` signature and
// converts Dexie's Blob at the boundary. `db.ts`'s native (Blob-based) API is
// left untouched for the future gallery / working-copy work.
//
// MIGRATION STRATEGY — lazy read-through, no bulk backfill:
//   getOriginal:    Dexie first → miss falls through to legacy; a legacy hit is
//                   copied into Dexie (same content-hash key) then returned.
//                   Read-through IS the backfill: no boot stall, crash-safe, and
//                   the legacy DB is never written, so it stays a clean rollback.
//   putOriginal:    writes to Dexie ONLY.
//   deleteOriginal: deletes from BOTH so a delete can't resurrect via read-through.
//   listOriginals:  UNION of both stores' keys, deduped (content-addressed keys
//                   make dedupe correct).
//
// KILL SWITCH: `USE_DEXIE_ORIGINALS = false` routes every operation back to the
// legacy store only — the runtime rollback. One flag, this one file.

import type { StoredOriginal } from "@/lib/originalsStore";
import {
  getOriginal as legacyGetOriginal,
  putOriginal as legacyPutOriginal,
  deleteOriginal as legacyDeleteOriginal,
  listOriginalKeys as legacyListKeys,
} from "@/lib/originalsStore";
import { db, putOriginal as dexiePutOriginal } from "@/lib/dexie/db";
import { USE_DEXIE_ORIGINALS } from "@/lib/dexie/flags";

/** Re-export the kill switch for call-site visibility (defined in flags.ts). */
export { USE_DEXIE_ORIGINALS } from "@/lib/dexie/flags";

/** Re-export the legacy record shape so call sites keep one canonical type. */
export type { StoredOriginal } from "@/lib/originalsStore";

/**
 * Store an original's bytes and return its content-address key. Writes to Dexie
 * only (or the legacy store when the kill switch is off). Idempotent for
 * identical bytes — the content hash dedupes.
 */
export async function putOriginal(
  file: File,
  width: number,
  height: number,
): Promise<string> {
  if (!USE_DEXIE_ORIGINALS) return legacyPutOriginal(file, width, height);
  return dexiePutOriginal(file, width, height);
}

/**
 * Fetch an original by content-address key with lazy read-through:
 *   1. Dexie hit → return it.
 *   2. Dexie miss → read the legacy store; on a hit, copy the bytes+metadata
 *      into Dexie under the same key (idempotent overwrite), then return them.
 *   3. Miss in both → null.
 *
 * The copy is safe to interrupt: the legacy store is never modified, so a failed
 * or torn copy just means the next read re-copies. Returns the legacy
 * `StoredOriginal` shape regardless of source.
 */
export async function getOriginal(key: string): Promise<StoredOriginal | null> {
  if (!USE_DEXIE_ORIGINALS) return legacyGetOriginal(key);

  const rec = await db.originals.get(key);
  if (rec) {
    return {
      bytes: await rec.blob.arrayBuffer(),
      mimeType: rec.mimeType,
      name: rec.name,
      width: rec.width,
      height: rec.height,
    };
  }

  // Read-through: legacy hit → copy into Dexie, then return.
  const legacy = await legacyGetOriginal(key);
  if (!legacy) return null;

  // Best-effort, idempotent backfill copy. Same content-hash key, so a re-run
  // overwrites identically. We do NOT touch the legacy record — read-through
  // only ever reads it. A copy failure (quota, torn write, interruption) must
  // NEVER fail the read of unbacked user data: swallow it and return the legacy
  // bytes; the next read re-reads legacy and retries the copy.
  try {
    await db.originals.put({
      id: key,
      blob: new Blob([legacy.bytes], { type: legacy.mimeType }),
      mimeType: legacy.mimeType,
      name: legacy.name,
      width: legacy.width,
      height: legacy.height,
      createdAt: Date.now(),
    });
  } catch {
    // Intentionally ignored — the legacy store remains the source of truth
    // until a later read-through successfully lands the copy.
  }

  return legacy;
}

/** Object URL for an original's bytes (caller must `URL.revokeObjectURL`). */
export async function getOriginalAsBlobUrl(key: string): Promise<string | null> {
  const r = await getOriginal(key);
  if (!r) return null;
  return URL.createObjectURL(new Blob([r.bytes], { type: r.mimeType }));
}

/**
 * Delete an original from BOTH stores. Deleting from the legacy store too is
 * what stops a just-deleted original from resurrecting on the next read-through.
 * Both deletes are idempotent (deleting an absent key is a no-op).
 */
export async function deleteOriginal(key: string): Promise<void> {
  if (!USE_DEXIE_ORIGINALS) {
    await legacyDeleteOriginal(key);
    return;
  }
  // Dexie first, then legacy. If the process dies between the two, the worst
  // case is a stale legacy record that read-through would copy back — so on the
  // next successful delete both are cleared; never a silent partial write.
  await db.originals.delete(key);
  await legacyDeleteOriginal(key);
}

/**
 * Every stored original's key, as the UNION of the Dexie and legacy stores,
 * deduplicated. Content-addressed keys make dedupe correct: the same bytes have
 * the same key in both stores.
 */
export async function listOriginals(): Promise<string[]> {
  if (!USE_DEXIE_ORIGINALS) return legacyListKeys();
  const [dexieKeys, legacyKeys] = await Promise.all([
    db.originals.toCollection().primaryKeys(),
    legacyListKeys(),
  ]);
  return Array.from(new Set([...dexieKeys.map(String), ...legacyKeys]));
}
