import { v } from "convex/values";
import {
  internalMutation,
  internalQuery,
  query,
} from "./_generated/server";
import { getUserId, requireUser, roleOf } from "./users";
import { entitlementOf } from "./entitlement";
import { aiCapsFor } from "./aiCaps";

/* ── Per-tier AI job caps ──────────────────────────────────────────────────
 *
 * ⚠️ THIS IS THE ONE PLACE THE NUMBERS LIVE. The settings pane reads them back
 * through the `usage` query below rather than keeping its own copy — a second
 * copy of a limit is how the pricing page ended up advertising "unlimited AI
 * passes" against a 50-a-day cap.
 *
 * TWO WINDOWS, because they do different jobs:
 *
 *   daily    stops a burst. One user cannot empty the month in an afternoon.
 *   monthly  bounds what the plan COSTS. A daily cap alone does not: 50 a day
 *            is 1,500 a month, and every one is a Replicate invoice against a
 *            $10 subscription. The monthly number is the margin.
 *
 * The monthly figures are set so the daily cap is the one a normal user meets
 * and the monthly cap is the one only an outlier does. Pro at 300 is ten a day
 * every day, or the full 50 on six separate days — comfortably more than the
 * usage these tools actually see, and far below the 1,500 the daily cap alone
 * would have allowed.
 *
 * The numbers live in `aiCaps.ts` and are chosen by ENTITLEMENT (QC F3): an
 * admin on a free row gets paid caps, exactly as `users.me` tells the UI. */
const ONE_DAY_MS = 86_400_000;
const ONE_MONTH_MS = 30 * ONE_DAY_MS;

/** Usage in a rolling window, with the window rolled forward if it is stale.
 *
 *  Rolling, not calendar: a calendar month needs a timezone to be meaningful
 *  and this backend has no opinion about the user's. Thirty days from first
 *  use is a window every reader can check against their own clock. */
function windowUsage(used: number | undefined, resetAt: number | undefined, span: number, now: number) {
  const started = resetAt ?? now;
  const expired = now - started > span;
  return {
    used: expired ? 0 : (used ?? 0),
    resetAt: expired ? now : started,
    expired,
    /** When this window next empties. */
    resetsAt: (expired ? now : started) + span,
  };
}

// ── Client-facing queries (UI subscribes to these) ─────────────────────────

/** What Settings → AI Usage draws.
 *
 *  Returns the caps as well as the counts, so the pane never hardcodes a
 *  number. Returns `null` rather than throwing when signed out: the pane is
 *  reachable in demo mode, and a query that throws there would take the
 *  settings dialog down with it. */
export const usage = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getUserId(ctx);
    if (!userId) return null;
    const user = await ctx.db.get(userId);
    if (!user) return null;

    const now = Date.now();
    const day = windowUsage(user.dailyUsage, user.usageResetAt, ONE_DAY_MS, now);
    const month = windowUsage(user.monthlyUsage, user.monthResetAt, ONE_MONTH_MS, now);
    const caps = aiCapsFor(user.tier, entitlementOf(user.tier, await roleOf(ctx, user), true));

    return {
      tier: user.tier,
      daily: {
        used: day.used,
        cap: caps.daily,
        resetsAt: day.resetsAt,
      },
      monthly: {
        used: month.used,
        cap: caps.monthly,
        resetsAt: month.resetsAt,
      },
    };
  },
});

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
    maskStorageId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const entitlement = entitlementOf(user.tier, await roleOf(ctx, user), true);
    const caps = aiCapsFor(user.tier, entitlement);

    const cap = caps.daily;
    if (cap === 0) {
      throw new Error("AI tools require a paid plan");
    }

    // Roll both windows forward if they're stale, mirroring incrementUsage.
    const now = Date.now();
    const day = windowUsage(user.dailyUsage, user.usageResetAt, ONE_DAY_MS, now);
    const month = windowUsage(user.monthlyUsage, user.monthResetAt, ONE_MONTH_MS, now);

    if (day.used >= cap) {
      throw new Error(`Daily AI limit reached (${cap}/day on ${user.tier})`);
    }
    const monthCap = caps.monthly;
    if (month.used >= monthCap) {
      throw new Error(
        `Monthly AI limit reached (${monthCap}/month on ${user.tier})`,
      );
    }

    // Both counters move in the same patch as the insert's transaction, so a
    // job can never be created without being counted.
    await ctx.db.patch(user._id, {
      dailyUsage: day.used + 1,
      usageResetAt: day.resetAt,
      monthlyUsage: month.used + 1,
      monthResetAt: month.resetAt,
      updatedAt: now,
    });

    const inputUrl = await ctx.storage.getUrl(args.inputStorageId);
    if (!inputUrl) throw new Error("Input image not found in storage");

    let maskUrl: string | null = null;
    if (args.maskStorageId) {
      maskUrl = await ctx.storage.getUrl(args.maskStorageId);
      if (!maskUrl) throw new Error("Mask image not found in storage");
    }

    const jobId = await ctx.db.insert("ai_jobs", {
      userId: user._id,
      photoKey: args.photoKey,
      type: args.type,
      status: "running",
      inputStorageId: args.inputStorageId,
      maskStorageId: args.maskStorageId,
      startedAt: now,
      createdAt: now,
    });

    return { jobId, inputUrl, maskUrl };
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
