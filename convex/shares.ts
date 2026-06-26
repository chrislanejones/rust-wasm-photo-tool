import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getUser, requireUser } from "./users";

// ── Public, read-only share links ──────────────────────────────────────────
// Mirrors the photoEdits storage pattern, but a share stores only the flattened
// canvas PNG (not the re-editable archive) and is fetched by an unguessable
// `token` rather than by (userId, photoKey). The `get`/`recordView` endpoints
// are intentionally public so a recipient who isn't signed in can still view it.

/** Generate a URL-safe, unguessable token. ~72 bits of entropy across two
 *  base-36 chunks — plenty for a share slug that isn't a security boundary. */
function makeToken(): string {
  const chunk = () => Math.random().toString(36).slice(2, 10);
  return (chunk() + chunk()).slice(0, 14);
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
      const clash = await ctx.db
        .query("shares")
        .withIndex("by_token", (q) => q.eq("token", token))
        .unique();
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

/** PUBLIC: resolve a token → signed image URL + metadata, or null if revoked.
 *  No auth — this is what makes the link shareable with anyone. */
export const get = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const share = await ctx.db
      .query("shares")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .unique();
    if (!share) return null;
    const imageUrl = await ctx.storage.getUrl(share.storageId);
    if (!imageUrl) return null;
    return {
      imageUrl,
      canvasW: share.canvasW,
      canvasH: share.canvasH,
      title: share.title ?? null,
      views: share.views,
      createdAt: share.createdAt,
    };
  },
});

/** PUBLIC: bump the view counter once per open. Best-effort analytics only —
 *  a missing/revoked token is a silent no-op. */
export const recordView = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const share = await ctx.db
      .query("shares")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .unique();
    if (share) await ctx.db.patch(share._id, { views: share.views + 1 });
  },
});

/** The current user's share links, newest first (for a future "My links" pane). */
export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const user = await getUser(ctx);
    if (!user) return [];
    const shares = await ctx.db
      .query("shares")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect();
    return shares
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((s) => ({
        token: s.token,
        title: s.title ?? null,
        views: s.views,
        createdAt: s.createdAt,
      }));
  },
});

/** Revoke a share. Only the owner can delete it; also drops the storage blob. */
export const remove = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const share = await ctx.db
      .query("shares")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .unique();
    if (!share) return;
    if (share.userId !== user._id) throw new Error("Not your share link");
    await ctx.storage.delete(share.storageId);
    await ctx.db.delete(share._id);
  },
});
