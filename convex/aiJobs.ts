import { v } from "convex/values";
import {
  internalMutation,
  internalQuery,
  query,
} from "./_generated/server";
import { getUserId, requireUser } from "./users";

// ── Per-tier daily job caps (rate limiting via users.dailyUsage) ───────────
// free can't reach here (UI + startJob both gate on tier), but keep it 0 so a
// stale client can't sneak a job through.
const TIER_DAILY_CAP: Record<string, number> = {
  free: 0,
  pro: 50,
  team: 200,
};
const ONE_DAY_MS = 86_400_000;

// ── Client-facing queries (UI subscribes to these) ─────────────────────────

/** Single job by id, with a signed output URL once the webhook has written
 *  the result. Returns null if the job isn't the caller's. */
export const getJob = query({
  args: { jobId: v.id("ai_jobs") },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    if (!userId) return null;
    const job = await ctx.db.get(args.jobId);
    if (!job || job.userId !== userId) return null;
    const outputUrl = job.outputStorageId
      ? await ctx.storage.getUrl(job.outputStorageId)
      : null;
    return {
      _id: job._id,
      type: job.type,
      status: job.status,
      error: job.error,
      output: job.output ?? null,
      outputUrl,
    };
  },
});

/** Most recent jobs for a photo (active + history), newest first. */
export const listForPhoto = query({
  args: { photoKey: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    if (!userId) return [];
    return await ctx.db
      .query("ai_jobs")
      .withIndex("by_userId_photoKey", (q) =>
        q.eq("userId", userId).eq("photoKey", args.photoKey),
      )
      .order("desc")
      .take(args.limit ?? 10);
  },
});

// ── Internal: transactional job start (auth + tier + rate limit + insert) ──
// Called by the dispatch action. Doing this in one mutation keeps the
// ownership check, usage increment, and insert in a single transaction.

export const startJob = internalMutation({
  args: {
    photoKey: v.string(),
    type: v.union(
      v.literal("rembg"),
      v.literal("upscale"),
      v.literal("inpaint"),
      v.literal("ocr"),
      v.literal("alt"),
    ),
    inputStorageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const cap = TIER_DAILY_CAP[user.tier] ?? 0;
    if (cap === 0) {
      throw new Error("AI tools require a paid plan");
    }

    // Roll the daily window forward if it's stale, mirroring incrementUsage.
    const now = Date.now();
    const windowExpired = now - user.usageResetAt > ONE_DAY_MS;
    const usedToday = windowExpired ? 0 : user.dailyUsage;
    if (usedToday >= cap) {
      throw new Error(`Daily AI limit reached (${cap}/day on ${user.tier})`);
    }

    await ctx.db.patch(user._id, {
      dailyUsage: usedToday + 1,
      usageResetAt: windowExpired ? now : user.usageResetAt,
      updatedAt: now,
    });

    const inputUrl = await ctx.storage.getUrl(args.inputStorageId);
    if (!inputUrl) throw new Error("Input image not found in storage");

    const jobId = await ctx.db.insert("ai_jobs", {
      userId: user._id,
      photoKey: args.photoKey,
      type: args.type,
      status: "running",
      inputStorageId: args.inputStorageId,
      startedAt: now,
      createdAt: now,
    });

    return { jobId, inputUrl };
  },
});

/** Attach the Replicate prediction id so the webhook can find this row. */
export const setReplicateId = internalMutation({
  args: { jobId: v.id("ai_jobs"), replicateId: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.jobId, { replicateId: args.replicateId });
  },
});

/** Webhook lookup — jobs aren't authenticated here, so key by replicateId. */
export const findByReplicateId = internalQuery({
  args: { replicateId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("ai_jobs")
      .withIndex("by_replicateId", (q) =>
        q.eq("replicateId", args.replicateId),
      )
      .unique();
  },
});

/** Mark a job done. Image models pass outputStorageId; text models pass output. */
export const completeJob = internalMutation({
  args: {
    jobId: v.id("ai_jobs"),
    outputStorageId: v.optional(v.id("_storage")),
    output: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.jobId, {
      status: "done",
      outputStorageId: args.outputStorageId,
      output: args.output,
      completedAt: Date.now(),
    });
  },
});

/** Mark a job failed with a human-readable error. */
export const failJob = internalMutation({
  args: { jobId: v.id("ai_jobs"), error: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.jobId, {
      status: "failed",
      error: args.error,
      completedAt: Date.now(),
    });
  },
});
