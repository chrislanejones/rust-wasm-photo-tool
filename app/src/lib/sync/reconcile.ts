// The one decision the sync layer makes, as a pure function.
//
// Everything else in app/src/lib/sync is plumbing — a channel, a store, a
// Convex subscription. This is the part that can be WRONG in a way the user
// notices: it decides, for one document, whether this device takes the
// server's copy or the server takes this device's. It has no imports on
// purpose, so `reconcile.test.ts` can enumerate the cases without a browser,
// a store or a network.

/** What this device knows about a document right now. */
export interface LocalDocState {
  /** Canonical JSON of the value the app is currently showing. */
  value: string;
  /** Server revision this device last saw. 0 ⇒ never synced. */
  rev: number;
  /** When `value` last changed here (this device's clock). */
  updatedAt: number;
  /** True when the user changed this document on this device and the server
   *  has not been told yet. Cleared by a successful push or by adopting. */
  dirty: boolean;
}

/** What the server currently holds, or `null` when the account has no row. */
export interface RemoteDocState {
  value: string;
  rev: number;
  /** Server clock (`Date.now()` inside the Convex mutation). */
  updatedAt: number;
}

export type SyncAction =
  /** Already agreed — record the revision and clear any dirty flag. */
  | "idle"
  /** Take the server's copy: write it into the app and stop owing a push. */
  | "adopt"
  /** Send this device's copy to the server. */
  | "push";

/**
 * Decide what one document should do. The rules, in order:
 *
 *  1. NO REMOTE ROW → push. The account has never held this document, so this
 *     device seeds it. On a brand-new account the first device to get here
 *     wins, which is the same "server wins on load" rule every later device
 *     then follows.
 *
 *  2. VALUES EQUAL → idle. Compared as strings, not hashes: the blobs are
 *     under a couple of kilobytes and both sides serialize through the same
 *     canonical writer, so equality is exact and a hash could only add a
 *     collision that would read as "my change didn't sync".
 *
 *  3. NOT DIRTY → adopt. This device has no pending change, so a difference
 *     means another device changed it. Taking the server's copy is what makes
 *     two devices show the same thing.
 *
 *  4. DIRTY, BUT THE REMOTE IS NEWER → adopt. The local change never reached
 *     the server AND someone changed the document elsewhere afterwards. This
 *     is the parked-tab case: a tab left open offline for a day would
 *     otherwise wake up and overwrite a whole day of changes made on the
 *     phone with the value it was holding when it lost connection.
 *
 *     ⚠️ This compares TWO CLOCKS — the local `Date.now()` against the Convex
 *     server's. It is a tiebreak, not a guarantee: a device whose clock is
 *     badly wrong can lose a pending change (skewed fast) or win one it
 *     should not (skewed slow). The alternative — arrival order alone — gets
 *     the parked-tab case wrong every single time rather than rarely, which
 *     is why this is the tiebreak that ships. A document is at most one
 *     user-visible preference blob, never pixels, so the worst case is a
 *     setting to re-toggle.
 *
 *  5. OTHERWISE → push. The user changed it here, most recently. That is the
 *     value everything else should show.
 */
export function reconcile(local: LocalDocState, remote: RemoteDocState | null): SyncAction {
  if (!remote) return "push";
  if (remote.value === local.value) return "idle";
  if (!local.dirty) return "adopt";
  if (remote.updatedAt > local.updatedAt) return "adopt";
  return "push";
}
