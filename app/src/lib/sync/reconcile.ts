// The one decision the sync layer makes, as a pure function.
//
// Everything else in app/src/lib/sync is plumbing — a channel, a store, a
// Convex subscription. This is the part that can be WRONG in a way the user
// notices: it decides, for one document, whether this device takes the
// server's copy or the server takes this device's. It has no imports on
// purpose, so `reconcile.test.ts` can enumerate the cases without a browser,
// a store or a network.

/** What this device knows about a document, FOR ONE ACCOUNT. Everything but
 *  `value` and `format` is kept per account (see ledger.ts), so a second
 *  person signing in on the same browser starts from nothing. */
export interface LocalDocState {
  /** Canonical JSON of the value the app is currently showing. */
  value: string;
  /** The server revision this device's value is based on: the last one it
   *  adopted, pushed or agreed with. 0 ⇒ none yet. */
  rev: number;
  /** When the pending change was made (this device's clock). Only meaningful
   *  while `dirty`. */
  updatedAt: number;
  /** True when the user changed this document on this device, while signed in
   *  to this account, the server has not been told yet, AND the app still
   *  holds that value. Survives a reload (ledger.ts). Cleared by a successful
   *  push, by adopting, or by a forget that is newer than the change. */
  dirty: boolean;
  /** True once this device has reconciled this document with this account at
   *  least once. False is FIRST CONTACT: a new sign-in, or a different person
   *  signing in on the same browser. */
  seen: boolean;
  /** This build's format for the document. */
  format: number;
}

/** What the server currently holds, or `null` when the account has no row. */
export interface RemoteDocState {
  /** Canonical JSON — the server's blob re-serialized through THIS build's
   *  parser, so a blob that differs only in a field this build does not know
   *  compares equal. `null` when the document was forgotten ("Forget the
   *  synced copy") or when its blob could not be read at all. */
  value: string | null;
  rev: number;
  /** Server clock (`Date.now()` inside the Convex mutation). */
  updatedAt: number;
  /** Format of the build that wrote it. 0 for a forgotten document. */
  format: number;
}

export type SyncAction =
  /** Agreed, or nothing to agree on: record the server's revision and clear
   *  any pending change. */
  | "idle"
  /** Take the server's copy: write it into the app and stop owing a push. */
  | "adopt"
  /** Send this device's copy to the server, on top of the remote revision. */
  | "push"
  /** Touch nothing, this pass. The snapshot is older than what this device
   *  already knows, or the pending change cannot be sent over a newer format
   *  (see the note under the rules). */
  | "hold";

/**
 * Decide what one document should do. The rules, in order:
 *
 *  1. NO ROW → push if this device owes a change, otherwise nothing. An
 *     account is never SEEDED from a device that has not changed anything:
 *     that is the rule the pre-ADR-061 code had ("server wins on load, push on
 *     apply"), and seeding from whichever device was online is what let a
 *     forgotten copy come straight back.
 *
 *  2. A STALE SNAPSHOT → hold. `remote.rev < local.rev` means this device has
 *     already pushed or adopted something newer than what the query is
 *     showing — typically the query result from before this device's own
 *     push, still on screen because React has not re-rendered. Acting on it
 *     would adopt the pre-push value: the "revert flicker".
 *
 *  3. FIRST CONTACT → adopt (or nothing, if there is nothing to adopt). A
 *     device that has never synced with this account takes the account's
 *     copy, pending change or not. Pushing instead is how a never-used
 *     browser's defaults overwrote an account on sign-in, and how person A's
 *     unsent change could land in person B's account.
 *
 *  4. SAME VALUE → idle. Compared as strings, not hashes: the blobs are under
 *     a couple of kilobytes and both sides go through the same canonical
 *     writer, so equality is exact and a hash could only add a collision that
 *     would read as "my change didn't sync".
 *
 *  5. FORGOTTEN → nothing, unless this device holds a change the forget does
 *     not cover. It covers a change made BEFORE it — the user deleted the
 *     shared copy after making it — so that change is dropped rather than
 *     used to bring the copy back. A change made after it is pushed.
 *
 *  6. NOT DIRTY → adopt. This device has no pending change, so a difference
 *     means another device changed it.
 *
 *  7. DIRTY, and NOBODY ELSE HAS WRITTEN since this device's base revision
 *     (`remote.rev === local.rev`) → push. The remote is this device's own
 *     previous write, or what it last adopted; the local change is newer by
 *     construction, whatever either clock says. Deciding this case by
 *     timestamp is what made a second quick edit revert to the first, and a
 *     slow device clock widen the window.
 *
 *  8. DIRTY, and ANOTHER DEVICE HAS WRITTEN since → a real conflict, settled
 *     by timestamp: the more recent change wins. This is the parked-tab case:
 *     a laptop left open offline wakes up holding a change from yesterday,
 *     and the phone has been used since.
 *
 *     ⚠️ This compares TWO CLOCKS — the local `Date.now()` against the Convex
 *     server's. It is a tiebreak, not a guarantee, and after rule 7 it is
 *     reached only when two devices genuinely both changed the document. A
 *     device whose clock is badly wrong can lose a pending change (skewed
 *     slow) or win one it should not (skewed fast). The damage ceiling is one
 *     preference blob, re-toggleable, never pixels.
 *
 * Wherever this says push, a remote written by a NEWER FORMAT turns it into
 * hold: that build knows fields this one does not, and a push would erase
 * them. The change stays pending (in ledger.ts, so across a reload), and is
 * reconciled again once this device runs the newer build — which reads the
 * pending value in its own format and can send it without losing anything.
 */
export function reconcile(local: LocalDocState, remote: RemoteDocState | null): SyncAction {
  if (!remote) return local.dirty ? "push" : "idle";
  if (remote.rev < local.rev) return "hold";
  if (!local.seen) return remote.value === null || remote.value === local.value ? "idle" : "adopt";
  if (remote.value === local.value) return "idle";

  const push: SyncAction = remote.format > local.format ? "hold" : "push";

  if (remote.value === null) {
    if (!local.dirty) return "idle";
    if (remote.rev === local.rev || local.updatedAt >= remote.updatedAt) return push;
    return "idle"; // the forget is newer than the change: honor it
  }

  if (!local.dirty) return "adopt";
  if (remote.rev === local.rev) return push;
  if (remote.updatedAt > local.updatedAt) return "adopt";
  return push;
}
