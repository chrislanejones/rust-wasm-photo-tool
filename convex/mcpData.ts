import { ConvexError, v } from "convex/values";
import { internalMutation, internalQuery, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { usageOf } from "./aiJobs";
import { entitlementOf, STORAGE_QUOTA_BYTES } from "./entitlement";
import { mcpRefusal } from "./mcp";
import {
  availability,
  checkLimits,
  findByToken,
  pauseShareRecord,
  resumeShareRecord,
  trashShareRecord,
  writeShareLimits,
} from "./shares";
import { fileSize, recountStoredBytes } from "./storageUsage";
import { createTransfer, deleteTransferRecord } from "./transfers";
import { trashOf } from "./trash";
import { addColorFor, colorsOf, removeColorFor } from "./userColors";
import { roleOf } from "./users";

// ── What the MCP tools read and write (ADR-095) ───────────────────────────────
//
// The rules and the writes are the app's own helpers. This file only decides
// whose row it is. EVERY function takes `userId`, which mcpHttp.ts derives from
// the verified token: no tool has a user argument.
//
// SOMEONE ELSE'S ROW READS AS MISSING. The app says "Not your share link"; an AI
// app gets "not found", so it can't learn that a token or id exists.

const EDITOR_URL = "https://edit.imagehorse.app/";
const MiB = 1024 * 1024;

/** The kill switch again, inside the write's own transaction. */
async function enabledUser(ctx: QueryCtx | MutationCtx, userId: Id<"users">): Promise<Doc<"users">> {
  const user = await ctx.db.get(userId);
  if (!user) throw new ConvexError("This account no longer exists.");
  const refusal = mcpRefusal(user);
  if (refusal) throw new ConvexError(refusal);
  return user;
}

const NO_SHARE = "No share link with that token on this account.";

async function ownShare(ctx: MutationCtx, userId: Id<"users">, token: string): Promise<Doc<"shares">> {
  await enabledUser(ctx, userId);
  const share = await findByToken(ctx, token);
  if (!share || share.userId !== userId) throw new ConvexError(NO_SHARE);
  return share;
}

async function storageTotals(ctx: QueryCtx, user: Doc<"users">) {
  const entitlement = entitlementOf(user.tier, await roleOf(ctx, user), true);
  const counter = await ctx.db.query("storage_usage").withIndex("by_userId", (q) => q.eq("userId", user._id)).unique();
  return { usedBytes: counter?.bytes ?? (await recountStoredBytes(ctx, user._id)), allowedBytes: STORAGE_QUOTA_BYTES[entitlement] };
}

const mib = (bytes: number) => Math.round((bytes / MiB) * 10) / 10;

export const getAccount = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const user = await enabledUser(ctx, userId);
    const { usedBytes, allowedBytes } = await storageTotals(ctx, user);
    const ai = await usageOf(ctx, user);
    return {
      tier: user.tier,
      storage_used_mib: mib(usedBytes),
      storage_allowed_mib: mib(allowedBytes),
      ai_uses_left_today: Math.max(0, ai.daily.cap - ai.daily.used),
    };
  },
});

export const getStorage = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const user = await enabledUser(ctx, userId);
    const { usedBytes, allowedBytes } = await storageTotals(ctx, user);

    const sumFiles = async (ids: Id<"_storage">[]) => {
      let total = 0;
      for (const id of new Set(ids)) total += await fileSize(ctx, id);
      return total;
    };
    const edits = await ctx.db.query("photo_edits").withIndex("by_userId_photoKey", (q) => q.eq("userId", userId)).collect();
    const shares = await ctx.db.query("shares").withIndex("by_userId", (q) => q.eq("userId", userId)).collect();
    const transfers = await ctx.db.query("transfers").withIndex("by_userId_createdAt", (q) => q.eq("userId", userId)).collect();
    const jobs = await ctx.db.query("ai_jobs").withIndex("by_userId", (q) => q.eq("userId", userId)).take(2000);
    const jobFiles = jobs.flatMap((j) =>
      [j.inputStorageId, j.maskStorageId, j.outputStorageId, j.referenceStorageId1, j.referenceStorageId2, j.referenceStorageId3].filter(
        (id): id is Id<"_storage"> => id !== undefined,
      ),
    );

    return {
      used_bytes: usedBytes,
      allowed_bytes: allowedBytes,
      breakdown_bytes: {
        backups: await sumFiles(edits.map((e) => e.storageId)),
        shares: await sumFiles(shares.filter((s) => s.deletedAt === undefined).map((s) => s.storageId)),
        transfers: await sumFiles(transfers.map((t) => t.storageId)),
        trash: await sumFiles(shares.filter((s) => s.deletedAt !== undefined).map((s) => s.storageId)),
        ai_files_not_counted_in_used: await sumFiles(jobFiles),
      },
    };
  },
});

export const listShares = internalQuery({
  args: { userId: v.id("users"), limit: v.number(), offset: v.number() },
  handler: async (ctx, { userId, limit, offset }) => {
    await enabledUser(ctx, userId);
    const rows = await ctx.db.query("shares").withIndex("by_userId", (q) => q.eq("userId", userId)).collect();
    const live = rows.filter((s) => s.deletedAt === undefined).sort((a, b) => b.createdAt - a.createdAt);
    const now = Date.now();
    return {
      total: live.length,
      next_offset: offset + limit < live.length ? offset + limit : null,
      shares: live.slice(offset, offset + limit).map((s) => ({
        token: s.token,
        title: s.title ?? null,
        link: `${EDITOR_URL}?v=${s.token}`,
        views: s.views,
        max_views: s.maxViews ?? null,
        expires_at: s.expiresAt ? new Date(s.expiresAt).toISOString() : null,
        paused: s.pausedAt !== undefined,
        status: availability(s, now),
        created_at: new Date(s.createdAt).toISOString(),
      })),
    };
  },
});

export const pauseShare = internalMutation({
  args: { userId: v.id("users"), token: v.string() },
  handler: async (ctx, { userId, token }) => {
    await pauseShareRecord(ctx, await ownShare(ctx, userId, token));
    return { paused: true };
  },
});

export const resumeShare = internalMutation({
  args: { userId: v.id("users"), token: v.string() },
  handler: async (ctx, { userId, token }) => {
    await resumeShareRecord(ctx, await ownShare(ctx, userId, token));
    return { resumed: true };
  },
});

export const setShareLimits = internalMutation({
  args: {
    userId: v.id("users"),
    token: v.string(),
    maxViews: v.optional(v.union(v.number(), v.null())),
    expiresAt: v.optional(v.union(v.number(), v.null())),
  },
  handler: async (ctx, args) => {
    const share = await ownShare(ctx, args.userId, args.token);
    // Left out = keep what the link has. null = clear.
    const limits = {
      maxViews: args.maxViews === undefined ? (share.maxViews ?? null) : args.maxViews,
      expiresAt: args.expiresAt === undefined ? (share.expiresAt ?? null) : args.expiresAt,
    };
    const invalid = checkLimits(limits);
    if (invalid) throw new ConvexError(invalid);
    await writeShareLimits(ctx, share, limits);
    return { max_views: limits.maxViews, expires_at: limits.expiresAt ? new Date(limits.expiresAt).toISOString() : null };
  },
});

/** To the trash, not gone: an AI app's mistake can be undone (restore_share). */
export const trashShare = internalMutation({
  args: { userId: v.id("users"), token: v.string() },
  handler: async (ctx, { userId, token }) => {
    await trashShareRecord(ctx, await ownShare(ctx, userId, token));
    return { moved_to_trash: true, can_restore_with: "restore_share" };
  },
});

export const listTrash = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const trash = await trashOf(ctx, await enabledUser(ctx, userId));
    return {
      kept_for_days: trash.windowDays,
      items: trash.items.map((i) => ({
        token: i.token,
        title: i.title,
        bytes: i.bytes,
        trashed_at: new Date(i.deletedAt).toISOString(),
        removed_after: new Date(i.purgeAt).toISOString(),
      })),
    };
  },
});

export const restoreShare = internalMutation({
  args: { userId: v.id("users"), token: v.string() },
  handler: async (ctx, { userId, token }) => {
    const share = await ownShare(ctx, userId, token);
    if (share.deletedAt === undefined) throw new ConvexError("That share link isn't in the trash.");
    await ctx.db.patch(share._id, { deletedAt: undefined });
    return { restored: true };
  },
});

export const listPalette = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    await enabledUser(ctx, userId);
    return { colors: await colorsOf(ctx, userId) };
  },
});

export const addPaletteColors = internalMutation({
  args: { userId: v.id("users"), colors: v.array(v.string()) },
  handler: async (ctx, { userId, colors }) => {
    await enabledUser(ctx, userId);
    for (const color of colors) await addColorFor(ctx, userId, color);
    return { colors: await colorsOf(ctx, userId) };
  },
});

export const removePaletteColor = internalMutation({
  args: { userId: v.id("users"), color: v.string() },
  handler: async (ctx, { userId, color }) => {
    await enabledUser(ctx, userId);
    await removeColorFor(ctx, userId, color);
    return { colors: await colorsOf(ctx, userId) };
  },
});

export const listRecentTextStyles = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    await enabledUser(ctx, userId);
    const rows = await ctx.db
      .query("recent_texts")
      .withIndex("by_userId_usedAt", (q) => q.eq("userId", userId))
      .order("desc")
      .take(20);
    return {
      styles: rows.map((r) => ({ text: r.text, font_size: r.fontSize, font_family: r.fontFamily ?? null, font_weight: r.fontWeight, color: r.textColor })),
    };
  },
});

// ── Export recipes, inside the synced prefs document ──────────────────────────

const MAX_SAVED_RECIPES = 20; // MAX_SAVED_RECIPES in app/src/lib/exportRecipes.ts
/** prefs format that carries recipes (PREFS_FORMAT in app/src/lib/sync/docs.ts). */
const RECIPES_FORMAT = 2;

async function prefsRow(ctx: QueryCtx | MutationCtx, userId: Id<"users">) {
  return await ctx.db.query("sync_docs").withIndex("by_userId_key", (q) => q.eq("userId", userId).eq("key", "prefs")).unique();
}

function parsePrefs(value: string | null | undefined): Record<string, unknown> | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

const recipesIn = (prefs: Record<string, unknown> | null): Record<string, unknown>[] =>
  Array.isArray(prefs?.exportRecipes) ? (prefs.exportRecipes as Record<string, unknown>[]) : [];

export const listExportRecipes = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    await enabledUser(ctx, userId);
    return { recipes: recipesIn(parsePrefs((await prefsRow(ctx, userId))?.value)) };
  },
});

const recipeFields = {
  name: v.string(),
  size: v.any(),
  format: v.string(),
  quality: v.number(),
  pattern: v.string(),
};

/**
 * Add a recipe, or replace the one with this name. Only `exportRecipes` changes:
 * every other preference in the document is written back as it was, and `rev`
 * moves so other devices pick it up.
 *
 * NO PREFS DOCUMENT = REFUSED. A document holding only recipes would be adopted
 * by the user's devices as their whole preferences.
 */
export const saveExportRecipe = internalMutation({
  args: { userId: v.id("users"), ...recipeFields },
  handler: async (ctx, { userId, ...recipe }) => {
    await enabledUser(ctx, userId);
    const row = await prefsRow(ctx, userId);
    const prefs = parsePrefs(row?.value);
    if (!row || !prefs) throw new ConvexError("Open Image Horse signed in once so your preferences are synced, then try again.");

    const recipes = recipesIn(prefs);
    const same = recipes.findIndex((r) => r.name === recipe.name);
    if (same < 0 && recipes.length >= MAX_SAVED_RECIPES) {
      throw new ConvexError(`You already have ${MAX_SAVED_RECIPES} saved recipes. Remove one in the editor first.`);
    }
    const saved = { ...recipe, id: same >= 0 ? recipes[same]!.id : `recipe-${crypto.randomUUID()}` };
    if (same >= 0) recipes[same] = saved;
    else recipes.push(saved);

    await ctx.db.patch(row._id, {
      value: JSON.stringify({ ...prefs, exportRecipes: recipes }),
      rev: row.rev + 1,
      format: Math.max(row.format, RECIPES_FORMAT),
      updatedAt: Date.now(),
    });
    return { saved: recipe.name, total: recipes.length };
  },
});

export const getBackupSummary = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    await enabledUser(ctx, userId);
    const rows = await ctx.db.query("photo_edits").withIndex("by_userId_photoKey", (q) => q.eq("userId", userId)).collect();
    let total = 0;
    for (const id of new Set(rows.map((r) => r.storageId))) total += await fileSize(ctx, id);
    return { backups: rows.length, total_bytes: total };
  },
});

export const listAiUsage = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const u = await usageOf(ctx, await enabledUser(ctx, userId));
    return {
      today: { used: u.daily.used, cap: u.daily.cap, resets_at: new Date(u.daily.resetsAt).toISOString() },
      this_month: { used: u.monthly.used, cap: u.monthly.cap, resets_at: new Date(u.monthly.resetsAt).toISOString() },
    };
  },
});

// ── Transfer inbox ────────────────────────────────────────────────────────────

export const listInbox = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    await enabledUser(ctx, userId);
    const rows = await ctx.db
      .query("transfers")
      .withIndex("by_userId_createdAt", (q) => q.eq("userId", userId))
      .order("desc")
      .take(50);
    return {
      items: rows.map((t) => ({ id: t._id, name: t.name, bytes: t.bytes, type: t.mime, from: t.fromDevice, expires_at: new Date(t.expiresAt).toISOString() })),
    };
  },
});

/** A file `send_image_to_inbox` just stored. The app's own checks decide; a
 *  refused file is deleted by them, in this transaction. */
export const receiveImage = internalMutation({
  args: { userId: v.id("users"), storageId: v.id("_storage"), name: v.string(), from: v.string() },
  handler: async (ctx, args) => {
    let user: Doc<"users">;
    try {
      user = await enabledUser(ctx, args.userId);
    } catch (error) {
      // Switched off between admit and here: don't strand the uploaded file.
      await ctx.storage.delete(args.storageId);
      return { ok: false as const, message: error instanceof ConvexError ? String(error.data) : "That didn't work." };
    }
    const result = await createTransfer(ctx, user, { storageId: args.storageId, name: args.name, fromDevice: args.from });
    return result.ok ? result : { ok: false as const, message: result.message };
  },
});

export const removeFromInbox = internalMutation({
  args: { userId: v.id("users"), id: v.string() },
  handler: async (ctx, { userId, id }) => {
    await enabledUser(ctx, userId);
    const transferId = ctx.db.normalizeId("transfers", id);
    const row = transferId ? await ctx.db.get(transferId) : null;
    if (!row || row.userId !== userId) throw new ConvexError("Nothing with that id in this inbox.");
    await deleteTransferRecord(ctx, row);
    return { removed: true };
  },
});
