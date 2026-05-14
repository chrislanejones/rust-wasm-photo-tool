import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getUserId } from "./users";

export const listByUser = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    if (!userId) return [];
    return await ctx.db
      .query("ai_jobs")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .order("desc")
      .take(args.limit ?? 20);
  },
});

export const listByImage = query({
  args: { imageId: v.id("images") },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    if (!userId) return [];
    return await ctx.db
      .query("ai_jobs")
      .withIndex("by_imageId", (q) => q.eq("imageId", args.imageId))
      .order("desc")
      .collect();
  },
});

export const create = mutation({
  args: {
    imageId: v.id("images"),
    type: v.union(
      v.literal("rembg"),
      v.literal("upscale"),
      v.literal("inpaint"),
      v.literal("alt")
    ),
    input: v.any(),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const image = await ctx.db.get(args.imageId);
    if (!image || image.userId !== userId) throw new Error("Not authorized");
    return await ctx.db.insert("ai_jobs", {
      userId,
      imageId: args.imageId,
      type: args.type,
      status: "pending",
      input: args.input,
      createdAt: Date.now(),
    });
  },
});

export const updateStatus = mutation({
  args: {
    jobId: v.id("ai_jobs"),
    status: v.union(
      v.literal("pending"),
      v.literal("running"),
      v.literal("done"),
      v.literal("failed")
    ),
    replicateId: v.optional(v.string()),
    output: v.optional(v.any()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const job = await ctx.db.get(args.jobId);
    if (!job || job.userId !== userId) throw new Error("Not authorized");
    const now = Date.now();
    const { jobId, ...fields } = args;
    await ctx.db.patch(jobId, {
      ...fields,
      startedAt: fields.status === "running" ? now : job.startedAt,
      completedAt:
        fields.status === "done" || fields.status === "failed"
          ? now
          : job.completedAt,
    });
  },
});

