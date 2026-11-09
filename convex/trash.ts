import { v } from "convex/values";
import { internalMutation, mutation, query, type MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { getUser, requireUser, roleOf } from "./users";
import { entitlementOf, STORAGE_QUOTA_BYTES, trashWindowDays } from "./entitlement";
import { deleteShareRecord } from "./shares";
import { fileSize, recountStoredBytes } from "./storageUsage";

// ── The trash: share links only (ADR-101) ─────────────────────────────────────
//
// WHAT IT HOLDS. Gallery photos live in the browser, so a server trash can only
// hold what is on the server: cloud edit backups (`photo_edits`) and share-link
// snapshots (`shares`). A backup is deleted only when its photo is deleted in
// the browser, and restoring it would need the photo back too — the original,
// which the server does not have. That is Transfer's or sync's job, not this
// one's. So the trash holds SHARE LINKS: `shares.moveToTrash` puts one here,
// and these functions list, restore, delete and purge them.
//
// RULES (ADR-083, UI Night 6). Free keeps a trashed link 7 days, paid 30
// (convex/entitlement.ts). Trash counts against the quota until it is gone —
// the quota sums every share row, trashed or not. Being over the quota refuses
// uploads; nothing here ever deletes to make room.
//
// Reached only from the `trash` Beta in Settings › Shared. Without it a link's
// Delete is still `shares.remove`, immediate, exactly as before.

const DAY_MS = 86_400_000;

/** One trashed link, as the Trash view draws it. */
export interface TrashedShare {
  token: string;
  title: string | null;
  bytes: number;
  deletedAt: number;
  /** When `trash.purge` may remove it (ms epoch). */
  purgeAt: number;
  imageUrl: string | null;
}

async function trashedSharesOf(ctx: Parameters<typeof recountStoredBytes>[0], userId: Id<"users">) {
  const rows = await ctx.db
    .query("shares")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .collect();
  return rows.filter((s) => s.deletedAt !== undefined);
}

/** The owner's trash: items, the window, and the quota gauge's three figures.
 *  `null` when signed out — logged-out users have nothing on the server. */
export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const user = await getUser(ctx);
    if (!user) return null;
    return await trashOf(ctx, user);
  },
});

/** One user's trash, for the Trash view and the MCP tool. */
export async function trashOf(ctx: Parameters<typeof recountStoredBytes>[0], user: Doc<"users">) {
    const entitlement = entitlementOf(user.tier, await roleOf(ctx, user), true);
    const windowDays = trashWindowDays(entitlement);

    const trashed = await trashedSharesOf(ctx, user._id);
    trashed.sort((a, b) => (b.deletedAt ?? 0) - (a.deletedAt ?? 0));
    const items: TrashedShare[] = [];
    let trashBytes = 0;
    for (const s of trashed) {
      const bytes = await fileSize(ctx, s.storageId);
      trashBytes += bytes;
      items.push({
        token: s.token,
        title: s.title ?? null,
        bytes,
        deletedAt: s.deletedAt!,
        purgeAt: s.deletedAt! + windowDays * DAY_MS,
        imageUrl: await ctx.storage.getUrl(s.storageId),
      });
    }
    const totalBytes = await recountStoredBytes(ctx, user._id);
    return {
      paid: entitlement === "paid",
      windowDays,
      items,
      quota: {
        usedBytes: Math.max(0, totalBytes - trashBytes),
        trashBytes,
        limitBytes: STORAGE_QUOTA_BYTES[entitlement],
      },
    };
}

/** The caller's trashed share for `token`, or null. Throws for someone else's. */
async function ownedTrashed(ctx: MutationCtx, token: string): Promise<Doc<"shares"> | null> {
  const user = await requireUser(ctx);
  const share = await ctx.db
    .query("shares")
    .withIndex("by_token", (q) => q.eq("token", token))
    .unique();
  if (!share) return null;
  if (share.userId !== user._id) throw new Error("Not your share link");
  return share.deletedAt === undefined ? null : share;
}

/** Restore: the link is served again, at the same address, with its limits. */
export const restore = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const share = await ownedTrashed(ctx, args.token);
    if (!share) return;
    await ctx.db.patch(share._id, { deletedAt: undefined });
  },
});

/** Delete now: the row, its views and its image (unless something else uses
 *  the image), through the one share delete path. Only a trashed link: a live
 *  one goes to the trash first. */
export const deleteNow = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const share = await ownedTrashed(ctx, args.token);
    if (!share) return;
    await deleteShareRecord(ctx, share);
  },
});

/** Rows per Empty trash call. The view calls again while `more` is true. */
const EMPTY_BATCH = 50;

/** Empty trash: Delete now for every trashed link, a batch per call. */
export const empty = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const trashed = await trashedSharesOf(ctx, user._id);
    const batch = trashed.slice(0, EMPTY_BATCH);
    for (const s of batch) await deleteShareRecord(ctx, s);
    return { deleted: batch.length, more: trashed.length > batch.length };
  },
});

// ── The purge ─────────────────────────────────────────────────────────────────
//
// ⚠️ DRY RUN UNLESS TOLD OTHERWISE, and not scheduled — see crons.ts. It
// reports what it WOULD remove; `apply: true` removes it.
//
//   pnpm exec convex run trash:purge '{}'               # report only
//   pnpm exec convex run trash:purge '{"apply": true}'  # deletes
//
// One range over `by_deletedAt` finds rows past the SHORTER window; each is
// then held to its owner's own window, so a paid account's 10-day-old link is
// reported as kept, not purged.

const DEFAULT_MAX_ROWS = 200;
const LIST_CAP = 200;

export const purge = internalMutation({
  args: {
    apply: v.optional(v.boolean()),
    maxRows: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const apply = args.apply === true;
    const maxRows = Math.max(1, Math.floor(args.maxRows ?? DEFAULT_MAX_ROWS));
    const now = Date.now();
    const shortest = trashWindowDays("free");
    const cutoff = now - shortest * DAY_MS;

    const rows = await ctx.db
      .query("shares")
      // `gt(0)` skips the rows with no `deletedAt` (undefined sorts first).
      .withIndex("by_deletedAt", (q) => q.gt("deletedAt", 0).lt("deletedAt", cutoff))
      .take(maxRows + 1);
    const more = rows.length > maxRows;

    const windowOf = new Map<Id<"users">, number>();
    const due: { share: Doc<"shares">; bytes: number }[] = [];
    let keptByWindow = 0;
    for (const share of rows.slice(0, maxRows)) {
      let days = windowOf.get(share.userId);
      if (days === undefined) {
        const owner = await ctx.db.get(share.userId);
        days = trashWindowDays(entitlementOf(owner?.tier, await roleOf(ctx, owner), true));
        windowOf.set(share.userId, days);
      }
      if (now - share.deletedAt! < days * DAY_MS) {
        keptByWindow += 1;
        continue;
      }
      due.push({ share, bytes: await fileSize(ctx, share.storageId) });
    }

    let filesDeleted = 0;
    if (apply) {
      for (const d of due) filesDeleted += (await deleteShareRecord(ctx, d.share)).files;
    }

    const bytes = due.reduce((n, d) => n + d.bytes, 0);
    const mode = apply ? "applied" : "dry-run";
    console.log(
      `trash.purge ${mode}: ${due.length} share links (${bytes} bytes) past their window, ` +
        `${keptByWindow} kept inside a longer window${more ? ", more remain" : ""}`,
    );
    return {
      mode,
      rows: due.length,
      bytes,
      filesDeleted,
      keptByWindow,
      more,
      list: due.slice(0, LIST_CAP).map((d) => ({
        token: d.share.token,
        userId: d.share.userId,
        deletedAt: d.share.deletedAt!,
        bytes: d.bytes,
      })),
    };
  },
});
