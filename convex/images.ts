import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getUserId } from "./users";

export const listByProject = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    if (!userId) return [];
    return await ctx.db
      .query("images")
      .withIndex("by_projectId_order", (q) =>
        q.eq("projectId", args.projectId)
      )
      .order("asc")
      .collect();
  },
});

export const get = query({
  args: { imageId: v.id("images") },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    if (!userId) return null;
    return await ctx.db.get(args.imageId);
  },
});

export const create = mutation({
  args: {
    projectId: v.id("projects"),
    originalUrl: v.string(),
    filename: v.string(),
    mimeType: v.string(),
    width: v.number(),
    height: v.number(),
    sizeBytes: v.number(),
    order: v.optional(v.number()),
    altText: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== userId) throw new Error("Not found");

    const now = Date.now();
    const imageId = await ctx.db.insert("images", {
      projectId: args.projectId,
      userId,
      originalUrl: args.originalUrl,
      filename: args.filename,
      mimeType: args.mimeType,
      width: args.width,
      height: args.height,
      sizeBytes: args.sizeBytes,
      order: args.order ?? project.imageCount,
      altText: args.altText,
      createdAt: now,
    });

    await ctx.db.patch(args.projectId, {
      imageCount: project.imageCount + 1,
      updatedAt: now,
    });

    return imageId;
  },
});

export const update = mutation({
  args: {
    imageId: v.id("images"),
    processedUrl: v.optional(v.string()),
    thumbnailUrl: v.optional(v.string()),
    altText: v.optional(v.string()),
    order: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const image = await ctx.db.get(args.imageId);
    if (!image || image.userId !== userId) throw new Error("Not found");
    const { imageId, ...fields } = args;
    await ctx.db.patch(imageId, fields);
  },
});

export const remove = mutation({
  args: { imageId: v.id("images") },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const image = await ctx.db.get(args.imageId);
    if (!image || image.userId !== userId) throw new Error("Not found");
    const project = await ctx.db.get(image.projectId);
    if (project) {
      await ctx.db.patch(image.projectId, {
        imageCount: Math.max(0, project.imageCount - 1),
        updatedAt: Date.now(),
      });
    }
    await ctx.db.delete(args.imageId);
  },
});

