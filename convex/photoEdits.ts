import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getUser, requireUser } from "./users";

/** Returns a short-lived upload URL for storing a canvas archive.
 *  Auth-gated: only signed-in users can mint upload URLs (prevents anonymous
 *  clients from pushing orphaned blobs into storage). */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireUser(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Delete an archive that was uploaded but never pointed at.
 *
 * THE HOLE THIS CLOSES. `savePhotoEdit` uploads the archive FIRST and commits
 * the pointer SECOND (`save`, above). Any failure between the two strands a
 * `_storage` file that nothing will ever reference, and `crons.ts` is empty, so
 * nothing sweeps it. That is what produced 3,535 MB of orphans — 97% of all
 * stored bytes — which exceeded the Convex free plan on 2026-08-05, disabled
 * every deployment on the account, and took an unrelated production site down
 * with it. Rate-limiting the uploads slowed the rate; only this closes the hole.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * WHY THIS REFUSES INSTEAD OF JUST DELETING
 * ─────────────────────────────────────────────────────────────────────────
 *
 * The caller reaches this from a `catch`, and the commonest way into that catch
 * is v7.57's 8-second `withTimeout` around `save`. A client-side timeout does
 * NOT mean the mutation failed — it very often means it is still in flight and
 * lands a moment later. Deleting unconditionally would then leave a `photo_edits`
 * row pointing at a file that no longer exists: an archive that reads as present
 * and decodes to nothing. That is strictly worse than the orphan it was trying
 * to prevent, because an orphan only costs bytes.
 *
 * So this deletes only what it can prove is unreferenced, checked inside the
 * same transaction as the delete. If `save` did land, the row references the
 * file, and this refuses and says so.
 *
 * The scan is also the AUTHORISATION check, and that is not incidental. A bare
 * storage id carries no owner — there is no ownership record for a file that no
 * row points at — so "delete this id for me" cannot be verified against the
 * caller. Checking every referencing table closes it from the other side: the
 * only ids this can delete are ones nobody references, which are garbage by
 * definition. A caller passing someone else's live storage id gets a refusal.
 *
 * Bounded scans rather than an index: these tables are small (single digits to
 * low hundreds), and adding a `by_storageId` index to three tables to serve a
 * failure path would be a schema change carried forever for a rare call.
 */
export const discardFailedUpload = mutation({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    await requireUser(ctx);

    for (const row of await ctx.db.query("photo_edits").take(2000)) {
      if (row.storageId === args.storageId) return { deleted: false, reason: "referenced" };
    }
    for (const row of await ctx.db.query("shares").take(2000)) {
      if (row.storageId === args.storageId) return { deleted: false, reason: "referenced" };
    }
    for (const row of await ctx.db.query("ai_jobs").take(2000)) {
      if (
        row.inputStorageId === args.storageId ||
        row.outputStorageId === args.storageId ||
        row.maskStorageId === args.storageId
      ) {
        return { deleted: false, reason: "referenced" };
      }
    }

    await ctx.storage.delete(args.storageId);
    return { deleted: true, reason: "unreferenced" };
  },
});

/** Upsert the canvas state for a photo (replaces any previous storage blob). */
export const save = mutation({
  args: {
    photoKey: v.string(),
    storageId: v.id("_storage"),
    canvasW: v.number(),
    canvasH: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const existing = await ctx.db
      .query("photo_edits")
      .withIndex("by_userId_photoKey", (q) =>
        q.eq("userId", user._id).eq("photoKey", args.photoKey),
      )
      .unique();
    if (existing) {
      await ctx.storage.delete(existing.storageId);
      await ctx.db.patch(existing._id, {
        storageId: args.storageId,
        canvasW: args.canvasW,
        canvasH: args.canvasH,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("photo_edits", {
        userId: user._id,
        photoKey: args.photoKey,
        storageId: args.storageId,
        canvasW: args.canvasW,
        canvasH: args.canvasH,
        updatedAt: Date.now(),
      });
    }
  },
});

/** Return the edit record + a signed download URL, or null. */
export const getEdit = query({
  args: { photoKey: v.string() },
  handler: async (ctx, args) => {
    const user = await getUser(ctx);
    if (!user) return null;
    const edit = await ctx.db
      .query("photo_edits")
      .withIndex("by_userId_photoKey", (q) =>
        q.eq("userId", user._id).eq("photoKey", args.photoKey),
      )
      .unique();
    if (!edit) return null;
    const downloadUrl = await ctx.storage.getUrl(edit.storageId);
    return { canvasW: edit.canvasW, canvasH: edit.canvasH, downloadUrl };
  },
});

/** Delete the edit + storage blob for a photo. */
export const remove = mutation({
  args: { photoKey: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const edit = await ctx.db
      .query("photo_edits")
      .withIndex("by_userId_photoKey", (q) =>
        q.eq("userId", user._id).eq("photoKey", args.photoKey),
      )
      .unique();
    if (edit) {
      await ctx.storage.delete(edit.storageId);
      await ctx.db.delete(edit._id);
    }
  },
});

/** Delete all canvas edits + blobs for the current user. */
export const clearAll = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const edits = await ctx.db
      .query("photo_edits")
      .withIndex("by_userId_photoKey", (q) => q.eq("userId", user._id))
      .collect();
    for (const edit of edits) {
      await ctx.storage.delete(edit.storageId);
      await ctx.db.delete(edit._id);
    }
  },
});
