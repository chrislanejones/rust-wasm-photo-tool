import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const get = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    return await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
  },
});

export const upsert = mutation({
  args: {
    tier: v.optional(
      v.union(v.literal("free"), v.literal("pro"), v.literal("team"))
    ),
    avatarUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const existing = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, { ...args, updatedAt: now });
    } else {
      await ctx.db.insert("userProfiles", {
        userId,
        tier: args.tier ?? "free",
        dailyUsage: 0,
        usageResetAt: now,
        avatarUrl: args.avatarUrl,
        updatedAt: now,
      });
    }
  },
});

export const incrementUsage = mutation({
  args: { amount: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    if (!profile) throw new Error("Profile not found");
    const now = Date.now();
    const oneDayMs = 86400000;
    const shouldReset = now - profile.usageResetAt > oneDayMs;
    await ctx.db.patch(profile._id, {
      dailyUsage: shouldReset ? (args.amount ?? 1) : profile.dailyUsage + (args.amount ?? 1),
      usageResetAt: shouldReset ? now : profile.usageResetAt,
      updatedAt: now,
    });
  },
});

