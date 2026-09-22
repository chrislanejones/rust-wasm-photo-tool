// The sync layer: one value, shown the same way in every tab and on every
// signed-in device.
//
// ── SHAPE ────────────────────────────────────────────────────────────────────
//
//   docs.ts        the three documents — prefs, ui, tools
//   syncedDoc.ts   what a document is: a canonical string, plus the glue to
//                  the ledger; adopting a value is never an edit
//   ledger.ts      per account, kept across reloads: the revision a value is
//                  based on, and whether the server is still owed a write
//   channel.ts     cross-TAB transport (BroadcastChannel, same profile)
//   leader.ts      which tab talks to the server — the tab-claim holder
//   useCloudSync   cross-DEVICE transport (one Convex query + one mutation)
//   reconcile.ts   the only decision: adopt, push, hold, or nothing
//   status.ts      what it is doing, for the UI to show
//   enabled.ts     this device's on/off switch — off behaves as signed out
//
// ── THE TWO HOPS ARE NOT THE SAME HOP ────────────────────────────────────────
//
// Cross-tab is instant, needs no account, and works offline: it is the only
// sync a signed-out user gets, and it is a real one. Cross-device needs the
// Clerk/Convex pair and rides Convex's reactive query, so another device's
// change arrives without polling and without a reload.
//
// Both land through the same `adopt` on the same document, so there is one
// code path by which app state changes from outside — which is what makes
// "the laptop and the phone show the same thing" testable rather than hoped
// for.
//
// ── WHAT IS NOT SYNCED ───────────────────────────────────────────────────────
//
// Pixels. See the long note at the top of docs.ts and ADR-061: the archive is
// a different problem and is blocked on an open op-log bug. Nothing in this
// directory reads a photo, an original or a layer.
export { SyncProvider } from "./SyncProvider";
export { useSyncEnabled, setSyncEnabled } from "./enabled";
export { sendThisDevice } from "./useCloudSync";
export { useSyncStatus, type SyncStatus, type SyncState } from "./status";
export { SYNC_KEYS, type SyncKey } from "./keys";
