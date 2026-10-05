import { ConvexError } from "convex/values";
import type { MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { entitlementOf, formatBytes, STORAGE_QUOTA_BYTES, storageQuotaVerdict } from "./entitlement";
import { roleOf } from "./users";

// ── Enforcing the advertised cloud storage quota ─────────────────────────────
//
// WHERE THE CHECK CAN BE EXACT. An upload URL is handed out BEFORE the browser
// has sent a byte, so at `generateUploadUrl` the size of the coming file is
// unknown and any check there is a guess. The size IS known once the file has
// landed: `_storage` records it, and the mutation that writes the pointer
// (`photoEdits.save`, `shares.create`) can read it inside the same transaction
// that commits the pointer. That is where the quota is enforced, exactly.
//
// The upload-URL mutations also make a cheap, coarse check — refuse an account
// that is ALREADY over its cap — so a full account does not upload 30 MB just
// to be told no. It is `>` not `>=`: an account exactly at its cap may still
// replace an edit with one the same size or smaller.
//
// A REFUSED UPLOAD LEAVES ITS FILE BEHIND. The refusal throws, and a throw
// rolls back the whole mutation, a storage delete included — so the refused
// file cannot be deleted here. The edit path's `discardFailedUpload` collects
// it (its storage id is known by then), and `storageSweep` catches anything
// else. Throwing is still right: the caller must see the refusal.
//
// WHAT COUNTS. Files the account can delete from inside the app: its photo
// edit archives and its share-link snapshots. NOT its AI job frames — nothing
// in the app deletes those, so counting them would fill an account with bytes
// its owner has no way to free. Orphans count for nobody: a file no row points
// at has no owner on record.

/** Rows read per table when summing. The paid gallery holds 100 photos. */
const SUM_ROW_CAP = 2_000;

/** Bytes this account currently holds in cloud storage. */
export async function storedBytes(ctx: MutationCtx, userId: Id<"users">): Promise<number> {
  const ids = new Set<Id<"_storage">>();
  const edits = await ctx.db
    .query("photo_edits")
    .withIndex("by_userId_photoKey", (q) => q.eq("userId", userId))
    .take(SUM_ROW_CAP);
  for (const e of edits) ids.add(e.storageId);
  const shares = await ctx.db
    .query("shares")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .take(SUM_ROW_CAP);
  for (const s of shares) ids.add(s.storageId);

  let total = 0;
  for (const id of ids) {
    const meta = await ctx.db.system.get(id);
    total += meta?.size ?? 0;
  }
  return total;
}

async function entitlementFor(ctx: MutationCtx, user: Doc<"users">) {
  return entitlementOf(user.tier, await roleOf(ctx, user), true);
}

/**
 * The exact check, at the moment a pointer is committed. Throws a readable
 * `ConvexError` when writing `incoming` would take the account over its cap.
 * `replacing` is the file this write frees in the same transaction, if any.
 */
export async function assertStorageQuota(
  ctx: MutationCtx,
  user: Doc<"users">,
  incoming: Id<"_storage">,
  replacing?: Id<"_storage">,
): Promise<void> {
  const incomingMeta = await ctx.db.system.get(incoming);
  if (!incomingMeta) throw new ConvexError("That upload was not found in storage. Please try again.");
  const replacingMeta = replacing && replacing !== incoming ? await ctx.db.system.get(replacing) : null;

  const refusal = storageQuotaVerdict({
    usedBytes: await storedBytes(ctx, user._id),
    replacingBytes: replacingMeta?.size ?? 0,
    incomingBytes: incomingMeta.size,
    entitlement: await entitlementFor(ctx, user),
  });
  if (refusal) throw new ConvexError(refusal);
}

/** The coarse check, before an upload URL is handed out. Refuses only an
 *  account already OVER its cap, because the incoming size is unknown here. */
export async function assertNotOverQuota(ctx: MutationCtx, user: Doc<"users">): Promise<void> {
  const entitlement = await entitlementFor(ctx, user);
  const used = await storedBytes(ctx, user._id);
  const cap = STORAGE_QUOTA_BYTES[entitlement];
  if (used > cap) {
    throw new ConvexError(
      `Your cloud storage is full: ${formatBytes(used)} used of ${formatBytes(cap)}. ` +
        `Delete a cloud edit or a share link to make room. Your work is still saved in this browser.`,
    );
  }
}
