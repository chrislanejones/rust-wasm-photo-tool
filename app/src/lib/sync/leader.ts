// Which tab on this device talks to the server.
//
// Every open tab mounts the sync layer, and before this every one of them
// reconciled with Convex on its own: every change was pushed once per tab,
// and a failing push retried from every tab. One tab per device is enough —
// the others hear every change over the cross-tab channel anyway, and the
// shared ledger (ledger.ts) means whichever tab does the talking knows what
// the others owe.
//
// THE ELECTION IS THE TAB CLAIM. useTabClaim already decides which single tab
// may EDIT ("Use Image Horse here?"), and the tab the user is editing in is
// the one whose changes need sending — so the claim holder is the pusher, and
// there is no second election to disagree with the first. useTabClaim reports
// into this module; it is not re-implemented here, and its channel is not
// listened to twice.
//
// Default TRUE. A tab that has not mounted the claim hook yet (the first
// render of a fresh tab, which claims on mount anyway) or a browser without
// BroadcastChannel (where the claim cannot work and there is only ever one
// talker) must still sync. Two tabs both believing they lead for a moment is
// harmless: the server refuses a write based on a stale revision, and the
// loser re-reconciles.
//
// A PARKED TAB DOES NOT TALK. If the claim holder closes, nothing is pushed
// until another tab takes the claim — which is fine, because a parked tab
// cannot edit, and the pending change is in the ledger, not in the tab that
// closed.
let held = true;
const listeners = new Set<() => void>();

export function holdsTabClaim(): boolean {
  return held;
}

export function setHoldsTabClaim(next: boolean): void {
  if (next === held) return;
  held = next;
  for (const listener of listeners) listener();
}

export function subscribeTabClaim(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// "USE HERE" FROM OUTSIDE THE COVER. The Sync pane shows Send disabled in a
// standby tab, and offers the one thing that would make it work: take the
// claim. The claim itself is useTabClaim's, as above, so it registers its
// `claimHere` with this module and the pane calls through. A callback
// registry, not a window CustomEvent (forbidden) and not a second channel.
// No registered claimer (a runtime with no BroadcastChannel, a test) means
// there is no claim to take, and the call does nothing.
let claimer: (() => void) | null = null;

export function registerTabClaimer(fn: () => void): () => void {
  claimer = fn;
  return () => {
    if (claimer === fn) claimer = null;
  };
}

export function claimTabHere(): void {
  claimer?.();
}
