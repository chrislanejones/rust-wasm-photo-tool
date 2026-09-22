# ADR-061 — Sync is a document layer, and the archive is not in it

- **Status:** Draft
- **Date:** 2026-09-21
- **Deciders:** Chris
- **Supersedes:** —

## Context

"All my devices should show the same thing when I'm logged in — between tabs
and between devices."

Three things were true when that was asked.

**One.** Some of it already worked, by hand, three separate times.
`lib/preferences.ts` held its own Convex pull/push against `users.settings`,
with a SHA-256 to skip redundant writes and a "server wins on load" rule
written into a `useEffect`. `hooks/useUserColors.ts` and
`hooks/useRecentTexts.ts` each have their own Convex table and their own
reactive query. Each of the three solved the same three problems — a canonical
serialization, a validator for a blob written by another build, and a rule for
who wins — and solved them differently, in a file about something else.

**Two.** Cross-TAB was not solved anywhere. A preference set in one tab reached
the other only when signed in, only after a server round-trip, and only because
Convex's reactive query happened to deliver it. Signed out — the default,
supported path — it reached nothing until a reload. `useUserColors` listens for
the localStorage `storage` event, which does cross tabs but never fires in the
tab that wrote and carries nothing at all for state kept in IndexedDB, which is
where the two zustand stores live. The only thing in the repo that genuinely
crosses a tab boundary is `useTabClaim`'s BroadcastChannel, and its job is to
decide which tab may edit, not to carry state to the others.

**Three.** Replicating the photo archive is not available to be decided.
`docs/PARKING_LOT.md` says so directly: the op log breaks on any undo that goes
through the app's own flush path, and a sync engine that replicated archives
would copy an un-undone document to the second device and hand it back to the
first. The undo-durability half of that was fixed in PR #161; the op-log half
is still open.

So the decision is not "should state sync" but "what is the unit, and where is
the line".

## Decision

**A synced DOCUMENT is the unit: one named, canonically-serialized JSON blob,
replicated whole, last-write-wins.** There are three — `prefs`, `ui`, `tools` —
and they carry settings and remembered choices. The archive, the gallery and
anything keyed by a photo are explicitly outside the layer.

The shape, in `app/src/lib/sync/`:

- **Two hops, one adopt.** Cross-tab is a `BroadcastChannel` and is instant,
  needs no account and works offline — it is the only sync a signed-out user
  gets, and it is a real one. Cross-device is one reactive Convex query plus
  one mutation over a generic `sync_docs` table. Both land through the same
  `adopt` on the same document, so there is exactly one code path by which app
  state changes from outside.
- **One decision, pure.** `reconcile(local, remote)` returns `adopt`, `push`,
  `hold` or `idle` and imports nothing. Every sync bug this design can still
  have is a bug in that function, which `reconcile.test.ts` enumerates, rather
  than a race between two effects that each thought they owned the document.
- **Revisions decide; clocks only break real ties.** A pending change on top of
  the revision this device last saw is pushed, whatever either clock says; a
  snapshot older than that revision is ignored. Only when ANOTHER device has
  written since does the rule fall back to comparing timestamps.
- **The server checks the revision.** `sync:push` carries the revision the
  change was based on and is refused (a `conflict` result carrying the current
  row, never a throw) when the row has moved. The client re-reconciles against
  it. Convex queues mutations while offline and replays them on reconnect, so
  without this a laptop's day-old change landed on top of the phone's.
- **Equality is a string compare, not a hash.** The blobs are under a couple of
  kilobytes and both sides serialize through the same canonical writer. A hash
  could only add a collision, whose symptom would be "my change didn't sync".
- **A document is pushed only when locally DIRTY** — changed by the user on
  this device, signed in, and never sent. An account is never seeded from a
  device that changed nothing, and ADOPTING IS NEVER AN EDIT: a value written
  into the app from elsewhere does not count as a change even when this build
  re-serializes it differently (which is what made two builds trade one value
  forever).
- **The pending change lives in a ledger, per account** (`ledger.ts`,
  localStorage, shared by every tab of the profile). It survives a reload, it
  is filed under the Convex user id, and it records the VALUE owed rather
  than a flag, so it lapses the moment the device stops holding that value. A
  change made signed out is owed to nobody. A device's FIRST CONTACT with an
  account adopts the account's copy; it never pushes.
- **One tab per device talks to the server** — the tab holding the
  "Use Image Horse here?" claim (`useTabClaim` reports into `leader.ts`). The
  others are kept current over the channel. Failed pushes back off (5 s
  doubling to 5 min); a permanent refusal (unknown key, too large, signed out)
  is not retried on a timer at all.
- **Forget leaves markers, not holes.** `sync:clear` turns every document into
  a row with `value: null` and a bumped revision, and clears the legacy
  `users.settings` blob. A deleted row read as "never had one", and the
  online devices re-seeded it within one reactive tick.
- **Formats travel with the blob.** Each document has a format number on the
  channel message and on the row. A tab on another format is ignored; no
  build writes over a row from a newer format.
- **Navigation waits for the next load.** Which panel is open and which mode
  each tool is in are adopted from another device only at load (or when a tab
  takes the claim). Mid-session they are held in the document, not written
  into the store — a phone switching to the eraser must not change the
  laptop's next stroke. Preferences still apply live.
- **Consent does not travel.** `onlineFeaturesEnabled` is not in the `ui`
  document: it is agreement to send data from THIS device. And no device
  identifier is uploaded — the row has no `origin`.
- **The ready gate.** Both zustand documents hydrate from IndexedDB
  asynchronously. Nothing reads or writes a document before its store has
  hydrated, and the store subscription is attached only afterwards — rehydration
  arrives as an ordinary store update, and a subscription attached earlier
  would read the user's own persisted settings landing from disk as a change
  they had just made, and push the laptop over the phone on every boot.

`users.settings` stays in the schema as the legacy prefs blob. A device adopts
it, through the same rules as any other remote document, while the account has
no `prefs` row; the server stops offering it once any `prefs` row exists, live
or forgotten, and Forget clears it.

*Amended 09-21-2026, before merge, after review:* the first version decided
conflicts by timestamp alone, kept the pending flag in memory, pushed from
every tab, deleted rows on Forget, seeded accounts from any online device, and
synced the consent switch and the tool modes live. Each of those reverted or
resurrected a setting in a reproducible case; the bullets above are what
replaced them. The unit, the two hops and the archive line are unchanged.

## Alternatives considered

- **A table per synced thing, as `user_colors` and `recent_texts` already do.**
  Right when the shape is a list that is appended to and capped — a row per
  swatch is genuinely better than a blob. Wrong for a settings object, where it
  would be a column per preference and a migration per feature. Those two hooks
  are deliberately left alone rather than converted: moving them would be a
  data migration that buys nothing.
- **Keep the per-feature hand-rolled sync and just add BroadcastChannel to
  each.** Cheapest diff, and it makes the third copy of the reconcile rule into
  a fifth. The rule is the part that can be wrong in a way the user sees, and
  having it appear five times in files about preferences, colors and text is
  how it ends up five slightly different rules.
- **CRDT / per-field merge.** The right answer for two people editing one
  document at once. These are one person's preferences, where "the last thing I
  did wins" is what they actually expect, and where the merge machinery would be
  larger than everything it merges.
- **Compare-and-set with a conflict surfaced to the user.** The server does
  compare and set now, but a conflict goes back to the reconcile rule, not to a
  dialog: asking which theme they meant is worse than taking the most recent.
- **Dirty as a boolean, in memory.** What shipped first. Lost on reload, and a
  flag outlives the value it was about — on a shared browser, person B's
  settings could be pushed into person A's account.
- **Sync the archive too, since the ask says "the same thing".** Blocked, on
  evidence, by the open op-log entry in `docs/PARKING_LOT.md`. It is also a
  different problem: megabytes rather than kilobytes, and a merge rule that
  cannot be last-write-wins because the loser's work is a painting.

## Pre-mortem (mandatory)

**It is March. A user reports that their laptop keeps reverting a setting they
change on their phone.** The cause is the clock: rule 8 in `reconcile` compares
a local `Date.now()` against the Convex server's when two devices both changed
a document, and the laptop's clock is half an hour fast. Its unsent change
looks newer than the phone's, so it wins the tie.

*What mitigates it:* since the amendment the clock is consulted only for a
genuine conflict — both devices changed the document since the last revision
the laptop saw. A second edit on top of this device's own push is decided by
revision (rule 7), which is where the original version lost changes to a slow
clock. The damage ceiling is fixed: one preference blob, re-toggleable, never
pixels. And the rule is one line in a pure function, so changing it is a
revert with its own test.

**Also plausible: nothing is sent for a while.** Only the claim-holding tab
talks to the server. If that tab closes, the parked tabs stay quiet until one
of them is chosen with "Use here". Nothing is lost — the pending change is in
the ledger — but a user who never returns to a parked tab sees their other
device lag. Warning sign: "it only synced after I clicked Use here".

**Second walk: a document adopts something that crashes the editor.** A blob
from a future build carries a `masterTab` this build has no panel for.
*Mitigated:* every document's `parse` validates field by field against TODAY'S
unions using the store's own validator table — the one its `merge` runs on
rehydrate, asserted against `partialize` by `syncParity.test.ts` — and a blob
that fails validation is rejected whole. The channel protocol and each
document carry a version, so a message from a tab left open across a deploy
is dropped rather than parsed.

**Third: the layer becomes a write amplifier.** The zustand subscription fires
on every state change, including every dialog open. *Mitigated:* `changedLocally`
serializes and compares before doing anything, so only a change to a field the
document actually carries gets past it; the server skips the write when the
value is unchanged; and pushes are debounced 600ms.

## Consequences

- One place to add the next synced thing: a key in `lib/sync/keys.ts` and in
  `SYNC_KEYS` in `convex/sync.ts` (a test asserts they agree), plus one
  `defineSyncedDoc`. No table, no migration, no new Convex function.
- **Nothing ever deletes a `sync_docs` row.** Forget writes markers. A row
  deleted by hand in the dashboard restarts at rev 1 under devices that
  remember a higher one, and they will ignore it until it passes their number.
- A signed-out change is not sent when the user signs back in: the account's
  copy wins, as it did before this layer. That is the conservative direction
  (it cannot write one browser's state into an account), and it can revert a
  signed-out tweak.
- The ledger keeps a copy of any unsent setting, and the Convex user id, in
  localStorage. Local only; never uploaded.
- Signed-out users gain cross-tab sync they did not have. This is the supported
  default path and it is now better, not merely intact.
- `lib/preferences.ts` no longer imports Convex. It is importable by anything.
- **`rulerUnit` starts persisting.** It was on the `Preferences` interface and
  in `normalize` but missing from `serializePreferences`, which is the only
  writer localStorage has — so it has never survived a reload. Fixed here
  because the serializer is now the wire format too. Appended at the END of the
  canonical order: any other position changes every stored blob, which every
  signed-in device would read as "the other device changed something".
- The `users.settings` / `settingsHash` pair is legacy from this commit. It
  cannot be dropped — removing a field from a table with rows fails a Convex
  push — so it stays, labeled, in the schema and on the marketing
  `/architecture` page.
- **The line is load-bearing and is written down in three places** (this ADR,
  the head of `lib/sync/docs.ts`, the privacy policy). The next person asked to
  "sync the gallery too" needs to find the op-log entry in `PARKING_LOT.md`
  before they start, not after.

## Amended 09-22-2026 — a per-device off switch, and a Send button

v8.84, Win11 and Android signed in: `sync:pull` at three loads (9:30:54–
9:33:45), zero `sync:push`, zero `sync_docs` rows. That is the "never seeded from a device
that changed nothing" rule working as written, and invisible: the phone's
gallery-only shell showed no sync status at all.

- **A switch per device, never synced** (`lib/sync/enabled.ts`, localStorage
  `image-horse-sync-enabled`, absent = on). A synced "off" could never be
  turned back on from the device that received it. Off is signed out to this
  layer and the ledger forgets the account; cross-tab still runs. On again is
  first contact: the account's copy wins and anything still owed is dropped.
  That is the reset, and the safe direction.
- **Send is the one explicit exit from that rule.** `sendThisDevice()` owes
  every document as this device holds it, once each store hydrates (5 s cap).
  Shown only while `accountEmpty` (no live row, no legacy `users.settings`),
  only in the claim-holding tab.
- **Settings › Sync is its own tab** (`#/settings/sync`); the same `SyncPane`
  renders in the phone's settings sheet. Its controls commit at once, not on
  Apply. The privacy policy names the switch and the button.
- **Reversed:** `SyncStatusRow`'s "no on/off switch, sign out instead". Signing
  out also turns off shares, AI and billing, and offers no reset.
- **Cost:** two switches with opposite defaults (online features OFF, sync ON).
  `owe()` is a general "make this device the source", held back only by the
  button's `accountEmpty` gate. `ToggleButtonGroup` emits no `aria-pressed`, so
  the switch's state is visual-only to a screen reader (parked, every pane).
- 13 new tests, suite 1039/1039; four targeted mutations each turn a test red.
  *Warning sign:* an `owe()` / `sendThisDevice()` caller other than the Send
  button, or that button losing its `accountEmpty` gate.
