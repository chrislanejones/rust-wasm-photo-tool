import { v } from "convex/values";
import { internalMutation, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

// ── The per-user stored-bytes counter (widen → migrate → narrow) ──────────────
//
// WHY. `storageQuota.storedBytes` sums the account's files by reading at most
// 2,000 rows per table, so past that every extra row counts as zero and the
// quota fails OPEN. The biggest real account holds about 32 rows, so this is
// the quota's correctness, not an emergency. A counter kept exact by the
// writes themselves answers in one read, whatever the account's size.
//
// WHAT IT COUNTS — exactly what the quota counts today, and nothing more: the
// distinct files referenced by the user's `photo_edits` and `shares` rows. AI
// job frames are NOT counted (storageQuota.ts says why, and since ADR-101 they
// expire on their own). Counting them here would change what the quota
// refuses the moment the quota switches to this number, and the narrow step
// must change nothing a user sees.
//
// HOW IT STAYS EXACT. Every path that makes a row point at a file, or stop
// pointing at one, settles the counter in the same mutation, AFTER its writes:
//   • a file the user did not reference before        → +size
//   • a file the user no longer references from any row → −size
//   • anything else (a same-file save, a second row on a file) → 0
// "References" is asked of the `by_storageId` indexes (ADR-089), not assumed,
// so two of the user's rows on one file count it once, as the recount does.
//
// A MISSING COUNTER ROW is created by the first write that moves it, with an
// exact recount of that user taken after the write — so it already includes
// the write and no delta is added on top. That is what makes the counter safe
// to ship before the backfill: an account that predates it is counted the
// first time it changes, and `backfillStoredBytes` counts the rest.
//
// THE STEPS. Widen (this file): the counter exists and is kept up to date; the
// quota still reads `storedBytes()`. Migrate: `backfillStoredBytes`, below,
// run by a person. Narrow (a later change, after the backfill): the quota
// reads the counter, and a check compares the two.

/** Rows read per file when asking who references it. One file has one or two
 *  rows in practice; the answer only needs to tell 0, 1 and "more than 1". */
const REFS_PER_FILE = 16;

/** How many of `userId`'s edit and share rows point at `id`. */
async function referencesBy(ctx: MutationCtx, userId: Id<"users">, id: Id<"_storage">): Promise<number> {
  const edits = await ctx.db.query("photo_edits").withIndex("by_storageId", (q) => q.eq("storageId", id)).take(REFS_PER_FILE);
  const shares = await ctx.db.query("shares").withIndex("by_storageId", (q) => q.eq("storageId", id)).take(REFS_PER_FILE);
  return edits.filter((e) => e.userId === userId).length + shares.filter((s) => s.userId === userId).length;
}

/** The size of a file, or 0 if it is not in storage. Read it BEFORE deleting. */
export async function fileSize(ctx: QueryCtx | MutationCtx, id: Id<"_storage">): Promise<number> {
  return (await ctx.db.system.get("_storage", id))?.size ?? 0;
}

/**
 * The counter's change for one file after a write: call with the write done.
 * `added`: the row now points at `id` (+size if it is the user's only row on
 * it). `removed`: the row no longer points at `id` (−size if no row of the
 * user still does); pass the size read before the file was deleted.
 */
export async function referenceDelta(
  ctx: MutationCtx,
  userId: Id<"users">,
  change: { added: Id<"_storage"> } | { removed: Id<"_storage">; size: number },
): Promise<number> {
  if ("added" in change) {
    return (await referencesBy(ctx, userId, change.added)) === 1 ? await fileSize(ctx, change.added) : 0;
  }
  return (await referencesBy(ctx, userId, change.removed)) === 0 ? -change.size : 0;
}

/** Exact, uncapped: the bytes of the distinct files the user's edit and share
 *  rows reference. One transaction, so an account with many thousands of files
 *  would need this paginated; none is anywhere near that. */
export async function recountStoredBytes(ctx: QueryCtx | MutationCtx, userId: Id<"users">): Promise<number> {
  // `.collect()` on purpose: the point of this function is that it has no
  // row cap (storedBytes' 2,000-row window is the bug being fixed).
  const edits = await ctx.db.query("photo_edits").withIndex("by_userId_photoKey", (q) => q.eq("userId", userId)).collect();
  const shares = await ctx.db.query("shares").withIndex("by_userId", (q) => q.eq("userId", userId)).collect();
  const ids = new Set<Id<"_storage">>([...edits.map((e) => e.storageId), ...shares.map((s) => s.storageId)]);
  let total = 0;
  for (const id of ids) total += await fileSize(ctx, id);
  return total;
}

/**
 * Settle the counter for one write step, AFTER the step's writes, with the
 * sum of its `referenceDelta`s. Call once per step: a missing row is created
 * from a recount that already includes the step, so a second call in the same
 * step would count it twice.
 */
export async function settleStoredBytes(ctx: MutationCtx, userId: Id<"users">, delta: number): Promise<void> {
  const row = await ctx.db
    .query("storage_usage")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .unique();
  const now = Date.now();
  if (row) {
    if (delta !== 0) await ctx.db.patch(row._id, { bytes: row.bytes + delta, updatedAt: now });
    return;
  }
  if (delta === 0) return; // nothing moved; the first real change will count it
  await ctx.db.insert("storage_usage", { userId, bytes: await recountStoredBytes(ctx, userId), updatedAt: now });
}

/** The counter as stored, or null for an account it has not counted yet. */
export async function counterBytes(ctx: MutationCtx, userId: Id<"users">): Promise<number | null> {
  const row = await ctx.db
    .query("storage_usage")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .unique();
  return row ? row.bytes : null;
}

// ── Migrate: the backfill ─────────────────────────────────────────────────────
//
// ⚠️ DRY RUN UNLESS TOLD OTHERWISE. It writes only the counter table (never a
// user's row, never a file), but it is still run by a person, attended, on dev
// first and then prod:
//
//   pnpm exec convex run storageUsage:backfillStoredBytes '{}'                # report
//   pnpm exec convex run storageUsage:backfillStoredBytes '{"apply": true}'   # write
//
// Each run takes one page of users. When `isDone` is false, run it again with
// `"cursor": "<continueCursor>"` until it is. A rerun after the backfill is the
// check: every user should come back with `counter === recount`.

const DEFAULT_USERS_PER_RUN = 50;
/** Mismatches itemized in the result (the count always covers all of them). */
const LIST_CAP = 200;

export const backfillStoredBytes = internalMutation({
  args: {
    apply: v.optional(v.boolean()),
    cursor: v.optional(v.union(v.string(), v.null())),
    usersPerRun: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const apply = args.apply === true;
    const numItems = Math.max(1, Math.floor(args.usersPerRun ?? DEFAULT_USERS_PER_RUN));
    const page = await ctx.db.query("users").paginate({ numItems, cursor: args.cursor ?? null });

    const mismatches: { userId: Id<"users">; counter: number | null; recount: number }[] = [];
    let mismatchCount = 0;
    let written = 0;
    let bytes = 0;
    const now = Date.now();
    for (const user of page.page) {
      const recount = await recountStoredBytes(ctx, user._id);
      bytes += recount;
      const row = await ctx.db
        .query("storage_usage")
        .withIndex("by_userId", (q) => q.eq("userId", user._id))
        .unique();
      if (row?.bytes === recount) continue;
      mismatchCount += 1;
      if (mismatches.length < LIST_CAP) mismatches.push({ userId: user._id, counter: row?.bytes ?? null, recount });
      if (!apply) continue;
      if (row) await ctx.db.patch(row._id, { bytes: recount, updatedAt: now });
      else await ctx.db.insert("storage_usage", { userId: user._id, bytes: recount, updatedAt: now });
      written += 1;
    }

    const mode = apply ? "applied" : "dry-run";
    console.log(
      `storageUsage.backfillStoredBytes ${mode}: ${page.page.length} users, ${bytes} bytes, ` +
        `${mismatchCount} differ from the counter, ${written} written${page.isDone ? "" : ", more users remain"}`,
    );
    return {
      mode,
      users: page.page.length,
      bytes,
      mismatches: { count: mismatchCount, list: mismatches },
      written,
      isDone: page.isDone,
      continueCursor: page.continueCursor,
    };
  },
});
