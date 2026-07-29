// Reference checking for the content-addressed originals store — the guard that
// has to sit in front of every `deleteOriginal`.
//
// ─────────────────────────────────────────────────────────────────────────────
// THE BUG THIS EXISTS TO STOP (found 2026-07-28 by the GC reachability audit,
// docs/content-addressed-gc-audit.md § "Not asked for, and more serious")
//
// Originals are content-addressed, so identical bytes are ONE blob with many
// referrers — and `handleDuplicateSelected` leans on that deliberately: a
// duplicated photo reuses its source's `originalKey` for a zero-pixel copy.
//
// Every compress path used to guard its delete with `oldKey !== entry.uploadKey`.
// That guard only knows about the photo being compressed. It cannot see that
// another photo points at the same blob. So:
//
//   1. Import P            → originalKey = K, uploadKey = K
//   2. Compress P          → new blob N. Guard holds (K === uploadKey), K kept.
//                            P is now originalKey = N, uploadKey = K.
//   3. Duplicate P → C     → C shares originalKey = N and uploadKey = K.
//   4. Compress C          → oldKey = N, and N !== C.uploadKey (K), so the old
//                            guard deleted N — WHILE P STILL POINTED AT IT.
//
// P's bytes are gone and P's entry still references them. That is data loss, not
// garbage. The fix is to stop asking "is this the photo's own baseline?" and
// start asking "does ANYTHING still point at this?".
//
// ─────────────────────────────────────────────────────────────────────────────
// WHY A REACHABLE-SET CHECK AND NOT A STORED REFCOUNT
//
// A stored count has to be retrofitted onto every write site, needs a schema
// change (IndexedDB, no backup — the `dexie-migration` skill), and can drift out
// of sync with reality, at which point it needs a repair path of its own. The
// reachable set is derived fresh from the gallery on every call: it stores
// nothing, so it cannot drift, and it is the same mark phase the audit already
// computes. `db.ts`'s `deletePhoto` does have a refcount, but it counts rows in
// the Dexie `photos` table, which the audit measured as EMPTY in production
// (the live gallery is still the hand-rolled manifest) — a count that is always
// zero is not a guard. That path is also currently called only from tests.
//
// ─────────────────────────────────────────────────────────────────────────────
// ROOTS THIS MODULE KNOWS ABOUT — all three matter, and one is easy to miss:
//   · every photo's `originalKey`  — where it currently points
//   · every photo's `uploadKey`    — the immutable A/B compare baseline
//   · `extraRoots`                 — keys referenced from somewhere that is NOT
//     the gallery entry. BatchSettings keeps a per-photo "pre-logo baseline" in
//     a React ref (`logoBaselineRef` / `textBaselineRef`) so re-applying a logo
//     replaces it instead of stacking, and that key appears in NO manifest and
//     NO PhotoEntry. Collecting it would break re-apply, so batch call sites
//     pass it in. Callers with a root the gallery cannot see must declare it.
//
// The bias is deliberate and one-directional: when in doubt, KEEP. Over-keeping
// leaves garbage the audit can already measure and a future collector can sweep.
// Over-deleting destroys a user's photo with no backup and no server copy.

import { deleteOriginal } from "@/lib/dexie/originalsAdapter";

/** The minimal shape needed from a gallery entry. Structural on purpose — this
 *  file lives in lib/ and must not import from features/. `PhotoEntry`
 *  satisfies it. */
export interface OriginalRef {
  id: string;
  originalKey: string;
  uploadKey?: string;
}

/**
 * Every content key the gallery will still reference once `photoId` has been
 * repointed from its current original to `newKey`.
 *
 * The photo being repointed contributes `newKey` (where it is going) rather
 * than its current `originalKey` (where it was) — that is the whole question
 * being asked. Every OTHER photo contributes what it actually points at right
 * now. Upload baselines count for every photo including the one moving, which
 * is what the old `oldKey !== entry.uploadKey` guard was doing and is preserved
 * here rather than replaced.
 */
export function referencedOriginalKeys(
  photos: readonly OriginalRef[],
  photoId: string,
  newKey: string,
  extraRoots: readonly (string | undefined)[] = [],
): Set<string> {
  const keys = new Set<string>();
  for (const p of photos) {
    if (p.id === photoId) {
      if (newKey) keys.add(newKey);
    } else if (p.originalKey) {
      keys.add(p.originalKey);
    }
    if (p.uploadKey) keys.add(p.uploadKey);
  }
  for (const r of extraRoots) if (r) keys.add(r);
  return keys;
}

/** What `deleteReplacedOriginal` did, so call sites and tests can assert on it
 *  instead of inferring from the store. */
export type CollectVerdict =
  | "deleted"
  | "kept: no old key"
  | "kept: unchanged"
  | "kept: still referenced";

export interface DeleteReplacedArgs {
  /** The key the photo pointed at before this edit. */
  oldKey: string | undefined;
  /** The key it points at now. */
  newKey: string;
  /** The photo being repointed. */
  photoId: string;
  /** The gallery AS OF NOW. Read it fresh (`useGalleryStore.getState().photos`)
   *  rather than closing over a render-time snapshot: batch operations repoint
   *  many photos in a loop, and a stale array can miss a reference that was
   *  added after the render. */
  photos: readonly OriginalRef[];
  /** Keys referenced from outside the gallery — see the ROOTS note above. */
  extraRoots?: readonly (string | undefined)[];
  /** Seam for tests; defaults to the real adapter. */
  remove?: (key: string) => Promise<void>;
}

/**
 * Collect the blob a photo just stopped pointing at — but ONLY if nothing else
 * points at it. This is the one supported way to delete an original after a
 * repoint; call sites should not call `deleteOriginal` directly, because the
 * decision is exactly what used to be got wrong.
 *
 * Never throws: a failed delete leaves garbage, which is recoverable, whereas a
 * throw here would surface as a failed edit for something the user did not ask
 * for. The verdict is returned instead.
 */
export async function deleteReplacedOriginal({
  oldKey,
  newKey,
  photoId,
  photos,
  extraRoots = [],
  remove = deleteOriginal,
}: DeleteReplacedArgs): Promise<CollectVerdict> {
  if (!oldKey) return "kept: no old key";
  if (oldKey === newKey) return "kept: unchanged";

  const referenced = referencedOriginalKeys(photos, photoId, newKey, extraRoots);
  if (referenced.has(oldKey)) return "kept: still referenced";

  try {
    await remove(oldKey);
  } catch {
    // Garbage is recoverable; a thrown error mid-edit is not. The audit
    // (lib/contentAudit.ts) will count anything left behind.
    return "kept: still referenced";
  }
  return "deleted";
}
