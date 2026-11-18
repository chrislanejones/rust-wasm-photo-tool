// The handshake, with a fake signaling server and fake peers. The server here
// keeps the real rules that matter to the client (one join, null when gone),
// and the peers record what was done to them, so each test can say what the
// client did and, as importantly, what it did NOT do.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { hostPairing, joinPairing, type PairDeps, type PairUpdate } from "./connection";
import { keyHashOf, macOf, newClientToken } from "./protocol";
import type { PairSignaling, SessionView } from "./signaling";
import { PAIR_CHANNEL_LABEL, PAIR_CONNECT_TIMEOUT_MS } from "./protocol";
import { PAIR_UNJOINED_TTL_MS } from "../../../../convex/pairLimits";

const OFFER = "v=0\r\no=- 1 2 IN IP4 127.0.0.1\r\na=fingerprint:sha-256 AA:AA\r\n";
const ANSWER = "v=0\r\no=- 3 4 IN IP4 127.0.0.1\r\na=fingerprint:sha-256 BB:BB\r\n";

// ── fakes ─────────────────────────────────────────────────────────────────────

type Listener = (e: Record<string, unknown>) => void;

/** Just enough of EventTarget, with plain objects for events. */
class Events {
  private listeners = new Map<string, Set<Listener>>();
  addEventListener(type: string, fn: Listener) {
    const set = this.listeners.get(type) ?? new Set();
    this.listeners.set(type, set);
    set.add(fn);
  }
  removeEventListener(type: string, fn: Listener) {
    this.listeners.get(type)?.delete(fn);
  }
  fire(type: string, e: Record<string, unknown> = {}) {
    this.listeners.get(type)?.forEach((fn) => fn(e));
  }
}

class FakeChannel extends Events {
  readyState = "connecting";
  constructor(public label: string) {
    super();
  }
  open() {
    this.readyState = "open";
    this.fire("open");
  }
  close() {
    this.readyState = "closed";
  }
}

class FakePeer extends Events {
  localDescription: { type: string; sdp: string } | null = null;
  remoteDescription: { type: string; sdp: string } | null = null;
  connectionState = "new";
  closed = false;
  added: unknown[] = [];
  channels: FakeChannel[] = [];
  constructor(public config: RTCConfiguration) {
    super();
  }
  createDataChannel(label: string) {
    const c = new FakeChannel(label);
    this.channels.push(c);
    return c;
  }
  async createOffer() {
    return { type: "offer", sdp: OFFER };
  }
  async createAnswer() {
    return { type: "answer", sdp: ANSWER };
  }
  async setLocalDescription(d: { type: string; sdp: string }) {
    this.localDescription = d;
  }
  async setRemoteDescription(d: { type: string; sdp: string }) {
    this.remoteDescription = d;
  }
  async addIceCandidate(c: unknown) {
    this.added.push(c);
  }
  close() {
    this.closed = true;
    this.connectionState = "closed";
  }
  /** The browser found a path. */
  emitCandidate(candidate: string) {
    this.fire("icecandidate", { candidate: { candidate, toJSON: () => ({ candidate, sdpMid: "0", sdpMLineIndex: 0 }) } });
  }
}

interface Row {
  offer: string;
  offerMac: string;
  answer?: string;
  answerMac?: string;
  joined: boolean;
  computerCandidates: string[];
  phoneCandidates: string[];
}

function fakeServer() {
  const rows = new Map<string, Row>();
  const watchers = new Map<string, Set<(v: SessionView | null) => void>>();
  const calls: { op: string; args: unknown }[] = [];
  const view = (k: string): SessionView | null => {
    const r = rows.get(k);
    return r
      ? {
          joined: r.joined,
          answer: r.answer,
          answerMac: r.answerMac,
          computerCandidates: [...r.computerCandidates],
          phoneCandidates: [...r.phoneCandidates],
          expiresAt: 0,
        }
      : null;
  };
  const notify = (k: string) => watchers.get(k)?.forEach((cb) => cb(view(k)));
  /** A hook for the tests: change what the server hands out. */
  const tamper = { offer: (s: string) => s, answer: (s: string) => s };
  const signaling: PairSignaling = {
    iceServers: [{ urls: "stun:stun.example.invalid:3478" }],
    async create(args) {
      calls.push({ op: "create", args });
      rows.set(args.keyHash, {
        offer: args.offer,
        offerMac: args.offerMac,
        joined: false,
        computerCandidates: [],
        phoneCandidates: [],
      });
      return { ok: true, expiresAt: Date.now() + PAIR_UNJOINED_TTL_MS };
    },
    async readOffer(keyHash) {
      calls.push({ op: "readOffer", args: { keyHash } });
      const r = rows.get(keyHash);
      return r && !r.joined ? { offer: tamper.offer(r.offer), offerMac: r.offerMac } : null;
    },
    async join(args) {
      calls.push({ op: "join", args });
      const r = rows.get(args.keyHash);
      if (!r || r.joined) return { ok: false, reason: "unavailable" };
      Object.assign(r, { joined: true, answer: tamper.answer(args.answer), answerMac: args.answerMac });
      notify(args.keyHash);
      return { ok: true };
    },
    async addCandidates(args) {
      calls.push({ op: "addCandidates", args });
      const r = rows.get(args.keyHash);
      if (!r) return { ok: false, reason: "unavailable" };
      (args.side === "computer" ? r.computerCandidates : r.phoneCandidates).push(...args.candidates);
      notify(args.keyHash);
      return { ok: true, accepted: args.candidates.length };
    },
    watch(keyHash, cb) {
      calls.push({ op: "watch", args: { keyHash } });
      const set = watchers.get(keyHash) ?? new Set();
      watchers.set(keyHash, set);
      set.add(cb);
      queueMicrotask(() => cb(view(keyHash)));
      return () => set.delete(cb);
    },
    async close(keyHash) {
      calls.push({ op: "close", args: { keyHash } });
      rows.delete(keyHash);
      notify(keyHash);
    },
  };
  return { signaling, rows, calls, tamper };
}

function harness() {
  const server = fakeServer();
  const peers: FakePeer[] = [];
  const deps: PairDeps = {
    signaling: server.signaling,
    createPeer: (config) => {
      const p = new FakePeer(config);
      peers.push(p);
      return p as unknown as RTCPeerConnection;
    },
    clientToken: newClientToken(),
    now: () => Date.now(),
  };
  const hostUpdates: PairUpdate[] = [];
  const joinUpdates: PairUpdate[] = [];
  const last = (u: PairUpdate[]) => u[u.length - 1];
  const statusOf = (u: PairUpdate[]) => [...u].reverse().find((x) => x.status)?.status;
  return { server, peers, deps, hostUpdates, joinUpdates, last, statusOf };
}

// WebCrypto (the hash, the HMACs) resolves on Node's thread pool, not on a
// timer or a microtask, so a flush has to yield to the real event loop too.
const realImmediate = globalThis.setImmediate;
const flush = async () => {
  for (let i = 0; i < 40; i++) {
    await vi.advanceTimersByTimeAsync(0);
    await new Promise((r) => realImmediate(r));
  }
};

/** Flush until `cond` holds (or give up after a generous number of turns, and
 *  let the test's own assertion say what state it was left in). */
const until = async (cond: () => boolean) => {
  for (let i = 0; i < 50 && !cond(); i++) await flush();
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date"] });
});
afterEach(() => {
  vi.useRealTimers();
});

/** Host, then the link's secret. */
async function host(h: ReturnType<typeof harness>) {
  const handle = hostPairing(h.deps, (u) => h.hostUpdates.push(u), { origin: "http://localhost:4311", pathname: "/" });
  await until(() => h.hostUpdates.some((u) => u.link));
  const link = h.hostUpdates.find((u) => u.link)?.link;
  expect(link).toBeDefined();
  const secret = link!.split("#/pair/")[1]!;
  return { handle, secret, keyHash: await keyHashOf(secret) };
}

// ── the computer ─────────────────────────────────────────────────────────────

describe("the computer (host)", () => {
  it("opens a session under the hashed key, with an offer MAC the secret verifies, and shows the link", async () => {
    const h = harness();
    const { secret, keyHash } = await host(h);
    const create = h.server.calls.find((c) => c.op === "create")!.args as { keyHash: string; offerMac: string; offer: string };
    expect(create.keyHash).toBe(keyHash);
    expect(create.offer).toBe(OFFER);
    expect(create.offerMac).toBe(await macOf(secret, "offer", OFFER));
    expect(h.statusOf(h.hostUpdates)).toBe("waiting");
    // The peer and its data channel are exposed for the next PR to use.
    const waiting = h.hostUpdates.find((u) => u.status === "waiting")!;
    expect(waiting.peer).toBe(h.peers[0]);
    expect(waiting.channel).toBe(h.peers[0]!.channels[0]);
    expect(h.peers[0]!.config.iceServers).toEqual(h.server.signaling.iceServers);
  });

  it("never sends the secret itself to the server", async () => {
    const h = harness();
    const { secret } = await host(h);
    h.peers[0]!.emitCandidate("candidate:1 1 udp 1 127.0.0.1 5000 typ host");
    await vi.advanceTimersByTimeAsync(500);
    expect(JSON.stringify(h.server.calls)).not.toContain(secret);
  });

  it("trickles its candidates to the session", async () => {
    const h = harness();
    const { keyHash } = await host(h);
    h.peers[0]!.emitCandidate("candidate:1 1 udp 1 127.0.0.1 5000 typ host");
    await vi.advanceTimersByTimeAsync(500);
    expect(h.server.rows.get(keyHash)!.computerCandidates).toHaveLength(1);
  });

  it("a tampered answer is refused before setRemoteDescription, and the connection dropped", async () => {
    const h = harness();
    const { secret, keyHash } = await host(h);
    h.server.tamper.answer = (s) => s.replace("BB:BB", "BB:BC");
    await h.server.signaling.join({ keyHash, answer: ANSWER, answerMac: await macOf(secret, "answer", ANSWER) });
    await until(() => h.statusOf(h.hostUpdates) === "tampered");
    expect(h.statusOf(h.hostUpdates)).toBe("tampered");
    expect(h.peers[0]!.remoteDescription).toBeNull();
    expect(h.peers[0]!.closed).toBe(true);
    expect(h.server.rows.has(keyHash)).toBe(false);
  });

  it("a real answer is applied; then 15 s with no channel is 'unreachable'", async () => {
    const h = harness();
    const { secret, keyHash } = await host(h);
    await h.server.signaling.join({ keyHash, answer: ANSWER, answerMac: await macOf(secret, "answer", ANSWER) });
    await until(() => h.statusOf(h.hostUpdates) === "connecting");
    expect(h.peers[0]!.remoteDescription).toEqual({ type: "answer", sdp: ANSWER });
    expect(h.statusOf(h.hostUpdates)).toBe("connecting");
    await vi.advanceTimersByTimeAsync(PAIR_CONNECT_TIMEOUT_MS - 1);
    expect(h.statusOf(h.hostUpdates)).toBe("connecting");
    await vi.advanceTimersByTimeAsync(1);
    expect(h.statusOf(h.hostUpdates)).toBe("unreachable");
    expect(h.peers[0]!.closed).toBe(true);
  });

  it("the channel opening is 'connected', and the session row is deleted", async () => {
    const h = harness();
    const { secret, keyHash } = await host(h);
    await h.server.signaling.join({ keyHash, answer: ANSWER, answerMac: await macOf(secret, "answer", ANSWER) });
    await until(() => h.statusOf(h.hostUpdates) === "connecting");
    h.peers[0]!.channels[0]!.open();
    await flush();
    expect(h.statusOf(h.hostUpdates)).toBe("connected");
    expect(h.server.rows.has(keyHash)).toBe(false);
    // Connected outlives the 15 s timer.
    await vi.advanceTimersByTimeAsync(PAIR_CONNECT_TIMEOUT_MS * 2);
    expect(h.statusOf(h.hostUpdates)).toBe("connected");
    expect(h.peers[0]!.closed).toBe(false);
  });

  it("nobody joins for 5 minutes: 'expired', and the session is closed", async () => {
    const h = harness();
    const { keyHash } = await host(h);
    await vi.advanceTimersByTimeAsync(PAIR_UNJOINED_TTL_MS);
    expect(h.statusOf(h.hostUpdates)).toBe("expired");
    expect(h.server.rows.has(keyHash)).toBe(false);
    expect(h.peers[0]!.closed).toBe(true);
  });

  it("the server refusing to make a session (busy) is said plainly", async () => {
    const h = harness();
    h.server.signaling.create = async () => ({ ok: false, reason: "busy" });
    hostPairing(h.deps, (u) => h.hostUpdates.push(u), { origin: "http://x", pathname: "/" });
    await until(() => h.statusOf(h.hostUpdates) === "busy");
    expect(h.statusOf(h.hostUpdates)).toBe("busy");
  });

  it("stop() closes the peer and the session", async () => {
    const h = harness();
    const { handle, keyHash } = await host(h);
    handle.stop();
    await flush();
    expect(h.peers[0]!.closed).toBe(true);
    expect(h.server.rows.has(keyHash)).toBe(false);
  });
});

// ── the phone ────────────────────────────────────────────────────────────────

describe("the phone (joiner)", () => {
  it("connects: verifies the offer, answers with a MAC, applies the computer's candidates, and exposes the channel", async () => {
    const h = harness();
    const { secret, keyHash } = await host(h);
    h.peers[0]!.emitCandidate("candidate:1 1 udp 1 127.0.0.1 5000 typ host");
    await vi.advanceTimersByTimeAsync(500);

    joinPairing(h.deps, (u) => h.joinUpdates.push(u), secret);
    await until(() => h.statusOf(h.joinUpdates) === "connecting" && (h.peers[1]?.added.length ?? 0) > 0);
    const phone = h.peers[1]!;
    expect(phone.remoteDescription).toEqual({ type: "offer", sdp: OFFER });
    const row = h.server.rows.get(keyHash)!;
    expect(row.joined).toBe(true);
    expect(row.answerMac).toBe(await macOf(secret, "answer", ANSWER));
    expect(phone.added).toEqual([{ candidate: "candidate:1 1 udp 1 127.0.0.1 5000 typ host", sdpMid: "0", sdpMLineIndex: 0 }]);
    expect(h.statusOf(h.joinUpdates)).toBe("connecting");

    const channel = new FakeChannel(PAIR_CHANNEL_LABEL);
    phone.fire("datachannel", { channel });
    channel.open();
    await flush();
    expect(h.statusOf(h.joinUpdates)).toBe("connected");
    expect(h.joinUpdates.some((u) => u.channel === channel)).toBe(true);
    expect(h.joinUpdates.some((u) => u.peer === (phone as unknown as RTCPeerConnection))).toBe(true);
  });

  it("a tampered offer is refused: no setRemoteDescription, no join, the door stays shut", async () => {
    const h = harness();
    const { secret, keyHash } = await host(h);
    h.server.tamper.offer = (s) => s.replace("AA:AA", "AA:AB");
    joinPairing(h.deps, (u) => h.joinUpdates.push(u), secret);
    await until(() => h.statusOf(h.joinUpdates) === "tampered");
    expect(h.statusOf(h.joinUpdates)).toBe("tampered");
    expect(h.server.calls.some((c) => c.op === "join")).toBe(false);
    expect(h.peers.slice(1).every((p) => p.remoteDescription === null)).toBe(true);
    expect(h.server.rows.get(keyHash)!.joined).toBe(false);
  });

  it("a link that was used or has expired says so, and makes no peer", async () => {
    const h = harness();
    const { secret, keyHash } = await host(h);
    await h.server.signaling.close(keyHash);
    joinPairing(h.deps, (u) => h.joinUpdates.push(u), secret);
    await until(() => h.statusOf(h.joinUpdates) === "unavailable");
    expect(h.statusOf(h.joinUpdates)).toBe("unavailable");
    expect(h.peers).toHaveLength(1);
  });

  it("losing the race to another phone is the same 'unavailable', and the peer is closed", async () => {
    const h = harness();
    const { secret, keyHash } = await host(h);
    const realJoin = h.server.signaling.join;
    h.server.signaling.join = async (args) => {
      h.server.rows.get(keyHash)!.joined = true; // someone else got there first
      return realJoin(args);
    };
    joinPairing(h.deps, (u) => h.joinUpdates.push(u), secret);
    await until(() => h.statusOf(h.joinUpdates) === "unavailable");
    expect(h.statusOf(h.joinUpdates)).toBe("unavailable");
    expect(h.peers[1]!.closed).toBe(true);
  });

  it("a malformed secret never reaches the server", async () => {
    const h = harness();
    joinPairing(h.deps, (u) => h.joinUpdates.push(u), "not-a-secret");
    await until(() => h.statusOf(h.joinUpdates) === "unavailable");
    expect(h.statusOf(h.joinUpdates)).toBe("unavailable");
    expect(h.server.calls).toEqual([]);
  });

  it("15 s after joining with no channel: 'unreachable'", async () => {
    const h = harness();
    const { secret } = await host(h);
    joinPairing(h.deps, (u) => h.joinUpdates.push(u), secret);
    await until(() => h.statusOf(h.joinUpdates) === "connecting");
    expect(h.statusOf(h.joinUpdates)).toBe("connecting");
    await vi.advanceTimersByTimeAsync(PAIR_CONNECT_TIMEOUT_MS);
    expect(h.statusOf(h.joinUpdates)).toBe("unreachable");
    expect(h.peers[1]!.closed).toBe(true);
  });
});
