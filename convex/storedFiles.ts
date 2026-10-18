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

/** Indexed ownership check shared by failed uploads and terminal AI cleanup. */
export async function isStoredFileReferenced(ctx: MutationCtx, id: Id<"_storage">): Promise<boolean> {
  return Boolean(
    (await ctx.db.query("photo_edits").withIndex("by_storageId", (q) => q.eq("storageId", id)).first()) ??
    (await ctx.db.query("shares").withIndex("by_storageId", (q) => q.eq("storageId", id)).first()) ??
    (await ctx.db.query("ai_jobs").withIndex("by_inputStorageId", (q) => q.eq("inputStorageId", id)).first()) ??
    (await ctx.db.query("ai_jobs").withIndex("by_outputStorageId", (q) => q.eq("outputStorageId", id)).first()) ??
    (await ctx.db.query("ai_jobs").withIndex("by_maskStorageId", (q) => q.eq("maskStorageId", id)).first()) ??
    (await ctx.db.query("ai_jobs").withIndex("by_referenceStorageId1", (q) => q.eq("referenceStorageId1", id)).first()) ??
    (await ctx.db.query("ai_jobs").withIndex("by_referenceStorageId2", (q) => q.eq("referenceStorageId2", id)).first()) ??
    (await ctx.db.query("ai_jobs").withIndex("by_referenceStorageId3", (q) => q.eq("referenceStorageId3", id)).first()),
  );
}
