import { v } from "convex/values";
import {
  internalMutation,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { getUser, requireUser } from "./users";

// ── Public, read-only share links ──────────────────────────────────────────
// Mirrors the photoEdits storage pattern, but a share stores only the flattened
// canvas PNG (not the re-editable archive) and is fetched by an unguessable
// `token` rather than by (userId, photoKey). The `get`/`recordView` endpoints
// are intentionally public so a recipient who isn't signed in can still view it.
//
// Limits (Settings › Shared). A link can be paused by its owner, and stops on
// its own after `maxViews` views or at `expiresAt`. Every stop is a PAUSE: the
// image is kept and the link is resumable, nothing here deletes on a limit.
// Only the owner's Pause is written to the row (`pausedAt`); the two
// auto-limits are derived on every read by `availability`, so raising a limit
// un-stops a link with no extra write and no cron.

/** Generate a URL-safe, unguessable share token. These tokens ARE the only
 *  access control on the PUBLIC `get` endpoint (it's a capability URL), so they
 *  must be unguessable — `Math.random()` is a non-cryptographic PRNG and must
 *  not gate access. A v4 UUID gives 122 bits of CSPRNG entropy; Convex seeds
 *  `crypto` deterministically per execution, so this is replay-safe. Dashes
 *  stripped → 32 URL-safe hex chars. Existing shorter tokens still resolve via
 *  the `by_token` index. */
function makeToken(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

/** Why a link is not being served. `"views"` is the view cap, `"expired"` the
 *  date, `"paused"` the owner's button. */
export type ShareStop = "paused" | "expired" | "views";
export type ShareStatus = "live" | ShareStop;

/**
 * Is this link being served right now? Pure, and the ONE place the answer is
 * computed — `get`, `recordView` and `listMine` all ask it, so a link can
 * never be counted while it is not viewable or the other way around.
 *
 * Check order is deliberate and is what the reason reported to the owner
 * means: an owner's Pause wins over everything (it is the only explicit act),
 * then the date, then the view cap. A link with `maxViews: 25` records its
 * 25th view and is "views" from then on — the cap is a count of views served,
 * not a count of refusals.
 */
export function availability(
  share: { pausedAt?: number; expiresAt?: number; maxViews?: number; views: number },
  now: number,
): ShareStatus {
  if (share.pausedAt !== undefined) return "paused";
  if (share.expiresAt !== undefined && now >= share.expiresAt) return "expired";
  if (share.maxViews !== undefined && share.views >= share.maxViews) return "views";
  return "live";
}

/** The pane's 30-day sparkline window. Index 29 is today (UTC), index 0 is 29
 *  days ago; a view older than that is outside the window. */
export const DAILY_DAYS = 30;
const DAY_MS = 86_400_000;

/** Start of the UTC day containing `t`. Epoch ms are UTC, so this is a floor. */
function utcDayStart(t: number): number {
  return Math.floor(t / DAY_MS) * DAY_MS;
}

/** The earliest `at` that lands inside the window ending on the day of `now`. */
export function dailyWindowStart(now: number): number {
  return utcDayStart(now) - (DAILY_DAYS - 1) * DAY_MS;
}

/**
 * Bucket view timestamps into DAILY_DAYS per-UTC-day counts, oldest first, so
 * index 29 is today. Pure; exported for the tests. Days are UTC on purpose: a
 * link is viewed from anywhere, and the owner's own timezone is not something
 * a query knows, so the pane labels the axis and the server never guesses.
 *
 * A timestamp before the window is dropped (the caller's range query should
 * not hand us one, but a boundary is a boundary). A timestamp AFTER `now`
 * cannot come from `recordView` — it stamps the mutation's own clock — but if
 * one ever did, it is still a real view, so it lands on today rather than
 * vanishing and making the sparkline disagree with the total.
 */
export function dailyBuckets(ats: readonly number[], now: number): number[] {
  const daily = new Array<number>(DAILY_DAYS).fill(0);
  const today = utcDayStart(now);
  for (const at of ats) {
    const daysAgo = Math.floor((today - utcDayStart(at)) / DAY_MS);
    const index = DAILY_DAYS - 1 - Math.max(0, daysAgo);
    if (index < 0) continue;
    daily[index] += 1;
  }
  return daily;
}

/** Bounds on `maxViews`. An integer, and 1_000_000 is far past anything a
 *  share link here will see; it exists so a typo cannot store a number the
 *  pane would have to format. */
export const MAX_VIEWS_CEILING = 1_000_000;

/** Argument checks for `setLimits` that need no database. Exported for the
 *  tests. `null` means "clear this limit" and is always valid. */
export function checkLimits(args: {
  maxViews: number | null;
  expiresAt: number | null;
}): string | null {
  if (args.maxViews !== null) {
    if (!Number.isInteger(args.maxViews) || args.maxViews < 1 || args.maxViews > MAX_VIEWS_CEILING) {
      return `maxViews must be a whole number from 1 to ${MAX_VIEWS_CEILING}`;
    }
  }
  // A past date is allowed: it simply expires the link, which is a legitimate
  // way to stop it. NaN / Infinity are not dates.
  if (args.expiresAt !== null && !Number.isFinite(args.expiresAt)) {
    return "expiresAt must be a finite ms timestamp";
  }
  return null;
}

async function findByToken(ctx: QueryCtx | MutationCtx, token: string): Promise<Doc<"shares"> | null> {
  return await ctx.db
    .query("shares")
    .withIndex("by_token", (q) => q.eq("token", token))
    .unique();
}

/** The owner-only lookup shared by every mutation that changes a link. Throws
 *  when signed out or when the link belongs to someone else; a missing token
 *  is `null` so that a revoke racing a second tab stays a no-op. */
async function ownedShare(ctx: MutationCtx, token: string): Promise<Doc<"shares"> | null> {
  const user = await requireUser(ctx);
  const share = await findByToken(ctx, token);
  if (!share) return null;
  if (share.userId !== user._id) throw new Error("Not your share link");
  return share;
}

/** Short-lived upload URL for the snapshot PNG. Auth-gated so anonymous clients
 *  can't push orphaned blobs into storage (same policy as photoEdits). */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireUser(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

/** Create a share link for an already-uploaded snapshot blob. Returns the token;
 *  the client turns it into a `?v=<token>` URL. */
export const create = mutation({
  args: {
    storageId: v.id("_storage"),
    canvasW: v.number(),
    canvasH: v.number(),
    title: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    // Re-roll on the (vanishingly rare) chance of a token collision.
    let token = makeToken();
    for (let i = 0; i < 5; i++) {
      const clash = await findByToken(ctx, token);
      if (!clash) break;
      token = makeToken();
    }

    await ctx.db.insert("shares", {
      token,
      userId: user._id,
      storageId: args.storageId,
      canvasW: args.canvasW,
      canvasH: args.canvasH,
      title: args.title,
      views: 0,
      createdAt: Date.now(),
    });
    return { token };
  },
});

/** What `get` hands a visitor for a link that is being served. The fields
 *  before `status` are the pre-limits shape, kept exactly so a client built
 *  before limits existed keeps working for every live link. */
export interface ShareView {
  status: "live";
  imageUrl: string;
  canvasW: number;
  canvasH: number;
  title: string | null;
  views: number;
  createdAt: number;
}

/** What `get` hands a visitor for a link that exists but is stopped. NO
 *  `imageUrl` — the image is kept for the owner, not served to the visitor —
 *  and enough to say "this was shared on <date>, and is paused / has expired /
 *  has reached its view limit" rather than pretending the link never existed. */
export interface ShareUnavailable {
  status: "unavailable";
  reason: ShareStop;
  title: string | null;
  createdAt: number;
}

/** PUBLIC: resolve a token → signed image URL + metadata. `null` ONLY when the
 *  token does not exist or the blob is gone (both mean revoked); a link that is
 *  paused, expired or over its view cap answers `status: "unavailable"` with
 *  the reason, so the viewer can say which. No auth — this is what makes the
 *  link shareable with anyone.
 *
 *  `Date.now()` in a query is the query's own timestamp, and a cached result
 *  is re-run when the ROW changes, not when the clock moves. That is why
 *  `setLimits` schedules `expire` for the end date: its write at `expiresAt`
 *  re-runs every cached and open read of this link, so a new visitor and a
 *  viewer already open both see it stop then. `recordView` re-checks with its
 *  own clock, so nothing is counted past the date either way. */
export const get = query({
  args: { token: v.string() },
  handler: async (ctx, args): Promise<ShareView | ShareUnavailable | null> => {
    const share = await findByToken(ctx, args.token);
    if (!share) return null;
    const imageUrl = await ctx.storage.getUrl(share.storageId);
    if (!imageUrl) return null;
    const status = availability(share, Date.now());
    if (status !== "live") {
      return {
        status: "unavailable",
        reason: status,
        title: share.title ?? null,
        createdAt: share.createdAt,
      };
    }
    return {
      status: "live",
      imageUrl,
      canvasW: share.canvasW,
      canvasH: share.canvasH,
      title: share.title ?? null,
      views: share.views,
      createdAt: share.createdAt,
    };
  },
});

/** PUBLIC: count one view. Best-effort analytics only — a missing/revoked
 *  token is a silent no-op, and so is a link that is not being served: the
 *  view was refused, so it is not a view. The 25th view of a 25-view link IS
 *  counted (it was served); the link is "views" from then on.
 *
 *  Writes a `share_views` row holding the timestamp and nothing else. */
export const recordView = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const share = await findByToken(ctx, args.token);
    if (!share) return;
    const now = Date.now();
    if (availability(share, now) !== "live") return;
    await ctx.db.patch(share._id, { views: share.views + 1, lastViewedAt: now });
    await ctx.db.insert("share_views", { shareId: share._id, at: now });
  },
});

/** One row of the owner's Settings › Shared pane. Absent limits are `null`
 *  rather than missing so the client never has to ask "unset or undefined". */
export interface MyShare {
  token: string;
  title: string | null;
  canvasW: number;
  canvasH: number;
  views: number;
  createdAt: number;
  lastViewedAt: number | null;
  maxViews: number | null;
  expiresAt: number | null;
  pausedAt: number | null;
  status: ShareStatus;
  /** Signed URL for the thumbnail; `null` if the blob is gone. */
  imageUrl: string | null;
  /** Exactly DAILY_DAYS numbers: views per UTC day, index 29 = today. */
  daily: number[];
}

/** The signed-in user's share links, newest first, with status, limits and a
 *  30-day daily view count each. Empty when signed out.
 *
 *  COST. One `by_userId` lookup for the links, then per link one storage URL
 *  and one INDEX RANGE over `share_views` (`at >= window start`), never a
 *  scan. The work is bounded by the user's own view rows in the window: a
 *  pathological link with 100k views in a month would make this one owner's
 *  query heavy. Acceptable today — the pane is owner-only, so a link's
 *  popularity costs its owner, not the public `get` — and the fix if it ever
 *  matters is per-day rollup rows, not a different index. */
export const listMine = query({
  args: {},
  handler: async (ctx): Promise<MyShare[]> => {
    const user = await getUser(ctx);
    if (!user) return [];
    const shares = await ctx.db
      .query("shares")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect();
    shares.sort((a, b) => b.createdAt - a.createdAt);

    const now = Date.now();
    const start = dailyWindowStart(now);
    const out: MyShare[] = [];
    for (const s of shares) {
      const recent = await ctx.db
        .query("share_views")
        .withIndex("by_shareId", (q) => q.eq("shareId", s._id).gte("at", start))
        .collect();
      out.push({
        token: s.token,
        title: s.title ?? null,
        canvasW: s.canvasW,
        canvasH: s.canvasH,
        views: s.views,
        createdAt: s.createdAt,
        lastViewedAt: s.lastViewedAt ?? null,
        maxViews: s.maxViews ?? null,
        expiresAt: s.expiresAt ?? null,
        pausedAt: s.pausedAt ?? null,
        status: availability(s, now),
        imageUrl: await ctx.storage.getUrl(s.storageId),
        daily: dailyBuckets(
          recent.map((r) => r.at),
          now,
        ),
      });
    }
    return out;
  },
});

/** Owner: set or clear the auto-limits. `null` clears. Neither limit is a
 *  write to `pausedAt`, so a link the cap stopped goes live again the moment
 *  the cap is raised or cleared — and a date in the past is a valid way to
 *  stop a link right now. Throws on an out-of-range value rather than
 *  clamping: a limit the owner did not type is a surprise later. */
export const setLimits = mutation({
  args: {
    token: v.string(),
    maxViews: v.union(v.number(), v.null()),
    expiresAt: v.union(v.number(), v.null()),
  },
  handler: async (ctx, args): Promise<void> => {
    const share = await ownedShare(ctx, args.token);
    if (!share) return;
    const invalid = checkLimits(args);
    if (invalid) throw new Error(invalid);
    // `undefined` in a patch REMOVES the field (the same move sync.ts uses to
    // clear the legacy settings blob), which is how `null` clears a limit.
    // `expiredAt` goes too: it belonged to the old date.
    await ctx.db.patch(share._id, {
      maxViews: args.maxViews ?? undefined,
      expiresAt: args.expiresAt ?? undefined,
      expiredAt: undefined,
    });
    // A FUTURE end date needs a write at that instant, or a cached `get` goes
    // on answering "live" past it — Convex does not re-run a query as time
    // passes (docs, "Date.now() in queries"). A date already past needs
    // nothing: this patch is the write. A job for a date that is later moved
    // or cleared finds `expiresAt` no longer matches and does nothing.
    if (args.expiresAt !== null && args.expiresAt > Date.now()) {
      await ctx.scheduler.runAt(args.expiresAt, internal.shares.expire, {
        shareId: share._id,
        at: args.expiresAt,
      });
    }
  },
});

/** INTERNAL, scheduled by `setLimits` for the end date. Stamps `expiredAt`,
 *  which is the write that makes every cached read of this link re-run — see
 *  the note on `expiredAt` in schema.ts. */
export const expire = internalMutation({
  args: { shareId: v.id("shares"), at: v.number() },
  handler: async (ctx, { shareId, at }): Promise<void> => {
    const share = await ctx.db.get(shareId);
    // Deleted since, or the date was moved or cleared (that change scheduled
    // its own job, or needs none).
    if (!share || share.expiresAt !== at) return;
    await ctx.db.patch(shareId, { expiredAt: at });
  },
});

/** Owner: stop serving the link until `resume`. Idempotent — a second Pause
 *  keeps the first one's timestamp, so the pane's "paused since" is honest. */
export const pause = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const share = await ownedShare(ctx, args.token);
    if (!share) return;
    if (share.pausedAt !== undefined) return;
    await ctx.db.patch(share._id, { pausedAt: Date.now() });
  },
});

/** Owner: serve the link again. Clears `pausedAt` only — if a view cap or a
 *  date stopped the link too, it stays stopped for THAT reason and the pane
 *  says so, because `availability` derives it. Idempotent. */
export const resume = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const share = await ownedShare(ctx, args.token);
    if (!share) return;
    if (share.pausedAt === undefined) return;
    await ctx.db.patch(share._id, { pausedAt: undefined });
  },
});

/** Revoke a share. Only the owner can delete it; also drops the storage blob
 *  and the link's `share_views` rows (an index walk bounded by that one
 *  link's views — the rows would otherwise be orphans nothing could reach). */
export const remove = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const share = await ownedShare(ctx, args.token);
    if (!share) return;
    await ctx.storage.delete(share.storageId);
    const views = await ctx.db
      .query("share_views")
      .withIndex("by_shareId", (q) => q.eq("shareId", share._id))
      .collect();
    for (const row of views) await ctx.db.delete(row._id);
    await ctx.db.delete(share._id);
  },
});
