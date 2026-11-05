import { ConvexError, v } from "convex/values";
import { internalMutation, mutation, query, type MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { getUser, requireUser, roleOf } from "./users";
import { entitlementOf, formatBytes, STORAGE_QUOTA_BYTES } from "./entitlement";
import { assertNotOverQuota, storedBytes } from "./storageQuota";
import { deleteStoredFiles, isStoredFileReferenced } from "./storedFiles";
import { fileSize, referenceDelta, settleStoredBytes } from "./storageUsage";
import type { DeletedFiles } from "./testAccount";

// ── Transfer: phone → the editor's inbox, for 7 days (ADR-102) ────────────────
//
// THE FLOW. A signed-in phone asks `generateUploadUrl`, uploads each photo AS
// IS (the phone has no engine, ADR from #288), then calls `create` with the
// storage id. The computer's Inbox reads `listMine` live. "Add to gallery"
// downloads the file, runs it through the normal import, and only then calls
// `receive`, which removes the row and its file. "Delete" is `remove`.
//
// ONE DIRECTION in v1: phone → computer. Computer → phone, the Android share
// target and gallery-photo trash are v2 (ADR-102).
//
// THE SERVER DECIDES SIZE AND TYPE. `create` reads `_storage` for the file's
// real size and recorded content type; the client sends neither (`resolveMime`
// says what happens when the recorded type is missing). A refusal in
// `create` RETURNS rather than throws, so the refused file is deleted in the
// same transaction (a throw would roll the delete back and leave an orphan for
// the sweep, which is what storageQuota.ts describes for the other paths).
//
// OWNER ONLY. Every function takes the user from auth, never from an argument,
// and a row is only ever handed back to, or changed by, the user who sent it.
//
// QUOTA. A waiting photo counts against cloud storage through the same sum the
// quota reads (storageQuota.storedBytes) and the counter (storageUsage.ts),
// moved by `create` and by whatever removes the row. Over quota is refused with
// how much is left. Nothing here ever deletes to make room.

const DAY_MS = 86_400_000;
const MiB = 1024 * 1024;

/** How long a photo waits in the inbox. */
export const TRANSFER_DAYS = 7;
/** Largest single file. A phone's HEIC is 2–5 MB, a ProRAW-sized JPEG ~30. */
export const TRANSFER_MAX_BYTES = 50 * MiB;
/** Most photos waiting in one inbox at once. */
export const TRANSFER_INBOX_LIMIT = 50;
/** Longest stored file name. */
const NAME_MAX = 200;

/** What the inbox accepts: the formats the editor's import knows. HEIC/HEIF go
 *  through the HEIC Beta on the computer; if it is off, the import says so and
 *  the photo stays in the inbox. */
export const TRANSFER_MIME_TYPES: ReadonlySet<string> = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/heic",
  "image/heif",
  "image/heic-sequence",
  "image/heif-sequence",
  "image/gif",
  "image/svg+xml",
]);

/** Is `mime` one the inbox takes? Parameters (`; charset=…`) and case ignored. */
export function isTransferMime(mime: string | undefined | null): boolean {
  if (!mime) return false;
  return TRANSFER_MIME_TYPES.has(normalMime(mime));
}

function normalMime(mime: string): string {
  return mime.split(";")[0]!.trim().toLowerCase();
}

/** The type a name's extension means, for an upload stored without a useful one. */
const MIME_BY_EXTENSION: Readonly<Record<string, string>> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  avif: "image/avif",
  heic: "image/heic",
  heif: "image/heif",
  gif: "image/gif",
  svg: "image/svg+xml",
};

/**
 * The file's type, or null when it is not one the inbox takes.
 *
 * FIRST the content type `_storage` recorded at upload. That is the uploading
 * browser's `Content-Type`, the best the server has without reading the bytes
 * (a mutation cannot), and the computer's import decodes the file anyway.
 * ONLY when it is absent or generic (`application/octet-stream`, which some
 * Android browsers send for HEIC) does the name's extension decide. A specific
 * type that is not an image is refused, whatever the name says.
 */
export function resolveMime(contentType: string | undefined, name: string): string | null {
  const recorded = contentType ? normalMime(contentType) : "";
  if (recorded && recorded !== "application/octet-stream") {
    return TRANSFER_MIME_TYPES.has(recorded) ? recorded : null;
  }
  const ext = /\.([a-z0-9]+)$/i.exec(name.trim())?.[1]?.toLowerCase() ?? "";
  return MIME_BY_EXTENSION[ext] ?? null;
}

/** The file name as stored: trimmed, no path, at most NAME_MAX characters. */
export function cleanName(raw: string): string {
  const base = raw.split(/[\\/]/).pop()!.trim();
  return (base || "Photo").slice(0, NAME_MAX);
}

/** The Inbox's "from" label. The client derives it from its user agent; the
 *  server keeps only one of a few known labels, so a row never stores whatever
 *  a client chose to send. */
export const DEVICE_LABELS = ["iPhone", "iPad", "Android phone", "Android tablet", "Phone"] as const;
export type DeviceLabel = (typeof DEVICE_LABELS)[number];
export function cleanDevice(raw: string | undefined): DeviceLabel {
  return (DEVICE_LABELS as readonly string[]).includes(raw ?? "") ? (raw as DeviceLabel) : "Phone";
}

/** Why `create` refused a file. The phone shows `message` beside the file. */
export type TransferRefusal =
  | { ok: false; reason: "missing"; message: string }
  | { ok: false; reason: "too-big"; message: string }
  | { ok: false; reason: "not-an-image"; message: string }
  | { ok: false; reason: "inbox-full"; message: string }
  | { ok: false; reason: "storage-full"; message: string; bytesLeft: number };

export type TransferCreated = { ok: true; id: Id<"transfers">; bytes: number; expiresAt: number };

async function waitingCount(ctx: MutationCtx, userId: Id<"users">): Promise<number> {
  const rows = await ctx.db
    .query("transfers")
    .withIndex("by_userId_createdAt", (q) => q.eq("userId", userId))
    .take(TRANSFER_INBOX_LIMIT);
  return rows.length;
}

const INBOX_FULL_MESSAGE =
  `Your inbox already has ${TRANSFER_INBOX_LIMIT} photos waiting. ` +
  `Add or delete some on your computer, then send again.`;

/** Upload URL for one photo. Refuses a signed-out caller, a full inbox, and an
 *  account already over its quota (the exact check is in `create`, once the
 *  file's size is known). The online switch is per device and lives in the
 *  browser; the phone checks it before it ever asks for this. */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    if ((await waitingCount(ctx, user._id)) >= TRANSFER_INBOX_LIMIT) throw new ConvexError(INBOX_FULL_MESSAGE);
    await assertNotOverQuota(ctx, user);
    return await ctx.storage.generateUploadUrl();
  },
});

/** Put an uploaded photo in the caller's inbox. The size and type come from
 *  `_storage`. A refused file is deleted here, in this transaction. */
export const create = mutation({
  args: {
    storageId: v.id("_storage"),
    name: v.string(),
    fromDevice: v.optional(v.string()),
    width: v.optional(v.number()),
    height: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<TransferCreated | TransferRefusal> => {
    const user = await requireUser(ctx);
    const meta = await ctx.db.system.get("_storage", args.storageId);
    if (!meta) {
      return { ok: false, reason: "missing", message: "That upload did not arrive. Please try again." };
    }
    // A fresh upload is referenced by nothing. A file some row already points
    // at is not this upload: refuse, and do NOT delete it, since it belongs to
    // that row (possibly another account's).
    if (await isStoredFileReferenced(ctx, args.storageId)) {
      throw new ConvexError("That file is already in use.");
    }

    const refuse = async (r: TransferRefusal): Promise<TransferRefusal> => {
      await ctx.storage.delete(args.storageId);
      return r;
    };
    if (meta.size > TRANSFER_MAX_BYTES) {
      return refuse({
        ok: false,
        reason: "too-big",
        message: `Too big: ${formatBytes(meta.size)}. The limit is ${formatBytes(TRANSFER_MAX_BYTES)} a photo.`,
      });
    }
    const name = cleanName(args.name);
    const mime = resolveMime(meta.contentType, name);
    if (mime === null) {
      return refuse({ ok: false, reason: "not-an-image", message: "That file is not a photo the editor can open." });
    }
    if ((await waitingCount(ctx, user._id)) >= TRANSFER_INBOX_LIMIT) {
      return refuse({ ok: false, reason: "inbox-full", message: INBOX_FULL_MESSAGE });
    }
    const entitlement = entitlementOf(user.tier, await roleOf(ctx, user), true);
    const cap = STORAGE_QUOTA_BYTES[entitlement];
    const used = await storedBytes(ctx, user._id);
    if (used + meta.size > cap) {
      const bytesLeft = Math.max(0, cap - used);
      return refuse({
        ok: false,
        reason: "storage-full",
        bytesLeft,
        message: `Storage full: ${formatBytes(bytesLeft)} left, and this photo is ${formatBytes(meta.size)}.`,
      });
    }

    const now = Date.now();
    const expiresAt = now + TRANSFER_DAYS * DAY_MS;
    const id = await ctx.db.insert("transfers", {
      userId: user._id,
      storageId: args.storageId,
      name,
      mime,
      bytes: meta.size,
      width: positiveInt(args.width),
      height: positiveInt(args.height),
      fromDevice: cleanDevice(args.fromDevice),
      createdAt: now,
      expiresAt,
    });
    await settleStoredBytes(ctx, user._id, await referenceDelta(ctx, user._id, { added: args.storageId }));
    return { ok: true, id, bytes: meta.size, expiresAt };
  },
});

function positiveInt(n: number | undefined): number | undefined {
  return n !== undefined && Number.isInteger(n) && n > 0 ? n : undefined;
}

/** One waiting photo, as the Inbox draws it. */
export interface InboxItem {
  id: Id<"transfers">;
  name: string;
  mime: string;
  bytes: number;
  width: number | null;
  height: number | null;
  fromDevice: string;
  createdAt: number;
  expiresAt: number;
  /** Signed URL of the file as sent, or null if it is already gone. */
  url: string | null;
}

/** The caller's inbox, newest first. `null` when signed out. */
export const listMine = query({
  args: {},
  handler: async (ctx): Promise<{ items: InboxItem[]; limit: number } | null> => {
    const user = await getUser(ctx);
    if (!user) return null;
    const rows = await ctx.db
      .query("transfers")
      .withIndex("by_userId_createdAt", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(TRANSFER_INBOX_LIMIT);
    const items: InboxItem[] = [];
    for (const t of rows) {
      items.push({
        id: t._id,
        name: t.name,
        mime: t.mime,
        bytes: t.bytes,
        width: t.width ?? null,
        height: t.height ?? null,
        fromDevice: t.fromDevice,
        createdAt: t.createdAt,
        expiresAt: t.expiresAt,
        url: await ctx.storage.getUrl(t.storageId),
      });
    }
    return { items, limit: TRANSFER_INBOX_LIMIT };
  },
});

/** Delete one transfer: the row, then its file if nothing else points at it,
 *  then the counter. THE delete path for `transfers` — `receive`, `remove`,
 *  `expire` and the test-account wipe all call this. No ownership check:
 *  callers decide whose row it is before they get here. */
export async function deleteTransferRecord(ctx: MutationCtx, row: Doc<"transfers">): Promise<DeletedFiles> {
  const size = await fileSize(ctx, row.storageId);
  await ctx.db.delete(row._id);
  const freed: DeletedFiles = (await isStoredFileReferenced(ctx, row.storageId))
    ? { files: 0, bytes: 0 }
    : await deleteStoredFiles(ctx, [row.storageId]);
  await settleStoredBytes(ctx, row.userId, await referenceDelta(ctx, row.userId, { removed: row.storageId, size }));
  return freed;
}

/** The caller's transfer, or null if it is already gone. Throws for someone
 *  else's, so a wrong id is never silently "done". */
async function ownedTransfer(ctx: MutationCtx, id: Id<"transfers">): Promise<Doc<"transfers"> | null> {
  const user = await requireUser(ctx);
  const row = await ctx.db.get(id);
  if (!row) return null;
  if (row.userId !== user._id) throw new ConvexError("Not your transfer");
  return row;
}

/** The computer has imported this photo: it leaves the inbox. Called only
 *  AFTER the import succeeded. A second call (another tab, a retry) finds
 *  nothing and is harmless. */
export const receive = mutation({
  args: { id: v.id("transfers") },
  handler: async (ctx, args) => {
    const row = await ownedTransfer(ctx, args.id);
    if (!row) return { removed: false };
    await deleteTransferRecord(ctx, row);
    return { removed: true };
  },
});

/** Delete a waiting photo without importing it. */
export const remove = mutation({
  args: { id: v.id("transfers") },
  handler: async (ctx, args) => {
    const row = await ownedTransfer(ctx, args.id);
    if (!row) return { removed: false };
    await deleteTransferRecord(ctx, row);
    return { removed: true };
  },
});

// ── Expiry ────────────────────────────────────────────────────────────────────
//
// ⚠️ DRY RUN UNLESS TOLD OTHERWISE (ADR-101's rule). Removes photos that have
// waited past `expiresAt`: the row, its file (when nothing else points at it)
// and the counter. Written, with its cron commented out in crons.ts, until a
// person has read the dry run against the deployment:
//
//   pnpm exec convex run transfers:expire '{}'                # report
//   pnpm exec convex run transfers:expire '{"apply": true}'   # delete

const DEFAULT_MAX_ROWS = 200;
/** Rows itemized in the result (the counts always cover the whole batch). */
const LIST_CAP = 200;

export const expire = internalMutation({
  args: {
    /** Delete. Absent or false = report only, nothing written. */
    apply: v.optional(v.boolean()),
    /** Rows per run. Default 200. */
    maxRows: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const apply = args.apply === true;
    const maxRows = Math.max(1, Math.floor(args.maxRows ?? DEFAULT_MAX_ROWS));
    const now = Date.now();
    const found = await ctx.db
      .query("transfers")
      .withIndex("by_expiresAt", (q) => q.lt("expiresAt", now))
      .take(maxRows + 1);
    const more = found.length > maxRows;
    const batch = found.slice(0, maxRows);

    let bytes = 0;
    let filesDeleted = 0;
    let bytesFreed = 0;
    const list: { id: Id<"transfers">; userId: Id<"users">; name: string; bytes: number; expiresAt: number }[] = [];
    for (const row of batch) {
      bytes += row.bytes;
      if (list.length < LIST_CAP) {
        list.push({ id: row._id, userId: row.userId, name: row.name, bytes: row.bytes, expiresAt: row.expiresAt });
      }
      if (!apply) continue;
      const freed = await deleteTransferRecord(ctx, row);
      filesDeleted += freed.files;
      bytesFreed += freed.bytes;
    }

    const mode = apply ? "applied" : "dry-run";
    console.log(
      `transfers.expire ${mode}: ${batch.length} expired, ${bytes} bytes, ` +
        `${filesDeleted} files deleted${more ? ", more remain" : ""}`,
    );
    return { mode, rows: batch.length, bytes, filesDeleted, bytesFreed, list, more };
  },
});
