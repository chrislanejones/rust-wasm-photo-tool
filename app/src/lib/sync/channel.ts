// The cross-TAB wire. One BroadcastChannel, shared by every synced document.
//
// WHY BroadcastChannel and nothing else. A zustand store does not cross a tab
// boundary; neither does a window CustomEvent; the localStorage `storage`
// event does cross, but never fires in the tab that wrote — so it cannot be
// the only channel — and it carries nothing for state kept in IndexedDB,
// which is where two of the three synced documents live. BroadcastChannel is
// same-origin, same-profile, and delivers to every other tab including ones
// the user has parked behind MultiTabScreen.
//
// It is NOT the cross-DEVICE wire. That is Convex (`useCloudSync`). This
// channel exists so that a change in one tab lands in the others INSTANTLY
// and without a server round-trip — including when the user is signed out,
// where it is the only sync there is.
import { tabId } from "./identity";
import { isSyncKey, type SyncKey } from "./keys";

/** Versioned, because a message from a tab running an older build is a real
 *  possibility (a tab left open across a deploy). A mismatched version is
 *  dropped rather than parsed — the receiving tab keeps its own value, which
 *  is the safe direction. */
const PROTOCOL = 1;

/** Deliberately NOT the tab-claim channel ("image-horse-tab-claim"). That one
 *  decides which tab may EDIT; this one carries state to all of them,
 *  including the parked ones. Sharing a channel would couple two unrelated
 *  protocols and make a claim message something every document handler has to
 *  skip past. */
const CHANNEL = "image-horse-sync";

export interface DocMessage {
  protocol: number;
  type: "doc";
  key: SyncKey;
  /** The canonical JSON blob — the same string the server stores. */
  value: string;
  /** When the SENDING tab last changed this value (its own clock). */
  updatedAt: number;
  /** Server revision the sender has seen, 0 if it has never synced. */
  rev: number;
  /** True when the sender still owes the server this value. Carried so a tab
   *  that adopts it inherits the obligation — otherwise a change made in a
   *  background tab could be adopted everywhere locally and pushed nowhere. */
  dirty: boolean;
  from: string;
}

type Listener = (msg: DocMessage) => void;

const listeners = new Set<Listener>();
let channel: BroadcastChannel | null = null;
let opened = false;

function open(): BroadcastChannel | null {
  if (opened) return channel;
  opened = true;
  // Absent in older browsers and in any non-window runtime. No channel means
  // no cross-tab sync — the app must never fail to start over it.
  if (typeof BroadcastChannel === "undefined") return null;

  channel = new BroadcastChannel(CHANNEL);
  channel.onmessage = (e: MessageEvent<DocMessage>) => {
    const msg = e.data;
    if (!msg || msg.type !== "doc" || msg.protocol !== PROTOCOL) return;
    if (msg.from === tabId()) return; // our own message, echoed back
    if (!isSyncKey(msg.key) || typeof msg.value !== "string") return;
    for (const listener of listeners) listener(msg);
  };
  // Node's BroadcastChannel holds the event loop open; the browser's has no
  // unref. Without this a vitest run that opens a channel never exits.
  (channel as unknown as { unref?: () => void }).unref?.();
  return channel;
}

export function publish(msg: Omit<DocMessage, "protocol" | "type" | "from">): void {
  const ch = open();
  if (!ch) return;
  try {
    ch.postMessage({ ...msg, protocol: PROTOCOL, type: "doc", from: tabId() } satisfies DocMessage);
  } catch {
    // A closed channel (page unloading) or a value that failed to clone.
    // Losing a cross-tab hop is recoverable — the other tab still has its own
    // copy and, when signed in, its own Convex subscription.
  }
}

export function subscribe(listener: Listener): () => void {
  open();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Test seam: close the channel and forget every listener, so one spec's
 *  channel cannot deliver into the next one. */
export function closeChannelForTests(): void {
  listeners.clear();
  if (channel) {
    channel.onmessage = null;
    channel.close();
  }
  channel = null;
  opened = false;
}
