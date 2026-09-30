// .convex/sync.ts
//
// The cross-device half of the sync layer (ADR-061). One row per
// (user, key) in `sync_docs`, holding a canonical JSON blob the client owns
// and this file never interprets.
//
// The client half — cross-TAB propagation, local persistence, and the
// reconcile rule that decides adopt-vs-push — lives in app/src/lib/sync/.
// This module stays deliberately small: it stores a string, stamps a
// revision, refuses a write that was based on a revision the row has since
// moved past, and hands every row for the signed-in user back on one reactive
// query.
//
// WHAT THIS IS NOT. It is not a place to put pixels. `value` is capped at
// MAX_VALUE_BYTES and the key allowlist is closed; a photo, an archive or a
// layer belongs in file storage (photo_edits / ai_jobs), not here.
import { v } from "convex/values";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { getUser } from "./users";

/** Documents the client is allowed to sync. A CLOSED allowlist, checked on
 *  every write: `key` is an open string in the schema so that adding one is
 *  not a migration, which means this list is the only thing standing between
 *  the table and an unbounded per-user key space. Keep it in step with
 *  SYNC_KEYS in app/src/lib/sync/keys.ts — the two are asserted equal by
 *  app/src/lib/sync/keys.test.ts. */
const SYNC_KEYS = ["prefs", "ui", "tools"] as const;

/** Ceiling on one document's serialized size. The three real documents are
 *  200–900 bytes; 64 KiB is ~70× the largest of them, so it bounds abuse
 *  without being a limit any honest caller can reach. Refused with a
 *  `rejected` result, never truncated — a preference that half-saved would be
 *  worse than one that visibly failed. */
const MAX_VALUE_BYTES = 64 * 1024;

/** Upper bound on a document's format number. The real ones are single
 *  digits. Bounded because a format is compared, and a client that wrote a
 *  huge one would lock every real build out of its own row. */
const MAX_FORMAT = 999;

/** A row as the client sees it. `value: null` is a forgotten document. */
export interface SyncRowView {
  value: string | null;
  rev: number;
  updatedAt: number;
  format: number;
}

export type PushRejection = "unknown-key" | "too-large" | "bad-format" | "signed-out";

/**
 * What `push` answers. None of these is thrown, and that is deliberate:
 *
 *  • A CONFLICT is not an error, it is the normal answer to "someone else
 *    wrote first". The client re-reconciles against `current` and either
 *    adopts it or pushes again on top of it.
 *  • A REJECTION is permanent — the same call will fail the same way — and
 *    the client must be able to tell it from a dropped connection so that it
 *    stops retrying. A thrown Error cannot carry that reliably: a production
 *    deployment redacts a thrown message to "Server Error", so the client
 *    could not read which one it was.
 */
export type PushResult =
  | { status: "stored"; rev: number; updatedAt: number }
  | { status: "unchanged"; rev: number; updatedAt: number }
  | { status: "conflict"; current: SyncRowView | null }
  | { status: "rejected"; reason: PushRejection };

export interface PushArgs {
  key: string;
  value: string;
  /** The writing build's format for this document. */
  format: number;
  /** The row revision this value was based on — 0 for "the account has no
   *  row". The write is refused when the row is anywhere else. */
  baseRev: number;
}

/** Argument checks that need no database. Exported for the tests. */
export function checkPush(args: PushArgs): PushRejection | null {
  if (!(SYNC_KEYS as readonly string[]).includes(args.key)) return "unknown-key";
  // `length` is UTF-16 code units, not bytes, so this over-counts for
  // non-ASCII and can only ever reject EARLIER than the stated ceiling — the
  // safe direction for a cap whose job is to bound storage.
  if (args.value.length > MAX_VALUE_BYTES) return "too-large";
  if (!Number.isInteger(args.format) || args.format < 1 || args.format > MAX_FORMAT) {
    return "bad-format";
  }
  return null;
}

/**
 * The compare-and-set, as a pure function (exported for the tests).
 *
 * Order matters:
 *  1. An IDENTICAL value is never a conflict. Both sides already agree, and
 *     rewriting it would bump `rev` and read to every other device as a change
 *     that is not one.
 *  2. A row written by a NEWER format is never overwritten. This build cannot
 *     see the fields that one added, so its write would silently erase them.
 *  3. Otherwise the write lands only if the row is still at the revision the
 *     client based its change on. Convex queues mutations while a device is
 *     offline and replays them on reconnect; without this check a change made
 *     on a laptop yesterday would land on top of everything the phone did
 *     since, because it ARRIVED last.
 */
export function decidePush(
  existing: SyncRowView | null,
  args: Pick<PushArgs, "value" | "format" | "baseRev">,
): { kind: "unchanged" } | { kind: "conflict" } | { kind: "write"; rev: number } {
  if (existing && existing.value === args.value) return { kind: "unchanged" };
  if (existing && existing.format > args.format) return { kind: "conflict" };
  const currentRev = existing?.rev ?? 0;
  if (currentRev !== args.baseRev) return { kind: "conflict" };
  return { kind: "write", rev: currentRev + 1 };
}

function view(row: Doc<"sync_docs">): SyncRowView {
  return { value: row.value, rev: row.rev, updatedAt: row.updatedAt, format: row.format };
}

async function findRow(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  key: string,
): Promise<Doc<"sync_docs"> | null> {
  return await ctx.db
    .query("sync_docs")
    .withIndex("by_userId_key", (q) => q.eq("userId", userId).eq("key", key))
    .unique();
}

/**
 * Every synced document for the signed-in user, plus the legacy settings blob.
 *
 * Returns `null` — not an empty list — when there is no signed-in user or no
 * `users` row yet. The client MUST be able to tell those states apart:
 *   • `undefined` (Convex still loading)  → do nothing
 *   • `null`      (signed out / no row)   → local-only mode
 *   • `{ docs: [] }` (account, no docs)   → nothing to adopt; a device's
 *                                           pending change creates the row
 *
 * `account` is the user's row id. The client keys its local bookkeeping —
 * which revision it last saw, whether it still owes a write — by it, so that a
 * change made while signed in as one person can never be sent into another
 * person's account on a shared browser.
 *
 * `legacySettings` is the pre-ADR-061 `users.settings` blob. Preferences used
 * to live there alone, so an account created before this table exists has its
 * real preferences there and nowhere else. It is returned ONLY while the
 * account has no `prefs` row at all — live or forgotten — so once any device
 * has written `prefs`, or the user has pressed Forget, it cannot come back.
 * It is returned here rather than migrated in a mutation because a query
 * cannot write, and because seeding from the client reuses the same validator
 * the client already applies to a `prefs` blob.
 */
export const pull = query({
  args: {},
  handler: async (ctx) => {
    const user = await getUser(ctx);
    if (!user) return null;

    // One indexed lookup per key rather than a scan: the key set is a closed
    // list of three, so this is bounded by construction.
    const docs: (SyncRowView & { key: string })[] = [];
    for (const key of SYNC_KEYS) {
      const row = await findRow(ctx, user._id, key);
      if (row) docs.push({ key, ...view(row) });
    }
    const hasPrefsRow = docs.some((d) => d.key === "prefs");

    return {
      account: user._id,
      docs,
      legacySettings: hasPrefsRow ? null : (user.settings ?? null),
    };
  },
});

/**
 * Store one document, if nobody else has written it since the revision the
 * client based its change on. See `decidePush` for the rule and `PushResult`
 * for why nothing here throws.
 *
 * An unchanged value is not rewritten, so `rev` and `updatedAt` do not move
 * when two devices agree.
 */
export const push = mutation({
  args: {
    key: v.string(),
    value: v.string(),
    format: v.number(),
    baseRev: v.number(),
  },
  handler: async (ctx, args): Promise<PushResult> => {
    const invalid = checkPush(args);
    if (invalid) return { status: "rejected", reason: invalid };

    const user = await getUser(ctx);
    if (!user) return { status: "rejected", reason: "signed-out" };

    const existing = await findRow(ctx, user._id, args.key);
    const decision = decidePush(existing && view(existing), args);

    if (decision.kind === "unchanged") {
      return { status: "unchanged", rev: existing!.rev, updatedAt: existing!.updatedAt };
    }
    if (decision.kind === "conflict") {
      return { status: "conflict", current: existing && view(existing) };
    }

    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        value: args.value,
        rev: decision.rev,
        updatedAt: now,
        format: args.format,
      });
    } else {
      await ctx.db.insert("sync_docs", {
        userId: user._id,
        key: args.key,
        value: args.value,
        rev: decision.rev,
        updatedAt: now,
        format: args.format,
      });
    }
    return { status: "stored", rev: decision.rev, updatedAt: now };
  },
});

/**
 * Forget every synced document for this user — Settings → General's "Forget
 * the synced copy". Local copies are untouched: this removes the shared copy,
 * it does not reset the device you pressed it on.
 *
 * FORGOTTEN, NOT DELETED. Each document becomes a row with `value: null` and a
 * bumped revision, and a row is written even for a document the account never
 * had. The settings themselves are gone; what remains is the fact that they
 * were removed, and when. That is what lets it STAY forgotten:
 *
 *  • A deleted row reads to every online device as "this account has never
 *    had one", which is exactly the state a device seeds from — so the button
 *    was undone within one reactive tick by whichever devices were open.
 *  • A device that comes back online holding a change it made BEFORE the
 *    forget sees a newer revision it did not write, and the forget's
 *    timestamp beats its change, so it drops the change instead of re-sending
 *    it. A change made AFTER the forget is sent normally — which is the one
 *    thing that should bring the shared copy back.
 *
 * The legacy `users.settings` blob is cleared in the same transaction. It is
 * the same preferences under an older name, and leaving it would make the
 * button's promise false.
 */
export const clear = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await getUser(ctx);
    if (!user) return { forgotten: 0 };

    const now = Date.now();
    let forgotten = 0;
    for (const key of SYNC_KEYS) {
      const row = await findRow(ctx, user._id, key);
      if (!row) {
        // Format 0: a forgotten document has no fields to protect, so any
        // build may write over it.
        await ctx.db.insert("sync_docs", {
          userId: user._id,
          key,
          value: null,
          rev: 1,
          updatedAt: now,
          format: 0,
        });
        continue;
      }
      if (row.value === null) continue; // already forgotten — nothing to bump
      await ctx.db.patch(row._id, { value: null, rev: row.rev + 1, updatedAt: now, format: 0 });
      forgotten += 1;
    }

    if (user.settings !== undefined || user.settingsHash !== undefined) {
      await ctx.db.patch(user._id, { settings: undefined, settingsHash: undefined });
    }
    return { forgotten };
  },
});
