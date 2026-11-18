import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { internalMutation, mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import {
  CLIENT_TOKEN,
  HEX64,
  PAIR_CANDIDATES_MAX,
  PAIR_CANDIDATE_MAX_CHARS,
  PAIR_CREATES_PER_MINUTE,
  PAIR_JOINED_TTL_MS,
  PAIR_LIVE_PER_CLIENT,
  PAIR_SDP_MAX_BYTES,
  PAIR_UNJOINED_TTL_MS,
} from "./pairLimits";

// ── Pairing: the server introduces a phone and a computer (ADR-105) ──────────
//
// THE FLOW. The computer makes a random 128-bit secret and shows it in a QR
// code, in the URL FRAGMENT, so no browser ever sends it to a server. It calls
// `create` with SHA-256(secret) as the key, its WebRTC offer, and an HMAC of
// the offer keyed by the secret. The phone scans the code, reads the offer
// (`readOffer`), checks the HMAC, and `join`s with its answer and the answer's
// HMAC. Both sides trade ICE candidates (`addCandidates`, read through
// `watch`) until the data channel opens, then `close` the row. Photos never
// come here: they go device to device.
//
// NO SIGN-IN. Pairing works logged out (demo mode is sacred), so these are
// public, unauthenticated functions, and everything they store is capped
// (convex/pairLimits.ts). What the caps can and cannot stop is in ADR-105.
//
// THE SERVER CANNOT READ OR FORGE A HANDSHAKE IT IS NOT PART OF. It never sees
// the secret, so it cannot compute either HMAC, and a swapped offer or answer
// (which carries the DTLS fingerprint) fails the other side's check.
//
// A REFUSAL NEVER SAYS WHY THE KEY WAS REFUSED. A used key, an expired key and
// a key that never existed all answer `{ ok: false, reason: "unavailable" }`
// (null from the queries), so a caller learns nothing by probing.
//
// EXPIRY is a job scheduled at creation (`ctx.scheduler.runAt`), not a cron:
// the crons in crons.ts are switched off until Chris turns them on. These are
// rows with no stored files, so ADR-101's dry-run rule for file cleanups does
// not apply.

type Refusal = { ok: false; reason: "unavailable" | "invalid" | "busy" };
const UNAVAILABLE = { ok: false, reason: "unavailable" } as const;
const INVALID = { ok: false, reason: "invalid" } as const;
const BUSY = { ok: false, reason: "busy" } as const;

const encoder = new TextEncoder();

/** An SDP the server will hold: starts like one, and is at most 16 KB. */
export function isAcceptableSdp(sdp: string): boolean {
  return sdp.startsWith("v=0") && encoder.encode(sdp).length <= PAIR_SDP_MAX_BYTES;
}

/** The session for `keyHash` if it exists and has not expired, else null. */
async function liveSession(
  ctx: QueryCtx | MutationCtx,
  keyHash: string,
  now: number,
): Promise<Doc<"pair_sessions"> | null> {
  if (!HEX64.test(keyHash)) return null;
  const row = await ctx.db
    .query("pair_sessions")
    .withIndex("by_keyHash", (q) => q.eq("keyHash", keyHash))
    .first();
  return row && row.expiresAt > now ? row : null;
}

const refusal = v.object({
  ok: v.literal(false),
  reason: v.union(v.literal("unavailable"), v.literal("invalid"), v.literal("busy")),
});

/** The computer opens a session for its QR code. */
export const create = mutation({
  args: { keyHash: v.string(), offer: v.string(), offerMac: v.string(), clientToken: v.string() },
  returns: v.union(v.object({ ok: v.literal(true), expiresAt: v.number() }), refusal),
  handler: async (ctx, args): Promise<{ ok: true; expiresAt: number } | Refusal> => {
    if (
      !HEX64.test(args.keyHash) ||
      !HEX64.test(args.offerMac) ||
      !CLIENT_TOKEN.test(args.clientToken) ||
      !isAcceptableSdp(args.offer)
    ) {
      return INVALID;
    }
    const now = Date.now();

    // Everyone together: the newest N sessions. If the Nth is under a minute
    // old, N were made in the last minute. Reads at most N rows.
    const newest = await ctx.db.query("pair_sessions").order("desc").take(PAIR_CREATES_PER_MINUTE);
    if (newest.length >= PAIR_CREATES_PER_MINUTE && newest[newest.length - 1]!.createdAt > now - 60_000) {
      return BUSY;
    }
    // This client: its sessions that are still live.
    const mine = await ctx.db
      .query("pair_sessions")
      .withIndex("by_clientToken_expiresAt", (q) => q.eq("clientToken", args.clientToken).gt("expiresAt", now))
      .take(PAIR_LIVE_PER_CLIENT);
    if (mine.length >= PAIR_LIVE_PER_CLIENT) return BUSY;

    // A key is used once, ever: a second create with it is a replay or a bug.
    const existing = await ctx.db
      .query("pair_sessions")
      .withIndex("by_keyHash", (q) => q.eq("keyHash", args.keyHash))
      .first();
    if (existing) return INVALID;

    const expiresAt = now + PAIR_UNJOINED_TTL_MS;
    const id = await ctx.db.insert("pair_sessions", {
      keyHash: args.keyHash,
      clientToken: args.clientToken,
      offer: args.offer,
      offerMac: args.offerMac,
      computerCandidates: [],
      phoneCandidates: [],
      joined: false,
      createdAt: now,
      expiresAt,
    });
    await ctx.scheduler.runAt(expiresAt, internal.pairSessions.expire, { id });
    return { ok: true, expiresAt };
  },
});

/** The phone reads the offer before it answers. Null once anyone has joined. */
export const readOffer = query({
  args: { keyHash: v.string() },
  returns: v.union(v.object({ offer: v.string(), offerMac: v.string() }), v.null()),
  handler: async (ctx, { keyHash }) => {
    const row = await liveSession(ctx, keyHash, Date.now());
    if (!row || row.joined) return null;
    return { offer: row.offer, offerMac: row.offerMac };
  },
});

/** The phone joins with its answer. The first join wins; the door then shuts. */
export const join = mutation({
  args: { keyHash: v.string(), answer: v.string(), answerMac: v.string() },
  returns: v.union(v.object({ ok: v.literal(true) }), refusal),
  handler: async (ctx, args): Promise<{ ok: true } | Refusal> => {
    // Checked before the lookup, so a bad answer says the same thing whether
    // or not the key is real.
    if (!HEX64.test(args.answerMac) || !isAcceptableSdp(args.answer)) return INVALID;
    const now = Date.now();
    const row = await liveSession(ctx, args.keyHash, now);
    if (!row || row.joined) return UNAVAILABLE;
    const expiresAt = now + PAIR_JOINED_TTL_MS;
    await ctx.db.patch("pair_sessions", row._id, {
      answer: args.answer,
      answerMac: args.answerMac,
      joined: true,
      expiresAt,
    });
    // The creation-time job still fires at 5 minutes and leaves this row
    // alone (`expire` checks the date); this one removes it.
    await ctx.scheduler.runAt(expiresAt, internal.pairSessions.expire, { id: row._id });
    return { ok: true };
  },
});

/** Either side adds ICE candidates. Past the cap they are dropped, and
 *  `accepted` says how many were kept. The phone may add only once joined. */
export const addCandidates = mutation({
  args: {
    keyHash: v.string(),
    side: v.union(v.literal("computer"), v.literal("phone")),
    candidates: v.array(v.string()),
  },
  returns: v.union(v.object({ ok: v.literal(true), accepted: v.number() }), refusal),
  handler: async (ctx, args): Promise<{ ok: true; accepted: number } | Refusal> => {
    if (
      args.candidates.length > PAIR_CANDIDATES_MAX ||
      args.candidates.some((c) => c.length === 0 || c.length > PAIR_CANDIDATE_MAX_CHARS)
    ) {
      return INVALID;
    }
    const row = await liveSession(ctx, args.keyHash, Date.now());
    if (!row || (args.side === "phone" && !row.joined)) return UNAVAILABLE;
    const field = args.side === "computer" ? "computerCandidates" : "phoneCandidates";
    const have = row[field];
    const room = Math.max(0, PAIR_CANDIDATES_MAX - have.length);
    const add = args.candidates.slice(0, room);
    if (add.length > 0) await ctx.db.patch("pair_sessions", row._id, { [field]: [...have, ...add] });
    return { ok: true, accepted: add.length };
  },
});

/** Both sides subscribe: the answer (for the computer) and the other side's
 *  candidates. Null for a key that is wrong, used up by `close`, or expired. */
export const watch = query({
  args: { keyHash: v.string() },
  returns: v.union(
    v.object({
      joined: v.boolean(),
      answer: v.optional(v.string()),
      answerMac: v.optional(v.string()),
      computerCandidates: v.array(v.string()),
      phoneCandidates: v.array(v.string()),
      expiresAt: v.number(),
    }),
    v.null(),
  ),
  handler: async (ctx, { keyHash }) => {
    const row = await liveSession(ctx, keyHash, Date.now());
    if (!row) return null;
    return {
      joined: row.joined,
      answer: row.answer,
      answerMac: row.answerMac,
      computerCandidates: row.computerCandidates,
      phoneCandidates: row.phoneCandidates,
      expiresAt: row.expiresAt,
    };
  },
});

/** Either side is done with the introduction (connected, or gave up). */
export const close = mutation({
  args: { keyHash: v.string() },
  returns: v.null(),
  handler: async (ctx, { keyHash }) => {
    if (!HEX64.test(keyHash)) return null;
    const row = await ctx.db
      .query("pair_sessions")
      .withIndex("by_keyHash", (q) => q.eq("keyHash", keyHash))
      .first();
    if (row) await ctx.db.delete("pair_sessions", row._id);
    return null;
  },
});

/** Scheduled at creation and again at join, for `expiresAt`. Deletes the row
 *  only if it really is past its date: a joined row outlives the first job. */
export const expire = internalMutation({
  args: { id: v.id("pair_sessions") },
  returns: v.null(),
  handler: async (ctx, { id }) => {
    const row = await ctx.db.get("pair_sessions", id);
    if (row && row.expiresAt <= Date.now()) await ctx.db.delete("pair_sessions", id);
    return null;
  },
});
