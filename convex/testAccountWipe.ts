// The test-account wipe, Convex half. INTERNAL ONLY — neither function is part
// of the public API; both are reached with
//   pnpm exec convex run --deployment <name> testAccountWipe:plan '{...}'
// from scripts/wipe-test-account.mjs (`pnpm wipe:test-account`).
//
// Which account, which rows and in what order are decided in testAccount.ts
// (pure, tested). This file only reads rows scoped to that one account and
// deletes each one through the table's delete helper, which removes the row's
// files and the row in the same transaction.
import { v } from "convex/values";
import { internalMutation, internalQuery, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import {
  FILE_FIELDS,
  KEPT_TABLES,
  TEST_ACCOUNT_EMAIL,
  WIPE_ORDER,
  fileIdsOf,
  resolveTestAccount,
  summarizePlan,
  wipeBatch,
  type AnyRow,
  type DeletedFiles,
  type FileTable,
  type KeptTable,
  type WipeMode,
  type WipeStore,
  type WipeTable,
} from "./testAccount";
import { deletePhotoEditRecord } from "./photoEdits";
import { deleteShareRecord } from "./shares";
import { deleteStoredFiles } from "./storedFiles";

/** Per-table read ceiling for the dry run. Hitting it marks the plan
 *  truncated, and the script refuses to apply a truncated plan. */
const PLAN_LIMIT = 1000;
/** Ceiling for the "does anyone ELSE reference this file" scan. */
const SCAN_LIMIT = 5000;
/** Largest batch one mutation may be asked for. */
const MAX_BATCH = 50;

async function resolve(ctx: QueryCtx, email: string, mode: WipeMode) {
  // `take(10)`, not `unique()`: more than one row is an answer the resolver
  // must see and refuse with a reason, not an exception.
  const users = await ctx.db
    .query("users")
    .withIndex("by_email", (q) => q.eq("email", email))
    .take(10);
  return resolveTestAccount(email, users, mode);
}

// ── Rows owned by one account ─────────────────────────────────────────────────

async function ownedParents(ctx: QueryCtx, userId: Id<"users">, table: FileTable | "projects", limit: number) {
  switch (table) {
    case "photo_edits":
      return await ctx.db
        .query("photo_edits")
        .withIndex("by_userId_photoKey", (q) => q.eq("userId", userId))
        .take(limit);
    case "shares":
      return await ctx.db.query("shares").withIndex("by_userId", (q) => q.eq("userId", userId)).take(limit);
    case "ai_jobs":
      return await ctx.db.query("ai_jobs").withIndex("by_userId", (q) => q.eq("userId", userId)).take(limit);
    case "images":
      return await ctx.db.query("images").withIndex("by_userId", (q) => q.eq("userId", userId)).take(limit);
    case "projects":
      return await ctx.db.query("projects").withIndex("by_userId", (q) => q.eq("userId", userId)).take(limit);
  }
}

/** Up to `limit` rows of `table` that belong to `userId`. Child tables are
 *  reached through their parent, which is why WIPE_ORDER drains them first. */
async function listOwned(ctx: QueryCtx, userId: Id<"users">, table: WipeTable, limit: number): Promise<AnyRow[]> {
  if (limit < 1) return [];
  switch (table) {
    case "share_views": {
      const out: AnyRow[] = [];
      for (const share of await ownedParents(ctx, userId, "shares", PLAN_LIMIT)) {
        const views = await ctx.db
          .query("share_views")
          .withIndex("by_shareId", (q) => q.eq("shareId", share._id as Id<"shares">))
          .take(limit - out.length);
        out.push(...views);
        if (out.length >= limit) break;
      }
      return out;
    }
    case "annotations":
    case "layers":
    case "history": {
      const out: AnyRow[] = [];
      for (const image of await ownedParents(ctx, userId, "images", PLAN_LIMIT)) {
        const imageId = image._id as Id<"images">;
        const rows =
          table === "annotations"
            ? await ctx.db.query("annotations").withIndex("by_imageId", (q) => q.eq("imageId", imageId)).take(limit - out.length)
            : table === "layers"
              ? await ctx.db.query("layers").withIndex("by_imageId", (q) => q.eq("imageId", imageId)).take(limit - out.length)
              : await ctx.db.query("history").withIndex("by_imageId", (q) => q.eq("imageId", imageId)).take(limit - out.length);
        out.push(...rows);
        if (out.length >= limit) break;
      }
      return out;
    }
    default:
      return await ownedParents(ctx, userId, table, limit);
  }
}

/** Every storage id referenced by a row that belongs to ANOTHER account. The
 *  wipe refuses when any of the test account's files is in here: deleting it
 *  would break someone else's row. */
async function otherAccountsFileIds(ctx: QueryCtx, userId: Id<"users">) {
  const ids = new Set<string>();
  let truncated = false;
  for (const table of Object.keys(FILE_FIELDS) as FileTable[]) {
    const rows = await ctx.db.query(table).take(SCAN_LIMIT);
    if (rows.length === SCAN_LIMIT) truncated = true;
    for (const row of rows) {
      if (row.userId === userId) continue;
      for (const id of fileIdsOf(table, row)) ids.add(id);
    }
  }
  return { ids, truncated };
}

async function keptCounts(ctx: QueryCtx, userId: Id<"users">): Promise<Record<KeptTable, number>> {
  const counts = {} as Record<KeptTable, number>;
  for (const table of KEPT_TABLES) {
    switch (table) {
      case "users":
        counts.users = 1;
        break;
      case "sync_docs":
        counts.sync_docs = (
          await ctx.db.query("sync_docs").withIndex("by_userId_key", (q) => q.eq("userId", userId)).take(PLAN_LIMIT)
        ).length;
        break;
      case "subscriptions":
        counts.subscriptions = (
          await ctx.db.query("subscriptions").withIndex("by_userId", (q) => q.eq("userId", userId)).take(PLAN_LIMIT)
        ).length;
        break;
      case "recent_texts":
        counts.recent_texts = (
          await ctx.db.query("recent_texts").withIndex("by_userId", (q) => q.eq("userId", userId)).take(PLAN_LIMIT)
        ).length;
        break;
      case "user_colors":
        counts.user_colors = (
          await ctx.db.query("user_colors").withIndex("by_userId", (q) => q.eq("userId", userId)).take(PLAN_LIMIT)
        ).length;
        break;
    }
  }
  return counts;
}

// ── Record deleters for the tables with no app delete path of their own ───────

/** An AI job's input, mask and output frames, then the row. The app never
 *  deletes AI jobs, so this is the only path that does. */
async function deleteAiJobRecord(ctx: MutationCtx, job: Doc<"ai_jobs">): Promise<DeletedFiles> {
  const freed = await deleteStoredFiles(ctx, [job.inputStorageId, job.maskStorageId, job.outputStorageId]);
  await ctx.db.delete(job._id);
  return freed;
}

/** An image's file (when it has one), then the row. `images.remove` deletes
 *  the row only and is NOT changed here — see PARKING_LOT. Its layers,
 *  annotations and history are already gone by WIPE_ORDER. */
async function deleteImageRecord(ctx: MutationCtx, image: Doc<"images">): Promise<DeletedFiles> {
  const freed = await deleteStoredFiles(ctx, [image.storageId]);
  await ctx.db.delete(image._id);
  return freed;
}

const NO_FILES: DeletedFiles = { files: 0, bytes: 0 };

function convexWipeStore(ctx: MutationCtx, userId: Id<"users">): WipeStore {
  return {
    listOwned: (table, limit) => listOwned(ctx, userId, table, limit),
    async deleteRecord(table, row) {
      switch (table) {
        case "photo_edits":
          return await deletePhotoEditRecord(ctx, row as unknown as Doc<"photo_edits">);
        case "shares":
          return await deleteShareRecord(ctx, row as unknown as Doc<"shares">);
        case "ai_jobs":
          return await deleteAiJobRecord(ctx, row as unknown as Doc<"ai_jobs">);
        case "images":
          return await deleteImageRecord(ctx, row as unknown as Doc<"images">);
        case "share_views":
        case "annotations":
        case "layers":
        case "history":
        case "projects":
          // No file fields (FILE_FIELDS is the whole list), so the row is all
          // there is to delete.
          await ctx.db.delete(row._id as Id<typeof table>);
          return NO_FILES;
      }
    },
  };
}

// ── The two entry points ──────────────────────────────────────────────────────

/** Dry run. Reads only. Per-table counts, file count and bytes. */
export const plan = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const who = await resolve(ctx, args.email, "plan");
    if (!who.ok) return { ok: false as const, reason: who.reason, matched: who.matched };
    const userId = who.userId as Id<"users">;

    const rowsByTable = {} as Record<WipeTable, AnyRow[]>;
    let truncated = false;
    for (const table of WIPE_ORDER) {
      rowsByTable[table] = await listOwned(ctx, userId, table, PLAN_LIMIT);
      if (rowsByTable[table].length === PLAN_LIMIT) truncated = true;
    }
    const sizes = new Map<string, number | null>();
    for (const table of WIPE_ORDER) {
      for (const row of rowsByTable[table]) {
        for (const id of fileIdsOf(table, row)) {
          if (sizes.has(id)) continue;
          const meta = await ctx.db.system.get("_storage", id as Id<"_storage">);
          sizes.set(id, meta ? meta.size : null);
        }
      }
    }
    const others = await otherAccountsFileIds(ctx, userId);
    const summary = summarizePlan(rowsByTable, (id) => sizes.get(id) ?? null, others.ids);
    return {
      ok: true as const,
      email: TEST_ACCOUNT_EMAIL,
      userId: who.userId,
      clerkId: who.clerkId,
      clerkIdPinned: who.clerkIdPinned,
      ...summary,
      kept: await keptCounts(ctx, userId),
      truncated: truncated || others.truncated,
    };
  },
});

/** Delete ONE batch. Re-resolves the account and re-checks cross-account file
 *  references inside its own transaction, so a batch can never act on a
 *  stale plan. The script calls it until `done`. */
export const applyBatch = internalMutation({
  args: { email: v.string(), batchSize: v.number() },
  handler: async (ctx, args) => {
    if (!Number.isInteger(args.batchSize) || args.batchSize < 1 || args.batchSize > MAX_BATCH) {
      throw new Error(`batchSize must be an integer in 1..${MAX_BATCH}`);
    }
    const who = await resolve(ctx, args.email, "apply");
    if (!who.ok) throw new Error(who.reason);
    const userId = who.userId as Id<"users">;

    const others = await otherAccountsFileIds(ctx, userId);
    if (others.truncated) throw new Error("refused: cross-account file scan was truncated");
    for (const table of Object.keys(FILE_FIELDS) as FileTable[]) {
      for (const row of await listOwned(ctx, userId, table, PLAN_LIMIT)) {
        for (const id of fileIdsOf(table, row)) {
          if (others.ids.has(id)) {
            throw new Error(`refused: ${table} ${row._id} file ${id} is also referenced by another account`);
          }
        }
      }
    }

    return await wipeBatch(convexWipeStore(ctx, userId), args.batchSize);
  },
});
