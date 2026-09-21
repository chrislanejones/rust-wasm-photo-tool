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
- **One decision, pure.** `reconcile(local, remote)` returns `adopt`, `push` or
  `idle` and imports nothing. Every sync bug this design can still have is a
  bug in that function, which `reconcile.test.ts` enumerates, rather than a
  race between two effects that each thought they owned the document.
- **Equality is a string compare, not a hash.** The blobs are under a couple of
  kilobytes and both sides serialize through the same canonical writer. A hash
  could only add a collision, whose symptom would be "my change didn't sync".
- **A document is pushed only when locally DIRTY** — changed by the user on
  this device and never sent. Adopting clears the flag. So the losing side of a
  race is always an earlier change by the same user, which is what last-write-
  wins should discard.
- **Dirty crosses tabs.** A tab that adopts another tab's unsent change
  inherits the obligation to push it, so a change made in a background tab
  cannot be shown everywhere on the device and stored nowhere.
- **The ready gate.** Both zustand documents hydrate from IndexedDB
  asynchronously. Nothing reads or writes a document before its store has
  hydrated, and the store subscription is attached only afterwards — rehydration
  arrives as an ordinary store update, and a subscription attached earlier
  would read the user's own persisted settings landing from disk as a change
  they had just made, and push the laptop over the phone on every boot.

`users.settings` stays in the schema as the legacy prefs blob. A device seeds
the `prefs` document from it once, when the account has no `prefs` row, through
the same rules as any other remote document; after that it is dead for that
account.

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
  having it appear five times in files about preferences, colours and text is
  how it ends up five slightly different rules.
- **CRDT / per-field merge.** The right answer for two people editing one
  document at once. These are one person's preferences, where "the last thing I
  did wins" is what they actually expect, and where the merge machinery would be
  larger than everything it merges.
- **Compare-and-set with a conflict surfaced to the user.** A dialog asking
  which theme they meant is worse than silently taking the most recent one.
- **Sync the archive too, since the ask says "the same thing".** Blocked, on
  evidence, by the open op-log entry in `docs/PARKING_LOT.md`. It is also a
  different problem: megabytes rather than kilobytes, and a merge rule that
  cannot be last-write-wins because the loser's work is a painting.

## Pre-mortem (mandatory)

**It is March. A user reports that their laptop keeps reverting a setting they
change on their phone.** The cause is the clock: rule 4 in `reconcile` compares
a local `Date.now()` against the Convex server's, and the laptop's clock is
half an hour fast. Its unsent change therefore looks newer than everything the
phone sends, forever, so it pushes over each one.

*What mitigates it:* the window is narrow by construction — a document is only
a candidate for that rule while it is dirty, and a successful push clears
dirty within 600ms of the change. A laptop that is online cannot stay in the
state that exhibits this. The damage ceiling is also fixed: one preference
blob, re-toggleable, never pixels. And the rule is one line in a pure function
with no imports, so changing it to "arrival order always" is a one-line
revert with its own test — no migration, no stored data to fix up.

**Second walk: a document adopts something that crashes the editor.** A blob
from a future build carries a `masterTab` this build has no panel for.
*Mitigated:* every document's `parse` validates field by field against TODAY'S
unions — the same guard the zustand stores already apply on rehydrate — and a
blob that fails validation is rejected whole, leaving the device on its own
value. The channel protocol is versioned, so a message from a tab left open
across a deploy is dropped rather than parsed.

**Third: the layer becomes a write amplifier.** The zustand subscription fires
on every state change, including every dialog open. *Mitigated:* `changedLocally`
serializes and compares before doing anything, so only a change to a field the
document actually carries gets past it; the server skips the write when the
value is unchanged; and pushes are debounced 600ms.

## Consequences

- One place to add the next synced thing: a key in `lib/sync/keys.ts` and in
  `SYNC_KEYS` in `convex/sync.ts` (a test asserts they agree), plus one
  `defineSyncedDoc`. No table, no migration, no new Convex function.
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
  push — so it stays, labelled, in the schema and on the marketing
  `/architecture` page.
- **The line is load-bearing and is written down in three places** (this ADR,
  the head of `lib/sync/docs.ts`, the privacy policy). The next person asked to
  "sync the gallery too" needs to find the op-log entry in `PARKING_LOT.md`
  before they start, not after.
