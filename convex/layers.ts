import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getUserId } from "./users";

const blendModeValidator = v.union(
  v.literal("normal"),
  v.literal("multiply"),
  v.literal("screen"),
  v.literal("overlay"),
  v.literal("darken"),
  v.literal("lighten"),
  v.literal("color-dodge"),
  v.literal("color-burn"),
  v.literal("hard-light"),
  v.literal("soft-light"),
  v.literal("difference"),
  v.literal("exclusion")
);

export const listByImage = query({
  args: { imageId: v.id("images") },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    if (!userId) return [];
    return await ctx.db
      .query("layers")
      .withIndex("by_imageId_order", (q) => q.eq("imageId", args.imageId))
      .order("asc")
      .collect();
  },
});

export const create = mutation({
  args: {
    imageId: v.id("images"),
    name: v.string(),
    order: v.optional(v.number()),
    blendMode: v.optional(blendModeValidator),
    opacity: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const image = await ctx.db.get(args.imageId);
    if (!image || image.userId !== userId) throw new Error("Not found");

    const existing = await ctx.db
      .query("layers")
      .withIndex("by_imageId", (q) => q.eq("imageId", args.imageId))
      .collect();

    return await ctx.db.insert("layers", {
      imageId: args.imageId,
      name: args.name,
      order: args.order ?? existing.length,
      visible: true,
      locked: false,
      opacity: args.opacity ?? 1,
      blendMode: args.blendMode ?? "normal",
    });
  },
});

export const update = mutation({
  args: {
    layerId: v.id("layers"),
    name: v.optional(v.string()),
    order: v.optional(v.number()),
    visible: v.optional(v.boolean()),
    locked: v.optional(v.boolean()),
    opacity: v.optional(v.number()),
    blendMode: v.optional(blendModeValidator),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const layer = await ctx.db.get(args.layerId);
    if (!layer) throw new Error("Not found");
    const image = await ctx.db.get(layer.imageId);
    if (!image || image.userId !== userId) throw new Error("Not authorized");
    const { layerId, ...fields } = args;
    await ctx.db.patch(layerId, fields);
  },
});

export const remove = mutation({
  args: { layerId: v.id("layers") },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const layer = await ctx.db.get(args.layerId);
    if (!layer) throw new Error("Not found");
    const image = await ctx.db.get(layer.imageId);
    if (!image || image.userId !== userId) throw new Error("Not authorized");
    await ctx.db.delete(args.layerId);
  },
});

