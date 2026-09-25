// The one place a row's stored file is deleted.
//
// Every delete path that removes a file-owning row (photoEdits.remove,
// photoEdits.clearAll, shares.remove, and the test-account wipe) goes through
// the per-table helpers built on this, so "the file goes with its row, in the
// same transaction" is written once instead of once per caller.
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import type { DeletedFiles } from "./testAccount";

/**
 * Delete one stored file and return its size in bytes, or null when the file
 * was already gone.
 *
 * The existence check is there so a row whose file has already vanished can
 * still be removed, whatever `ctx.storage.delete` does with a missing id (not
 * measured here). It also supplies the size, which is how the wipe reports the
 * bytes it freed.
 */
export async function deleteStoredFile(ctx: MutationCtx, storageId: Id<"_storage">): Promise<number | null> {
  const meta = await ctx.db.system.get("_storage", storageId);
  if (!meta) return null;
  await ctx.storage.delete(storageId);
  return meta.size;
}

/** Delete several of one row's files (skipping absent ids and repeats). */
export async function deleteStoredFiles(
  ctx: MutationCtx,
  ids: ReadonlyArray<Id<"_storage"> | undefined>,
): Promise<DeletedFiles> {
  const out: DeletedFiles = { files: 0, bytes: 0 };
  for (const id of new Set(ids)) {
    if (id === undefined) continue;
    const size = await deleteStoredFile(ctx, id);
    if (size === null) continue;
    out.files += 1;
    out.bytes += size;
  }
  return out;
}
