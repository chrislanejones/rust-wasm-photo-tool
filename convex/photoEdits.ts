import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { getUser, requireUser } from "./users";

/** Returns a short-lived upload URL for storing a canvas archive. Open to all. */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
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

// ── Anonymous (session-keyed) variants ────────────────────────────────────

export const saveAnonymous = mutation({
  args: {
    sessionId: v.string(),
    photoKey: v.string(),
    storageId: v.id("_storage"),
    canvasW: v.number(),
    canvasH: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("session_edits")
      .withIndex("by_sessionId_photoKey", (q) =>
        q.eq("sessionId", args.sessionId).eq("photoKey", args.photoKey),
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
      await ctx.db.insert("session_edits", {
        sessionId: args.sessionId,
        photoKey: args.photoKey,
        storageId: args.storageId,
        canvasW: args.canvasW,
        canvasH: args.canvasH,
        updatedAt: Date.now(),
      });
    }
  },
});

export const getAnonymousEdit = query({
  args: { sessionId: v.string(), photoKey: v.string() },
  handler: async (ctx, args) => {
    const edit = await ctx.db
      .query("session_edits")
      .withIndex("by_sessionId_photoKey", (q) =>
        q.eq("sessionId", args.sessionId).eq("photoKey", args.photoKey),
      )
      .unique();
    if (!edit) return null;
    const downloadUrl = await ctx.storage.getUrl(edit.storageId);
    return { canvasW: edit.canvasW, canvasH: edit.canvasH, downloadUrl };
  },
});

export const removeAnonymous = mutation({
  args: { sessionId: v.string(), photoKey: v.string() },
  handler: async (ctx, args) => {
    const edit = await ctx.db
      .query("session_edits")
      .withIndex("by_sessionId_photoKey", (q) =>
        q.eq("sessionId", args.sessionId).eq("photoKey", args.photoKey),
      )
      .unique();
    if (edit) {
      await ctx.storage.delete(edit.storageId);
      await ctx.db.delete(edit._id);
    }
  },
});

export const clearAllAnonymous = mutation({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const edits = await ctx.db
      .query("session_edits")
      .withIndex("by_sessionId_photoKey", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    for (const edit of edits) {
      await ctx.storage.delete(edit.storageId);
      await ctx.db.delete(edit._id);
    }
  },
});

// ── Cleanup ───────────────────────────────────────────────────────────────

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

export const expireSessionEdits = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - THREE_DAYS_MS;
    const stale = await ctx.db
      .query("session_edits")
      .filter((q) => q.lt(q.field("updatedAt"), cutoff))
      .collect();
    for (const edit of stale) {
      await ctx.storage.delete(edit.storageId);
      await ctx.db.delete(edit._id);
    }
  },
});
