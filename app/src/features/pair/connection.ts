// The handshake (ADR-105): the computer hosts, the phone joins, and the two
// end up with an open RTCDataChannel between them. Everything outside is
// injected (the signaling, the peer constructor, the clock), so the tests can
// drive both sides with fakes and say what was NOT done as well as what was.
//
//   computer                         server                        phone
//   offer + HMAC(offer) ─── create ──▶ row ◀── readOffer ─── check HMAC
//                                         ◀── join ───────── answer + HMAC
//   check HMAC ◀──────── watch ───────── row
//   candidates ─────── addCandidates ──▶ row ◀── addCandidates ── candidates
//   channel open ─────────────── close (the row is deleted) ──────────────
//
// A MAC that does not verify ends the attempt BEFORE `setRemoteDescription`,
// with the peer closed: a swapped SDP never gets as far as a DTLS handshake.
import { PAIR_CANDIDATES_MAX, PAIR_UNJOINED_TTL_MS } from "../../../../convex/pairLimits";
import {
  PAIR_CHANNEL_LABEL,
  PAIR_CONNECT_TIMEOUT_MS,
  decodeCandidate,
  encodeCandidate,
  isSecret,
  keyHashOf,
  macOf,
  newSecret,
  pairLink,
  verifyMac,
} from "./protocol";
import type { PairSignaling, SessionView } from "./signaling";

export type PairStatus =
  /** Making the offer (computer) or reading it (phone). */
  | "starting"
  /** Computer: the QR code is up, nobody has joined. */
  | "waiting"
  /** A phone has joined; the two are finding a path to each other. */
  | "connecting"
  /** The data channel is open. */
  | "connected"
  /** Computer: 5 minutes passed and nobody joined. */
  | "expired"
  /** Phone: the link was used, has expired, or never existed (one answer). */
  | "unavailable"
  /** An offer or answer failed its HMAC: dropped, never applied. */
  | "tampered"
  /** No direct path within 15 seconds, or the peer connection failed. */
  | "unreachable"
  /** The server is making too many sessions right now. */
  | "busy"
  /** Something unexpected (a browser without WebRTC, a refused call). */
  | "error"
  /** Was connected, and the other side went away. */
  | "disconnected"
  /** This side stopped it. */
  | "stopped";

/** One change to the pairing's state. Fields that are absent did not change. */
export interface PairUpdate {
  status?: PairStatus;
  /** Computer: the QR code's link. Holds the secret: never log it. */
  link?: string;
  /** Computer: when the QR code stops working, on this device's clock. */
  expiresAt?: number;
  /** The peer connection and its data channel, for the photo protocol. Null
   *  once the attempt has ended. */
  peer?: RTCPeerConnection | null;
  channel?: RTCDataChannel | null;
}

export interface PairDeps {
  signaling: PairSignaling;
  createPeer: (config: RTCConfiguration) => RTCPeerConnection;
  /** This tab's token for the server's per-client cap. */
  clientToken: string;
  now: () => number;
}

export interface PairHandle {
  stop(): void;
}

type Side = "computer" | "phone";

/** One attempt, from start to an end status. Ends exactly once. */
class Attempt {
  private done = false;
  connected = false;
  pc: RTCPeerConnection | null = null;
  /** Set once the server holds a session this side may close. */
  keyHash: string | null = null;
  unwatch: (() => void) | null = null;
  private timers = new Set<ReturnType<typeof setTimeout>>();
  private queue: Promise<void> = Promise.resolve();

  constructor(
    private deps: PairDeps,
    private emit: (u: PairUpdate) => void,
  ) {}

  get isDone() {
    return this.done;
  }

  update(u: PairUpdate) {
    if (!this.done) this.emit(u);
  }

  after(ms: number, fn: () => void) {
    const id = setTimeout(() => {
      this.timers.delete(id);
      if (!this.done) fn();
    }, ms);
    this.timers.add(id);
  }

  private quiet() {
    for (const id of this.timers) clearTimeout(id);
    this.timers.clear();
    this.unwatch?.();
    this.unwatch = null;
    if (this.keyHash) {
      const key = this.keyHash;
      this.keyHash = null;
      void this.deps.signaling.close(key).catch(() => {});
    }
  }

  /** Run async work in order, from callbacks that can fire close together. */
  serial(fn: () => Promise<void>) {
    this.queue = this.queue.then(() => (this.done ? undefined : fn())).catch(() => this.end("error"));
  }

  run(fn: () => Promise<void>) {
    this.serial(fn);
  }

  end(status: PairStatus) {
    if (this.done) return;
    this.done = true;
    this.quiet();
    try {
      this.pc?.close();
    } catch {
      // Already closed.
    }
    this.emit({ status, peer: null, channel: null });
  }

  markConnected() {
    if (this.done || this.connected) return;
    this.connected = true;
    // The introduction is over: stop the clocks and delete the row.
    this.quiet();
    this.emit({ status: "connected" });
  }

  watchPeer(pc: RTCPeerConnection) {
    pc.addEventListener("connectionstatechange", () => {
      const s = pc.connectionState;
      if (s === "failed") this.end(this.connected ? "disconnected" : "unreachable");
      else if (s === "closed" && this.connected) this.end("disconnected");
    });
  }

  watchChannel(channel: RTCDataChannel) {
    if (channel.readyState === "open") this.markConnected();
    else channel.addEventListener("open", () => this.markConnected());
    channel.addEventListener("close", () => {
      if (this.connected) this.end("disconnected");
    });
  }

  /** Send this side's candidates in small batches, once `ready()` (the server
   *  holds the session, and this side may write to it). */
  trickle(pc: RTCPeerConnection, side: Side) {
    const pending: string[] = [];
    let sent = 0;
    let ready = false;
    let scheduled = false;
    const flush = () => {
      scheduled = false;
      if (!ready || !this.keyHash || pending.length === 0) return;
      const batch = pending.splice(0, pending.length);
      void this.deps.signaling
        .addCandidates({ keyHash: this.keyHash, side, candidates: batch })
        .catch(() => {});
    };
    const schedule = () => {
      if (scheduled) return;
      scheduled = true;
      this.after(100, flush);
    };
    pc.addEventListener("icecandidate", (e) => {
      const c = (e as RTCPeerConnectionIceEvent).candidate;
      // A null candidate (or an empty one) marks the end of gathering.
      if (!c || !c.candidate) return;
      const s = encodeCandidate(c.toJSON());
      if (!s || sent >= PAIR_CANDIDATES_MAX) return;
      sent += 1;
      pending.push(s);
      schedule();
    });
    return {
      ready: () => {
        ready = true;
        schedule();
      },
    };
  }

  async applyCandidates(pc: RTCPeerConnection, list: readonly string[], applied: Set<string>) {
    for (const s of list) {
      if (applied.has(s)) continue;
      applied.add(s);
      const init = decodeCandidate(s);
      if (init) await pc.addIceCandidate(init).catch(() => {});
    }
  }
}

/** The computer: make a secret and an offer, open a session, show the link,
 *  and wait for a phone. */
export function hostPairing(
  deps: PairDeps,
  emit: (u: PairUpdate) => void,
  where: { origin: string; pathname: string },
): PairHandle {
  const a = new Attempt(deps, emit);
  a.update({ status: "starting" });
  a.run(async () => {
    const secret = newSecret();
    const keyHash = await keyHashOf(secret);
    const pc = deps.createPeer({ iceServers: deps.signaling.iceServers });
    a.pc = pc;
    a.watchPeer(pc);
    const channel = pc.createDataChannel(PAIR_CHANNEL_LABEL, { ordered: true });
    a.watchChannel(channel);
    const trickle = a.trickle(pc, "computer");

    await pc.setLocalDescription(await pc.createOffer());
    const offer = pc.localDescription?.sdp;
    if (!offer) return a.end("error");
    const offerMac = await macOf(secret, "offer", offer);
    const created = await deps.signaling.create({ keyHash, offer, offerMac, clientToken: deps.clientToken });
    if (a.isDone) {
      // Stopped while the server was answering: take the session back down.
      if (created.ok) void deps.signaling.close(keyHash).catch(() => {});
      return;
    }
    if (!created.ok) return a.end(created.reason === "busy" ? "busy" : "error");
    a.keyHash = keyHash;
    trickle.ready();

    a.update({
      status: "waiting",
      link: pairLink(where.origin, where.pathname, secret),
      expiresAt: deps.now() + PAIR_UNJOINED_TTL_MS,
      peer: pc,
      channel,
    });

    let answered = false;
    let remoteSet = false;
    const applied = new Set<string>();
    a.after(PAIR_UNJOINED_TTL_MS, () => {
      if (!answered) a.end("expired");
    });
    a.unwatch = deps.signaling.watch(keyHash, (view: SessionView | null) =>
      a.serial(async () => {
        if (a.connected) return;
        if (view === null) {
          // Gone before anyone joined: expired on the server, or closed.
          if (!answered) a.end("expired");
          return;
        }
        if (!answered && view.answer !== undefined && view.answerMac !== undefined) {
          answered = true;
          if (!(await verifyMac(secret, "answer", view.answer, view.answerMac))) return a.end("tampered");
          await pc.setRemoteDescription({ type: "answer", sdp: view.answer });
          remoteSet = true;
          a.update({ status: "connecting" });
          a.after(PAIR_CONNECT_TIMEOUT_MS, () => a.end("unreachable"));
        }
        if (remoteSet) await a.applyCandidates(pc, view.phoneCandidates, applied);
      }),
    );
  });
  return { stop: () => a.end("stopped") };
}

/** The phone: read the offer, check it, answer, join. */
export function joinPairing(deps: PairDeps, emit: (u: PairUpdate) => void, secret: string): PairHandle {
  const a = new Attempt(deps, emit);
  a.update({ status: "starting" });
  a.run(async () => {
    if (!isSecret(secret)) return a.end("unavailable");
    const keyHash = await keyHashOf(secret);
    const offered = await deps.signaling.readOffer(keyHash);
    if (a.isDone) return;
    if (!offered) return a.end("unavailable");
    if (!(await verifyMac(secret, "offer", offered.offer, offered.offerMac))) return a.end("tampered");

    const pc = deps.createPeer({ iceServers: deps.signaling.iceServers });
    a.pc = pc;
    a.watchPeer(pc);
    pc.addEventListener("datachannel", (e) => {
      const channel = (e as RTCDataChannelEvent).channel;
      if (channel.label !== PAIR_CHANNEL_LABEL) return;
      a.update({ channel });
      a.watchChannel(channel);
    });
    const trickle = a.trickle(pc, "phone");

    await pc.setRemoteDescription({ type: "offer", sdp: offered.offer });
    await pc.setLocalDescription(await pc.createAnswer());
    const answer = pc.localDescription?.sdp;
    if (!answer) return a.end("error");
    const answerMac = await macOf(secret, "answer", answer);
    const joined = await deps.signaling.join({ keyHash, answer, answerMac });
    if (a.isDone) return;
    // Another phone got there first, or it expired meanwhile. The session is
    // not ours to close.
    if (!joined.ok) return a.end("unavailable");
    a.keyHash = keyHash;
    trickle.ready();
    a.update({ status: "connecting", peer: pc });
    a.after(PAIR_CONNECT_TIMEOUT_MS, () => a.end("unreachable"));

    const applied = new Set<string>();
    a.unwatch = deps.signaling.watch(keyHash, (view) =>
      a.serial(async () => {
        if (view && !a.connected) await a.applyCandidates(pc, view.computerCandidates, applied);
      }),
    );
  });
  return { stop: () => a.end("stopped") };
}
