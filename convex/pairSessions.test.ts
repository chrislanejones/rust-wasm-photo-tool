// Pairing's signaling (convex/pairSessions.ts, ADR-105). The functions run
// without sign-in, so this pins what an anonymous caller can and cannot do:
// create, read the offer, join once, trade candidates, and what every refusal
// looks like. A used, expired or wrong key must be indistinguishable.
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import {
  PAIR_CANDIDATES_MAX,
  PAIR_CANDIDATE_MAX_CHARS,
  PAIR_CREATES_PER_MINUTE,
  PAIR_JOINED_TTL_MS,
  PAIR_LIVE_PER_CLIENT,
  PAIR_SDP_MAX_BYTES,
  PAIR_UNJOINED_TTL_MS,
} from "./pairLimits";

const modules = import.meta.glob("./**/*.*s");

const T0 = Date.UTC(2026, 10, 17, 3, 0, 0);
const hex = (n: number) => n.toString(16).padStart(64, "0");
const KEY = hex(1);
const OTHER_KEY = hex(2);
const MAC = "a".repeat(64);
const SDP = "v=0\r\no=- 1 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\n";
const TOKEN = "client-token-0001";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(T0);
});
afterEach(() => {
  vi.useRealTimers();
});

function setup() {
  const t = convexTest(schema, modules);
  const rows = () => t.run((ctx) => ctx.db.query("pair_sessions").collect());
  const create = (keyHash = KEY, clientToken = TOKEN, offer = SDP) =>
    t.mutation(api.pairSessions.create, { keyHash, offer, offerMac: MAC, clientToken });
  const join = (keyHash = KEY, answer = SDP) =>
    t.mutation(api.pairSessions.join, { keyHash, answer, answerMac: MAC });
  return { t, rows, create, join };
}

describe("pairSessions: create", () => {
  test("stores the hashed key, the offer and its MAC, nothing about a person, and expires in 5 minutes", async () => {
    const { create, rows } = setup();
    expect(await create()).toEqual({ ok: true, expiresAt: T0 + PAIR_UNJOINED_TTL_MS });
    const [row] = await rows();
    expect(row).toMatchObject({
      keyHash: KEY,
      offer: SDP,
      offerMac: MAC,
      joined: false,
      computerCandidates: [],
      phoneCandidates: [],
      createdAt: T0,
      expiresAt: T0 + PAIR_UNJOINED_TTL_MS,
    });
    // No user id, no file names, no photo data: these are the only fields.
    expect(Object.keys(row!).sort()).toEqual(
      [
        "_creationTime",
        "_id",
        "clientToken",
        "computerCandidates",
        "createdAt",
        "expiresAt",
        "joined",
        "keyHash",
        "offer",
        "offerMac",
        "phoneCandidates",
      ].sort(),
    );
  });

  test("works with no identity at all", async () => {
    const { t } = setup();
    const out = await t.mutation(api.pairSessions.create, { keyHash: KEY, offer: SDP, offerMac: MAC, clientToken: TOKEN });
    expect(out.ok).toBe(true);
  });

  test("refuses an offer over 16 KB, one that is not an SDP, a malformed key and a malformed MAC", async () => {
    const { t, rows } = setup();
    const big = SDP + "a=x".padEnd(PAIR_SDP_MAX_BYTES, "x");
    const bad = [
      { keyHash: KEY, offer: big, offerMac: MAC, clientToken: TOKEN },
      { keyHash: KEY, offer: "hello", offerMac: MAC, clientToken: TOKEN },
      { keyHash: "not-a-hash", offer: SDP, offerMac: MAC, clientToken: TOKEN },
      { keyHash: KEY, offer: SDP, offerMac: "zz", clientToken: TOKEN },
      { keyHash: KEY, offer: SDP, offerMac: MAC, clientToken: "short" },
    ];
    for (const args of bad) {
      expect(await t.mutation(api.pairSessions.create, args)).toEqual({ ok: false, reason: "invalid" });
    }
    expect(await rows()).toHaveLength(0);
  });

  test("an offer of exactly 16 KB is accepted", async () => {
    const { create } = setup();
    const exact = SDP.padEnd(PAIR_SDP_MAX_BYTES, "x");
    expect(new TextEncoder().encode(exact).length).toBe(PAIR_SDP_MAX_BYTES);
    expect((await create(KEY, TOKEN, exact)).ok).toBe(true);
  });

  test("a key already in use is refused, and the first session is untouched", async () => {
    const { create, rows } = setup();
    await create();
    expect(await create(KEY, "client-token-0002")).toEqual({ ok: false, reason: "invalid" });
    expect(await rows()).toHaveLength(1);
  });

  test(`one client may hold ${PAIR_LIVE_PER_CLIENT} live sessions, then it is told it is busy`, async () => {
    const { create } = setup();
    for (let i = 0; i < PAIR_LIVE_PER_CLIENT; i++) expect((await create(hex(100 + i))).ok).toBe(true);
    expect(await create(hex(200))).toEqual({ ok: false, reason: "busy" });
    // A different client is not affected.
    expect((await create(hex(201), "client-token-0002")).ok).toBe(true);
    // Once those expire, the first client may make more.
    vi.setSystemTime(T0 + PAIR_UNJOINED_TTL_MS + 1);
    expect((await create(hex(202))).ok).toBe(true);
  });

  test(`at most ${PAIR_CREATES_PER_MINUTE} sessions a minute, from everyone together`, async () => {
    const { create } = setup();
    for (let i = 0; i < PAIR_CREATES_PER_MINUTE; i++) {
      expect((await create(hex(300 + i), `client-token-${String(i).padStart(4, "0")}`)).ok).toBe(true);
    }
    expect(await create(hex(400), "client-token-fresh")).toEqual({ ok: false, reason: "busy" });
    vi.setSystemTime(T0 + 60_001);
    expect((await create(hex(401), "client-token-fresh")).ok).toBe(true);
  });
});

describe("pairSessions: the phone reads the offer and joins", () => {
  test("readOffer returns the offer and its MAC while the session is open", async () => {
    const { t, create } = setup();
    await create();
    expect(await t.query(api.pairSessions.readOffer, { keyHash: KEY })).toEqual({ offer: SDP, offerMac: MAC });
  });

  test("the first join wins, and closes the door: readOffer and a second join then look like a wrong key", async () => {
    const { t, create, join, rows } = setup();
    await create();
    expect(await join()).toEqual({ ok: true });
    const [row] = await rows();
    expect(row).toMatchObject({ joined: true, answer: SDP, answerMac: MAC, expiresAt: T0 + PAIR_JOINED_TTL_MS });

    const used = await join();
    const wrong = await join(OTHER_KEY);
    expect(used).toEqual({ ok: false, reason: "unavailable" });
    expect(wrong).toEqual(used);
    expect(await t.query(api.pairSessions.readOffer, { keyHash: KEY })).toBeNull();
    expect(await t.query(api.pairSessions.readOffer, { keyHash: OTHER_KEY })).toBeNull();
  });

  test("an expired key looks exactly like a wrong key and a used key", async () => {
    const { t, create, join } = setup();
    await create();
    vi.setSystemTime(T0 + PAIR_UNJOINED_TTL_MS);
    const expired = await join();
    const wrong = await join(OTHER_KEY);
    expect(expired).toEqual({ ok: false, reason: "unavailable" });
    expect(wrong).toEqual(expired);
    expect(await t.query(api.pairSessions.readOffer, { keyHash: KEY })).toBeNull();
  });

  test("a malformed key or an answer over 16 KB is refused without touching the session", async () => {
    const { create, join, rows } = setup();
    await create();
    expect(await join("nope")).toEqual({ ok: false, reason: "unavailable" });
    expect(await join(KEY, SDP.padEnd(PAIR_SDP_MAX_BYTES + 1, "x"))).toEqual({ ok: false, reason: "invalid" });
    expect((await rows())[0]!.joined).toBe(false);
  });
});

describe("pairSessions: candidates", () => {
  const cand = (i: number) => JSON.stringify({ candidate: `candidate:${i} 1 udp 1 127.0.0.1 ${5000 + i} typ host`, sdpMid: "0" });

  test("both sides add candidates, and watch shows them with the answer", async () => {
    const { t, create, join } = setup();
    await create();
    expect(
      await t.mutation(api.pairSessions.addCandidates, { keyHash: KEY, side: "computer", candidates: [cand(1)] }),
    ).toEqual({ ok: true, accepted: 1 });
    // The phone cannot add before it has joined.
    expect(
      await t.mutation(api.pairSessions.addCandidates, { keyHash: KEY, side: "phone", candidates: [cand(2)] }),
    ).toEqual({ ok: false, reason: "unavailable" });
    await join();
    expect(
      await t.mutation(api.pairSessions.addCandidates, { keyHash: KEY, side: "phone", candidates: [cand(2)] }),
    ).toEqual({ ok: true, accepted: 1 });

    expect(await t.query(api.pairSessions.watch, { keyHash: KEY })).toEqual({
      joined: true,
      answer: SDP,
      answerMac: MAC,
      computerCandidates: [cand(1)],
      phoneCandidates: [cand(2)],
      expiresAt: T0 + PAIR_JOINED_TTL_MS,
    });
  });

  test(`at most ${PAIR_CANDIDATES_MAX} a side: the rest are dropped, and the count says so`, async () => {
    const { t, create } = setup();
    await create();
    const first = Array.from({ length: PAIR_CANDIDATES_MAX - 2 }, (_, i) => cand(i));
    const more = Array.from({ length: 5 }, (_, i) => cand(100 + i));
    expect(await t.mutation(api.pairSessions.addCandidates, { keyHash: KEY, side: "computer", candidates: first })).toEqual({
      ok: true,
      accepted: PAIR_CANDIDATES_MAX - 2,
    });
    expect(await t.mutation(api.pairSessions.addCandidates, { keyHash: KEY, side: "computer", candidates: more })).toEqual({
      ok: true,
      accepted: 2,
    });
    const view = await t.query(api.pairSessions.watch, { keyHash: KEY });
    expect(view!.computerCandidates).toHaveLength(PAIR_CANDIDATES_MAX);
  });

  test("an over-long candidate, or a batch longer than the cap, is refused whole", async () => {
    const { t, create } = setup();
    await create();
    const long = "x".repeat(PAIR_CANDIDATE_MAX_CHARS + 1);
    expect(await t.mutation(api.pairSessions.addCandidates, { keyHash: KEY, side: "computer", candidates: [long] })).toEqual({
      ok: false,
      reason: "invalid",
    });
    const tooMany = Array.from({ length: PAIR_CANDIDATES_MAX + 1 }, (_, i) => cand(i));
    expect(
      await t.mutation(api.pairSessions.addCandidates, { keyHash: KEY, side: "computer", candidates: tooMany }),
    ).toEqual({ ok: false, reason: "invalid" });
  });

  test("candidates on a wrong or expired key look the same", async () => {
    const { t, create } = setup();
    await create();
    const wrong = await t.mutation(api.pairSessions.addCandidates, { keyHash: OTHER_KEY, side: "computer", candidates: [cand(1)] });
    vi.setSystemTime(T0 + PAIR_UNJOINED_TTL_MS);
    const expired = await t.mutation(api.pairSessions.addCandidates, { keyHash: KEY, side: "computer", candidates: [cand(1)] });
    expect(wrong).toEqual({ ok: false, reason: "unavailable" });
    expect(expired).toEqual(wrong);
  });
});

describe("pairSessions: watch, close and expiry", () => {
  test("watch is null for a wrong key, and for an expired one before its row is gone", async () => {
    const { t, create } = setup();
    await create();
    expect(await t.query(api.pairSessions.watch, { keyHash: OTHER_KEY })).toBeNull();
    expect((await t.query(api.pairSessions.watch, { keyHash: KEY }))!.joined).toBe(false);
    vi.setSystemTime(T0 + PAIR_UNJOINED_TTL_MS);
    expect(await t.query(api.pairSessions.watch, { keyHash: KEY })).toBeNull();
  });

  test("close deletes the row at once; closing a wrong key is a quiet no-op", async () => {
    const { t, create, rows } = setup();
    await create();
    await t.mutation(api.pairSessions.close, { keyHash: OTHER_KEY });
    expect(await rows()).toHaveLength(1);
    await t.mutation(api.pairSessions.close, { keyHash: KEY });
    expect(await rows()).toHaveLength(0);
  });

  test("an unjoined row deletes itself at 5 minutes, scheduled at creation (no cron)", async () => {
    const { t, create, rows } = setup();
    await create();
    vi.setSystemTime(T0 + PAIR_UNJOINED_TTL_MS - 1);
    vi.advanceTimersByTime(PAIR_UNJOINED_TTL_MS - 1);
    await t.finishInProgressScheduledFunctions();
    expect(await rows()).toHaveLength(1);
    vi.setSystemTime(T0 + PAIR_UNJOINED_TTL_MS);
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await rows()).toHaveLength(0);
  });

  test("a joined row outlives the 5-minute job and deletes itself at 30 minutes", async () => {
    const { t, create, join, rows } = setup();
    await create();
    await join();
    // The creation-time job fires at 5 minutes and must leave a joined row.
    vi.setSystemTime(T0 + PAIR_UNJOINED_TTL_MS);
    vi.advanceTimersByTime(PAIR_UNJOINED_TTL_MS);
    await t.finishInProgressScheduledFunctions();
    expect(await rows()).toHaveLength(1);
    vi.setSystemTime(T0 + PAIR_JOINED_TTL_MS);
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await rows()).toHaveLength(0);
  });
});
