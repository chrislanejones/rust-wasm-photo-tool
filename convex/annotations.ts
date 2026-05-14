import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

const styleValidator = v.object({
  stroke: v.optional(v.string()),
  fill: v.optional(v.string()),
  opacity: v.optional(v.number()),
  strokeWidth: v.optional(v.number()),
  fontSize: v.optional(v.number()),
});

const transformValidator = v.object({
  x: v.number(),
  y: v.number(),
  rotation: v.number(),
  scale: v.number(),
});

export const listByImage = query({
  args: { imageId: v.id("images") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return await ctx.db
      .query("annotations")
      .withIndex("by_imageId", (q) => q.eq("imageId", args.imageId))
      .collect();
  },
});

export const listByLayer = query({
  args: { layerId: v.id("layers") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return await ctx.db
      .query("annotations")
      .withIndex("by_layerId", (q) => q.eq("layerId", args.layerId))
      .collect();
  },
});

export const create = mutation({
  args: {
    imageId: v.id("images"),
    layerId: v.id("layers"),
    type: v.union(
      v.literal("rect"),
      v.literal("ellipse"),
      v.literal("path"),
      v.literal("text"),
      v.literal("arrow")
    ),
    data: v.any(),
    style: styleValidator,
    transform: transformValidator,
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const image = await ctx.db.get(args.imageId);
    if (!image || image.userId !== userId) throw new Error("Not authorized");
    return await ctx.db.insert("annotations", {
      ...args,
      locked: false,
      createdAt: Date.now(),
    });
  },
});

export const update = mutation({
  args: {
    annotationId: v.id("annotations"),
    data: v.optional(v.any()),
    style: v.optional(styleValidator),
    transform: v.optional(transformValidator),
    locked: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const annotation = await ctx.db.get(args.annotationId);
    if (!annotation) throw new Error("Not found");
    const image = await ctx.db.get(annotation.imageId);
    if (!image || image.userId !== userId) throw new Error("Not authorized");
    const { annotationId, ...fields } = args;
    await ctx.db.patch(annotationId, fields);
  },
});

export const remove = mutation({
  args: { annotationId: v.id("annotations") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const annotation = await ctx.db.get(args.annotationId);
    if (!annotation) throw new Error("Not found");
    const image = await ctx.db.get(annotation.imageId);
    if (!image || image.userId !== userId) throw new Error("Not authorized");
    await ctx.db.delete(args.annotationId);
  },
});

