// .convex/userColors.ts
// The global "+" color palette — synced per user via Convex. Anonymous users
// keep the same list in localStorage; see app/src/hooks/useUserColors.ts for
// the client that picks between the two.
import { v } from "convex/values";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { getUser, requireUser } from "./users";

/** Mirrors MAX_USER_COLORS in hooks/useUserColors.ts — change both. */
const MAX_USER_COLORS = 32;

/** Normalise for de-dup: lowercase, drop whitespace. */
const norm = (c: string) => c.trim().toLowerCase();

/** The current user's saved colors, newest first. [] when signed out. */
export const listUserColors = query({
  args: {},
  handler: async (ctx) => {
    const user = await getUser(ctx);
    if (!user) return [];
    return await colorsOf(ctx, user._id);
  },
});

export async function colorsOf(ctx: QueryCtx | MutationCtx, userId: Id<"users">): Promise<string[]> {
  const rows = await ctx.db
    .query("user_colors")
    .withIndex("by_userId_createdAt", (q) => q.eq("userId", userId))
    .order("desc")
    .take(MAX_USER_COLORS);
  return rows.map((r) => r.color);
}

/** Save a color to the palette. No-op if it is already there (case- and
 *  whitespace-insensitive). Trims the palette to the newest 32. */
export const addUserColor = mutation({
  args: { color: v.string() },
  handler: async (ctx, { color }) => {
    const user = await requireUser(ctx);
    await addColorFor(ctx, user._id, color);
  },
});

export async function addColorFor(ctx: MutationCtx, userId: Id<"users">, color: string): Promise<void> {
  const c = norm(color);
  if (!c) return;

  const existing = await ctx.db
    .query("user_colors")
    .withIndex("by_userId_createdAt", (q) => q.eq("userId", userId))
    .order("desc")
    .collect();
  if (existing.some((row) => norm(row.color) === c)) return;

  await ctx.db.insert("user_colors", { userId, color: c, createdAt: Date.now() });

  // `existing` is newest-first and excludes the row just inserted, so the
  // overflow is everything past the (MAX - 1)th oldest survivor.
  for (const row of existing.slice(MAX_USER_COLORS - 1)) {
    await ctx.db.delete(row._id);
  }
}

/** Remove a color from the palette. No-op if it is not there. */
export const removeUserColor = mutation({
  args: { color: v.string() },
  handler: async (ctx, { color }) => {
    const user = await requireUser(ctx);
    await removeColorFor(ctx, user._id, color);
  },
});

export async function removeColorFor(ctx: MutationCtx, userId: Id<"users">, color: string): Promise<void> {
  const c = norm(color);
  const rows = await ctx.db
    .query("user_colors")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .collect();
  for (const row of rows) {
    if (norm(row.color) === c) await ctx.db.delete(row._id);
  }
}
