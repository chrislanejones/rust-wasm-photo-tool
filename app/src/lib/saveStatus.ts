// Whether the last attempt to save the active canvas failed.
//
// ONE publisher, read by the status bar. It exists because "Couldn't save
// canvas changes" lived ONLY in a toast, and a toast is gone in four seconds —
// while the thing it reports lasts. An edit that failed to save stays unsaved
// until a later save succeeds; saying so once, briefly, is the wrong level for
// the one message in the app that means "your work may be lost". Night 5's
// feedback hierarchy: an error that needs action never lives only in a toast.
//
// The toast still fires (it is the moment you are told); this is what is still
// true afterwards. Only a successful save of the failed photo and save kind
// clears it; another photo's success does not recover these edits.
//
// Deliberately a module store and NOT a key on useUIStore. useUIStore persists
// through `partialize`, and a runtime error flag that slipped into it would
// survive a reload and report a failure that no longer exists. A module store
// cannot persist by construction. The shape mirrors lib/sync/status.ts, which
// the sync chip beside it already reads.
import { useSyncExternalStore } from "react";

export interface SaveStatus {
  /** At least one photo has a failed local save that has not recovered. */
  failed: boolean;
  /** Signed in: the last CLOUD copy of an edit did not upload. The local copy
   *  is on disk, so nothing is lost — but "backed up" is no longer true, and
   *  that used to live in the Diagnostics log only (Plan C §3). */
  backupFailed: boolean;
}

const INITIAL: SaveStatus = Object.freeze({ failed: false, backupFailed: false });

// One frozen object, replaced wholesale on every change — useSyncExternalStore
// compares snapshots by identity.
let status: SaveStatus = INITIAL;
const listeners = new Set<() => void>();
const localFailures = new Set<string>();
const backupFailures = new Set<string>();

function recordFailure(failures: Set<string>, failed: boolean, photoId?: string, kind = "canvas") {
  const key = JSON.stringify([photoId ?? "global", kind]);
  if (failed) failures.add(key);
  else if (photoId === undefined) failures.clear(); // legacy unscoped reset
  else failures.delete(key);
  return failures.size > 0;
}

function getSaveStatus(): SaveStatus {
  return status;
}

/** Record the outcome of a save. A no-op when nothing moved, so the steady
 *  state of "every save works" wakes no subscriber. */
export function setSaveFailed(failed: boolean, photoId?: string, kind = "canvas"): void {
  failed = recordFailure(localFailures, failed, photoId, kind);
  if (status.failed === failed) return;
  status = Object.freeze({ ...status, failed });
  for (const listener of listeners) listener();
}

/** Record the outcome of a cloud backup. Clears on the next one that lands. */
export function setBackupFailed(backupFailed: boolean, photoId?: string): void {
  backupFailed = recordFailure(backupFailures, backupFailed, photoId);
  if (status.backupFailed === backupFailed) return;
  status = Object.freeze({ ...status, backupFailed });
  for (const listener of listeners) listener();
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

// No saving happens during SSR/prerender; a stable constant keeps
// useSyncExternalStore from throwing there.
function getServerSnapshot(): SaveStatus {
  return INITIAL;
}

/** Live save status. Re-renders only when it actually changes. */
export function useSaveStatus(): SaveStatus {
  return useSyncExternalStore(subscribe, getSaveStatus, getServerSnapshot);
}
