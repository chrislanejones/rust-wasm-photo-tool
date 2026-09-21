// .convex/sync.ts
//
// The cross-device half of the sync layer (ADR-061). One row per
// (user, key) in `sync_docs`, holding a canonical JSON blob the client owns
// and this file never interprets.
//
// The client half — cross-TAB propagation, local persistence, and the
// reconcile rule that decides adopt-vs-push — lives in app/src/lib/sync/.
// This module is deliberately dumb: it stores a string, stamps a revision,
// and hands every row for the signed-in user back on one reactive query.
//
// WHAT THIS IS NOT. It is not a place to put pixels. `value` is capped at
// MAX_VALUE_BYTES and the key allowlist is closed; a photo, an archive or a
// layer belongs in file storage (photo_edits / ai_jobs), not here.
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getUser, requireUser } from "./users";

/** Documents the client is allowed to sync. A CLOSED allowlist, checked on
 *  every write: `key` is an open string in the schema so that adding one is
 *  not a migration, which means this list is the only thing standing between
 *  the table and an unbounded per-user key space. Keep it in step with
 *  SYNC_KEYS in app/src/lib/sync/keys.ts — the two are asserted equal by
 *  app/src/lib/sync/keys.test.ts. */
const SYNC_KEYS = ["prefs", "ui", "tools"] as const;

/** Ceiling on one document's serialized size. The three real documents are
 *  200–900 bytes; 64 KiB is ~70× the largest of them, so it bounds abuse
 *  without being a limit any honest caller can reach. Rejected LOUDLY (a
 *  throw, not a silent truncate) — a preference that half-saved would be
 *  worse than one that visibly failed. */
const MAX_VALUE_BYTES = 64 * 1024;

function assertKey(key: string): void {
  if (!(SYNC_KEYS as readonly string[]).includes(key)) {
    throw new Error(`Unknown sync key: ${key}`);
  }
}

/**
 * Every synced document for the signed-in user, plus the legacy settings blob.
 *
 * Returns `null` — not an empty list — when there is no signed-in user or no
 * `users` row yet. The client MUST be able to tell those three states apart:
 *   • `undefined` (Convex still loading)  → do nothing
 *   • `null`      (signed out / no row)   → local-only mode
 *   • `{ docs: [] }` (account, no docs)   → SEED the account from this device
 * Collapsing the last two would make a fresh account's first device either
 * never seed or seed while logged out.
 *
 * `legacySettings` is the pre-ADR-061 `users.settings` blob. Preferences used
 * to live there alone, so an account created before this table exists has its
 * real preferences there and nowhere else. The client seeds the `prefs`
 * document from it exactly once — when the account has no `prefs` row — and
 * then ignores it forever. It is returned here rather than migrated in a
 * mutation because a query cannot write, and because seeding from the client
 * reuses the same validator the client already applies to a `prefs` blob.
 */
export const pull = query({
  args: {},
  handler: async (ctx) => {
    const user = await getUser(ctx);
    if (!user) return null;

    const rows = await ctx.db
      .query("sync_docs")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect();

    return {
      docs: rows.map((r) => ({
        key: r.key,
        value: r.value,
        rev: r.rev,
        updatedAt: r.updatedAt,
        origin: r.origin,
      })),
      legacySettings: user.settings ?? null,
    };
  },
});

/**
 * Store one document. Last write wins, by ARRIVAL at the server.
 *
 * There is no compare-and-set here, and that is deliberate. The client only
 * pushes a document it has locally DIRTIED — a change the user actually made
 * in that tab which has never reached the server — and it drops that dirty
 * flag the moment it adopts a remote value. So the losing side of a race is
 * always a change the user made earlier on another device, which is exactly
 * what "last write wins" should discard. Adding a rev check here would turn
 * that into a visible error for the user to resolve, for preference blobs
 * where there is nothing to resolve.
 *
 * The returned `rev` is what the caller records as "what I last saw from the
 * server"; an unchanged value is not rewritten, so `updatedAt` does not move
 * when two devices agree.
 */
export const push = mutation({
  args: {
    key: v.string(),
    value: v.string(),
    /** The writing DEVICE's id (not the tab's) — see the schema comment. */
    origin: v.string(),
  },
  handler: async (ctx, { key, value, origin }) => {
    assertKey(key);
    // `length` is UTF-16 code units, not bytes, so this over-counts for
    // non-ASCII and can only ever reject EARLIER than the stated ceiling —
    // the safe direction for a cap whose job is to bound storage.
    if (value.length > MAX_VALUE_BYTES) {
      throw new Error(`Sync document "${key}" is too large (${value.length} > ${MAX_VALUE_BYTES})`);
    }

    const user = await requireUser(ctx);
    const existing = await ctx.db
      .query("sync_docs")
      .withIndex("by_userId_key", (q) => q.eq("userId", user._id).eq("key", key))
      .unique();

    const now = Date.now();

    if (!existing) {
      await ctx.db.insert("sync_docs", {
        userId: user._id,
        key,
        value,
        rev: 1,
        updatedAt: now,
        origin,
      });
      return { rev: 1, updatedAt: now, stored: true };
    }

    // Identical value → no write at all. Without this, a device that adopts a
    // document and then re-serializes it would bump `rev` on every reconnect,
    // and every OTHER device would see a change that isn't one.
    if (existing.value === value) {
      return { rev: existing.rev, updatedAt: existing.updatedAt, stored: false };
    }

    const rev = existing.rev + 1;
    await ctx.db.patch(existing._id, { value, rev, updatedAt: now, origin });
    return { rev, updatedAt: now, stored: true };
  },
});

/**
 * Forget every synced document for this user — Settings → General's "Stop
 * syncing and forget" . Local copies are untouched: this removes the shared
 * copy, it does not reset the device you pressed it on. The next local change
 * on any signed-in device seeds the account again, which is the same path a
 * brand-new account takes.
 */
export const clear = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const rows = await ctx.db
      .query("sync_docs")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect();
    for (const row of rows) await ctx.db.delete(row._id);
    return { removed: rows.length };
  },
});
