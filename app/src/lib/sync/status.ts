// What the sync layer is doing, as one observable value.
//
// Sync that works is invisible, which is also how sync that is broken looks.
// This is the difference: a single status any part of the UI can read (today
// Settings → General), so "my laptop never got it" has an answer on screen
// instead of in the Diagnostics log.
import { useSyncExternalStore } from "react";
import type { SyncKey } from "./keys";

export type SyncState =
  /** Convex/Clerk are not configured in this build — there is no cloud half.
   *  Tabs still sync with each other. */
  | "disabled"
  /** Signed out. Cross-tab only, which is the supported logged-out path and
   *  not a degraded one. */
  | "local"
  /** Signed in, waiting for the account's documents to arrive. */
  | "connecting"
  /** Signed in, and another tab on this device is the one talking to the
   *  server (the tab holding the "Use Image Horse here?" claim). This tab
   *  follows along over the cross-tab channel. */
  | "standby"
  /** A document is being adopted or pushed right now. */
  | "syncing"
  /** Every document agrees with the server. */
  | "synced"
  /** The last attempt failed. Local state is intact, and so is the record
   *  of what is still owed (ledger.ts); `willRetry` says whether a timer will
   *  try again or the server refused it outright. */
  | "error";

export interface SyncStatus {
  state: SyncState;
  /** When this device last agreed with the server, or null. */
  lastSyncedAt: number | null;
  /** Documents this device still owes the server. */
  pending: SyncKey[];
  /** Message from the last failure, cleared by the next success. */
  lastError: string | null;
  /** In the "error" state: true when a backoff timer will retry, false when
   *  the server refused the write permanently and only a new change (or a
   *  reload into a fixed build) will try again. */
  willRetry: boolean;
}

const INITIAL: SyncStatus = {
  state: "disabled",
  lastSyncedAt: null,
  pending: [],
  lastError: null,
  willRetry: false,
};

// One frozen object, replaced wholesale on every change. useSyncExternalStore
// compares snapshots by identity, so mutating this in place would render
// nothing; returning a fresh object on every read would render forever.
let status: SyncStatus = INITIAL;
const listeners = new Set<() => void>();

function getSyncStatus(): SyncStatus {
  return status;
}

export function setSyncStatus(patch: Partial<SyncStatus>): void {
  const next = { ...status, ...patch };
  if (
    next.state === status.state &&
    next.lastSyncedAt === status.lastSyncedAt &&
    next.lastError === status.lastError &&
    next.willRetry === status.willRetry &&
    next.pending.length === status.pending.length &&
    next.pending.every((k, i) => k === status.pending[i])
  ) {
    return; // nothing moved — don't wake every subscriber
  }
  status = Object.freeze(next);
  for (const listener of listeners) listener();
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

// Server snapshot: there is no sync during SSR/prerender, and the marketing
// prerender step renders app-adjacent modules. A stable constant keeps
// useSyncExternalStore from throwing there.
function getServerSnapshot(): SyncStatus {
  return INITIAL;
}

/** Live sync status. Re-renders only when the status actually changes. */
export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(subscribe, getSyncStatus, getServerSnapshot);
}
