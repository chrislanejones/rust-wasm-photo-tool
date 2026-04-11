// .convex/users.ts
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { QueryCtx, MutationCtx } from "./_generated/server";

// ── Helpers (import these in other Convex files) ──────────

/** Resolve Clerk JWT → internal user. Returns null if not signed in. */
export async function getUser(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;

  return await ctx.db
    .query("users")
    .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
    .unique();
}

/** Resolve Clerk JWT → internal user. Throws if not signed in.
 *  Auto-creates the user row on first call. */
export async function requireUser(ctx: MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Not authenticated");

  const existing = await ctx.db
    .query("users")
    .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
    .unique();

  if (existing) return existing;

  // First time this Clerk user hits a mutation — create their row
  const now = Date.now();
  const id = await ctx.db.insert("users", {
    clerkId: identity.subject,
    email: identity.email,
    name: identity.name,
    avatarUrl: identity.pictureUrl,
    tier: "free",
    dailyUsage: 0,
    usageResetAt: now,
    createdAt: now,
    updatedAt: now,
  });

  const user = await ctx.db.get(id);
  if (!user) throw new Error("Failed to create user");
  return user;
}

// ── Public API ────────────────────────────────────────────

/** Get the current user's profile (or null). */
export const me = query({
  args: {},
  handler: async (ctx) => {
    return await getUser(ctx);
  },
});

/** Upsert: sync latest Clerk profile data into Convex.
 *  Called client-side via useStoreUser on every sign-in. */
export const upsert = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();

    const now = Date.now();

    if (existing) {
      // Refresh profile fields from Clerk
      await ctx.db.patch(existing._id, {
        email: identity.email,
        name: identity.name,
        avatarUrl: identity.pictureUrl,
        updatedAt: now,
      });
      return existing._id;
    }

    return await ctx.db.insert("users", {
      clerkId: identity.subject,
      email: identity.email,
      name: identity.name,
      avatarUrl: identity.pictureUrl,
      tier: "free",
      dailyUsage: 0,
      usageResetAt: now,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/** Increment daily usage counter (resets after 24h). */
export const incrementUsage = mutation({
  args: { amount: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();
    const oneDayMs = 86_400_000;
    const shouldReset = now - user.usageResetAt > oneDayMs;

    await ctx.db.patch(user._id, {
      dailyUsage: shouldReset
        ? (args.amount ?? 1)
        : user.dailyUsage + (args.amount ?? 1),
      usageResetAt: shouldReset ? now : user.usageResetAt,
      updatedAt: now,
    });
  },
});
