import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const listByImage = query({
  args: { imageId: v.id("images"), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return await ctx.db
      .query("history")
      .withIndex("by_imageId_createdAt", (q) =>
        q.eq("imageId", args.imageId)
      )
      .order("desc")
      .take(args.limit ?? 50);
  },
});

export const push = mutation({
  args: {
    imageId: v.id("images"),
    action: v.union(
      v.literal("create"),
      v.literal("update"),
      v.literal("delete"),
      v.literal("ai_rembg"),
      v.literal("ai_upscale"),
      v.literal("ai_inpaint"),
      v.literal("ai_alt")
    ),
    target: v.union(
      v.literal("annotation"),
      v.literal("layer"),
      v.literal("image")
    ),
    targetId: v.string(),
    prevState: v.optional(v.any()),
    nextState: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    return await ctx.db.insert("history", {
      ...args,
      userId,
      createdAt: Date.now(),
    });
  },
});

export const clearForImage = mutation({
  args: { imageId: v.id("images") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const rows = await ctx.db
      .query("history")
      .withIndex("by_imageId", (q) => q.eq("imageId", args.imageId))
      .collect();
    for (const row of rows) {
      await ctx.db.delete(row._id);
    }
  },
});

