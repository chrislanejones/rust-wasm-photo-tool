import { useCallback, useEffect, useRef, useState } from "react";

/** Channel name is the storage identity, not the app name — every tab sharing
 *  these IndexedDB databases must agree on it. */
const CHANNEL = "image-horse-tab-claim";

interface ClaimMessage {
  type: "claim";
  id: string;
}

/**
 * One editing tab at a time, the way Google Messages does it.
 *
 * WHY THIS EXISTS. Every tab shares one set of IndexedDB databases and one
 * engine document per photo. Two tabs editing the same gallery both write
 * `originals` / `workingCopies` / the op-log, and the loser's work is
 * overwritten with no warning — the user is never told a second tab exists.
 * It is also the trigger for the parked Dexie hazard: a stale tab holding the
 * database open blocks the next schema upgrade indefinitely. Claiming a single
 * tab makes both of those unreachable rather than merely unlikely.
 *
 * The protocol is deliberately tiny. Each tab mints an id and announces a claim
 * on mount. Hearing someone else's claim means this tab is no longer the active
 * one, so it goes stale and the caller covers the editor. Pressing "Use here"
 * re-announces, which stales whichever tab held it. Last claim wins, which is
 * the same rule Messages uses and the one users already expect.
 *
 * NOT a window CustomEvent (those are forbidden here, and rightly) and not a
 * store: neither crosses a tab boundary. BroadcastChannel is the only thing
 * that does, and it is same-origin only.
 */
export function useTabClaim(): { isStale: boolean; claimHere: () => void } {
  // One id per tab, stable across re-renders. MINTED ON MOUNT, not in render:
  // `crypto.randomUUID()` and `performance.now()` are impure, and calling them
  // during the render phase breaks the React Compiler rules (ADR-020) — the
  // same rule that moved CelebrationDialog's confetti generation onto mount.
  // The ref outlives StrictMode's double-invoke, so the id stays put; a fresh
  // one per mount would make a tab hear its own claim and park itself.
  const idRef = useRef<string>("");
  const channelRef = useRef<BroadcastChannel | null>(null);
  const [isStale, setIsStale] = useState(false);

  const claimHere = useCallback(() => {
    setIsStale(false);
    channelRef.current?.postMessage({ type: "claim", id: idRef.current } satisfies ClaimMessage);
  }, []);

  useEffect(() => {
    // Absent in older browsers and in any non-window runtime. No channel simply
    // means no detection — the editor must never fail to open over this.
    if (typeof BroadcastChannel === "undefined") return;

    if (!idRef.current) {
      idRef.current =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `tab-${Math.random().toString(36).slice(2)}-${Date.now()}`;
    }

    const channel = new BroadcastChannel(CHANNEL);
    channelRef.current = channel;

    channel.onmessage = (e: MessageEvent<ClaimMessage>) => {
      if (e.data?.type !== "claim") return;
      if (e.data.id === idRef.current) return; // our own claim, echoed
      setIsStale(true);
    };

    // Announce on mount: opening a new tab takes the session, so the tab you
    // just opened is the one that works. Anything else would hand control to
    // the window the user isn't looking at.
    channel.postMessage({ type: "claim", id: idRef.current } satisfies ClaimMessage);

    return () => {
      channel.onmessage = null;
      channel.close();
      channelRef.current = null;
    };
  }, []);

  return { isStale, claimHere };
}
