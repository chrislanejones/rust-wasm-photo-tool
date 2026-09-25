// This device's sync switch: whether it talks to the account at all.
//
// ON by default, which is what signing in has always meant. OFF makes this
// device behave, for the sync layer, exactly as if it were signed out: it
// neither fetches the account's copy nor sends its own, and a change made
// while it is off is owed to nobody (ledger.ts files it under no account).
// Tabs on this device still follow each other — that hop needs no account,
// costs nothing and is what keeps a parked tab current, so it is not switched.
//
// TURNING IT BACK ON IS A FRESH START. Switching off forgets what this device
// knew about the account — the revision each document was at, and anything it
// still owed — so the next reconcile is FIRST CONTACT (reconcile.ts rule 3):
// the device takes the account's copy instead of pushing its own over it. That
// is the reset a person reaches for when sync looks stuck, and it is the only
// safe direction: a device that has been off for a week must not come back
// and overwrite what the phone did in that week. Sending THIS device's copy
// instead is a separate, explicit button (`sendThisDevice`).
//
// PER DEVICE, NEVER SYNCED. Like the online-features switch it is a choice
// about the device in front of you, and a synced "off" could never be turned
// back on from the device that received it — it would have stopped listening.
// Kept in localStorage beside the ledger rather than in a persisted zustand
// store: it is the sync layer's own bookkeeping, it must be readable
// synchronously before any store has hydrated, and every tab of the profile
// reads the same value.
import { useSyncExternalStore } from "react";
import { currentAccount, forgetAccount, setCurrentAccount } from "./ledger";

const ENABLED_KEY = "image-horse-sync-enabled";

// Fallback for blocked storage: the switch still works for this tab.
let memoryEnabled = true;
const listeners = new Set<() => void>();

function storage(): Storage | null {
  try {
    const ls = globalThis.localStorage;
    if (!ls) return null;
    ls.getItem(ENABLED_KEY); // reading is what throws when storage is blocked
    return ls;
  } catch {
    return null;
  }
}

/** Whether this device syncs with the signed-in account. */
export function isSyncEnabled(): boolean {
  const ls = storage();
  if (!ls) return memoryEnabled;
  try {
    return ls.getItem(ENABLED_KEY) !== "off";
  } catch {
    return memoryEnabled;
  }
}

function notify(): void {
  for (const listener of listeners) listener();
}

/**
 * Turn sync on or off for this device, in every tab of it.
 *
 * Off also drops this device's bookkeeping for the signed-in account, so that
 * turning it on again starts from first contact — see the header.
 */
export function setSyncEnabled(next: boolean): void {
  if (next === isSyncEnabled()) return;
  if (!next) {
    const account = currentAccount();
    if (account) forgetAccount(account);
    setCurrentAccount(null);
  }
  memoryEnabled = next;
  const ls = storage();
  try {
    if (next) ls?.removeItem(ENABLED_KEY);
    else ls?.setItem(ENABLED_KEY, "off");
  } catch {
    // Blocked storage: the in-memory copy above is what this tab uses.
  }
  notify();
}

/** Subscribe to the switch, in this tab and (via the `storage` event) in the
 *  others. Returns the unsubscribe. */
export function subscribeSyncEnabled(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === ENABLED_KEY || e.key === null) listener();
  };
  globalThis.addEventListener?.("storage", onStorage);
  return () => {
    listeners.delete(listener);
    globalThis.removeEventListener?.("storage", onStorage);
  };
}

/** The switch, live. */
export function useSyncEnabled(): boolean {
  return useSyncExternalStore(subscribeSyncEnabled, isSyncEnabled, isSyncEnabled);
}
