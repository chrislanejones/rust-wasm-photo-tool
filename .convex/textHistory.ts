// .convex/textHistory.ts
// Recent text history — synced per user via Convex.
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getUser, requireUser } from "./users";

/** Add or bump a recent text entry. Deduplicates by text content.
 *  Keeps the 8 most-recently-used entries per user. */
export const addRecentText = mutation({
  args: {
    text: v.string(),
    fontSize: v.number(),
    fontWeight: v.union(v.literal("normal"), v.literal("bold")),
    textColor: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    // Remove any existing entry with the same text
    const existing = await ctx.db
      .query("recent_texts")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect();
    for (const e of existing) {
      if (e.text === args.text) await ctx.db.delete(e._id);
    }

    // Insert latest
    await ctx.db.insert("recent_texts", {
      userId: user._id,
      text: args.text,
      fontSize: args.fontSize,
      fontWeight: args.fontWeight,
      textColor: args.textColor,
      usedAt: Date.now(),
    });

    // Trim to 8 most-recent
    const all = await ctx.db
      .query("recent_texts")
      .withIndex("by_userId_usedAt", (q) => q.eq("userId", user._id))
      .order("desc")
      .collect();
    for (const e of all.slice(8)) await ctx.db.delete(e._id);
  },
});

/** Get the 8 most-recently-used texts for the current user.
 *  Returns [] if not signed in. */
export const getRecentTexts = query({
  args: {},
  handler: async (ctx) => {
    const user = await getUser(ctx);
    if (!user) return [];
    return await ctx.db
      .query("recent_texts")
      .withIndex("by_userId_usedAt", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(8);
  },
});
