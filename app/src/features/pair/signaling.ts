// The one server part of pairing, behind a small interface (ADR-105).
//
// Production talks to Convex (convex/pairSessions.ts). The e2e suite has no
// live backend, so it installs a relay of its own as `window.__ihPairRelay`
// before the page loads (Playwright's exposeBinding) and the app talks to that
// instead. Nothing in the app ever installs it; without it, Convex is used.
import type { ConvexReactClient } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { PAIR_STUN_URL } from "./protocol";

export type Refusal = { ok: false; reason: "unavailable" | "invalid" | "busy" };

/** What `watch` reports: the answer for the computer, and both sides'
 *  candidates. Null once the session is gone (closed, expired, or never). */
export interface SessionView {
  joined: boolean;
  answer?: string;
  answerMac?: string;
  computerCandidates: string[];
  phoneCandidates: string[];
  expiresAt: number;
}

export interface PairSignaling {
  /** ICE servers for the peer connection. Production: one STUN, no TURN. */
  iceServers: RTCIceServer[];
  create(args: {
    keyHash: string;
    offer: string;
    offerMac: string;
    clientToken: string;
  }): Promise<{ ok: true; expiresAt: number } | Refusal>;
  readOffer(keyHash: string): Promise<{ offer: string; offerMac: string } | null>;
  join(args: { keyHash: string; answer: string; answerMac: string }): Promise<{ ok: true } | Refusal>;
  addCandidates(args: {
    keyHash: string;
    side: "computer" | "phone";
    candidates: string[];
  }): Promise<{ ok: true; accepted: number } | Refusal>;
  /** Calls `onView` with the session now and on every change. Returns stop. */
  watch(keyHash: string, onView: (view: SessionView | null) => void): () => void;
  close(keyHash: string): Promise<void>;
}

/** Production: Convex, signed in or not (the functions need no sign-in). */
function convexSignaling(client: ConvexReactClient): PairSignaling {
  return {
    iceServers: [{ urls: PAIR_STUN_URL }],
    create: (args) => client.mutation(api.pairSessions.create, args),
    readOffer: (keyHash) => client.query(api.pairSessions.readOffer, { keyHash }),
    join: (args) => client.mutation(api.pairSessions.join, args),
    addCandidates: (args) => client.mutation(api.pairSessions.addCandidates, args),
    watch(keyHash, onView) {
      const watch = client.watchQuery(api.pairSessions.watch, { keyHash });
      const read = () => {
        try {
          const v = watch.localQueryResult();
          if (v !== undefined) onView(v);
        } catch {
          // A failed query is the same as a session that is gone.
          onView(null);
        }
      };
      const stop = watch.onUpdate(read);
      read();
      return stop;
    },
    close: async (keyHash) => {
      await client.mutation(api.pairSessions.close, { keyHash });
    },
  };
}

/** The e2e relay's shape: one async call per operation. */
export type RelayCall = (op: string, args: unknown) => Promise<unknown>;

declare global {
  interface Window {
    __ihPairRelay?: RelayCall;
  }
}

/** The e2e's stand-in for Convex. `watch` polls, which is plenty for a test. */
function relaySignaling(call: RelayCall, pollMs = 150): PairSignaling {
  return {
    // Two pages on one machine find each other on host candidates alone, and
    // a test must not reach a public STUN server.
    iceServers: [],
    create: (args) => call("create", args) as ReturnType<PairSignaling["create"]>,
    readOffer: (keyHash) => call("readOffer", { keyHash }) as ReturnType<PairSignaling["readOffer"]>,
    join: (args) => call("join", args) as ReturnType<PairSignaling["join"]>,
    addCandidates: (args) => call("addCandidates", args) as ReturnType<PairSignaling["addCandidates"]>,
    watch(keyHash, onView) {
      let stopped = false;
      let last = "";
      const tick = async () => {
        if (stopped) return;
        try {
          const view = (await call("watch", { keyHash })) as SessionView | null;
          const key = JSON.stringify(view);
          if (!stopped && key !== last) {
            last = key;
            onView(view);
          }
        } catch {
          // The relay went away with its page; the next tick tries again.
        }
        if (!stopped) setTimeout(() => void tick(), pollMs);
      };
      void tick();
      return () => {
        stopped = true;
      };
    },
    close: async (keyHash) => {
      await call("close", { keyHash });
    },
  };
}

/** The signaling this page should use, or null when it has none (a build
 *  without cloud keys, and no e2e relay). */
export function pickSignaling(client: ConvexReactClient | null): PairSignaling | null {
  const relay = typeof window !== "undefined" ? window.__ihPairRelay : undefined;
  if (typeof relay === "function") return relaySignaling(relay);
  return client ? convexSignaling(client) : null;
}
