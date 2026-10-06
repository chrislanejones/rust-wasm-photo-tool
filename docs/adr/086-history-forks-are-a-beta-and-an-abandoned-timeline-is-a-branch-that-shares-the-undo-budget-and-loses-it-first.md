# ADR-086: History forks are a Beta, and an abandoned timeline is a branch that shares the undo budget and loses it first
Date: 2026-10-06   Status: draft   Relates to: ADR-052, ADR-064, ADR-006, ADR-024

## Context

Backlog item **#8, "Time Machine DAG"**. A branch of 09-24-2026
(`claude/nice-euler-gsbn1n`) built it and was never merged; it fell 105
commits behind and conflicted in 17 files. This ADR ports that design onto
today's master, with one change: it ships **behind a Beta switch, off by
default** (ADR-064, ring 2).

The case for the feature is unchanged. `History::push` ends in
`redo_stack.clear()`: undo three steps, move a slider, and three documents the
user made are freed with no record and no way back. The states exist in memory
at the moment they are dropped. Keeping them costs nothing at that instant;
only holding them costs.

ADR-052 placed #8 behind item 37 (op-log recording) because "a branching history
needs cheap branches". That holds for a LOG-backed branch, which is still not
available (6 of 67 operations recorded). It does not hold for a
SNAPSHOT-backed one, whose cost is in a currency the engine already spends and
bounds: `DEFAULT_MAX_HISTORY_BYTES`, 512 MB.

Why a Beta and not everyone: the change sits on `push`, which is every edit in
the app, and the only thing that has judged the feature is its own tests. The
ring exists so a few people can live with it before everyone does.

## Decision

**1. The switch is in the engine, and OFF is master's behavior.**
`History::forks: bool`, default `false`, set by `set_history_forks(bool)`.
JS sets it from `ih_history_forks` (`?beta=history-forks`, Settings › Beta) on
every engine `createLiveEngine` returns, and again on toggle. Off, `push`,
`delete_entry` and the clone-stamp `begin_stroke` clear the redo stack exactly
as before, and the branch store stays empty so `trim()` runs master's loop step
for step. Turning it off forgets every held branch.

Node ids (below) are minted whether the switch is on or off, so turning it on
mid-session anchors correctly to states made before.

**2. A branch is anchored to a NODE, not a depth.** Every `Snapshot` carries a
`node: u64`, minted by `History` and carried through undo and redo. After one
fork, "undo index 4" names two different documents; a depth-anchored restore
would graft onto whichever is there, silently.

**3. The DAG is walked.** A fork may sit inside another branch's steps (undo,
edit, undo further, edit again). `take_branch` takes the parent first, then
splices, by moves, never clones. Every exit after the parent is taken returns
the state the stacks actually describe.

**4. Branches share the undo budget and are evicted first.** Same 512 MB,
strict priority: `trim()` drops branches, oldest first (max 12), before a
single undo step. Total memory, undo depth and ADR-052's "Undo NN%" readout are
unchanged by a branch being held.

**5. Nothing persisted.** Branches live in engine memory and go with the
document. No Dexie change, no op-log change, `OP_FORMAT_VERSION` untouched.
Taking a branch marks a live op log stale, exactly as snapshot undo does.

**6. UI under History, through a store.** A "Time Machine" list inside the
History section of the Review panel, hidden when empty. AppShell is at its
max-lines cap, so the list and its two actions reach the panel through
`useHistoryBranchStore`: `syncState` publishes the list from the same
`capture_ui_state()` as `history` (new field `branches_json`, a constant `"[]"`
when nothing is held), and `useHistory` registers the actions.

## Consequences

+ With the Beta on, the states an edit-after-undo used to free are kept and
  re-enterable, and travel is reversible.
+ With it off, behavior is master's. Tested at the `History` and engine level
  and in e2e.
+ Snapshots have identity, which a persisted, op-log-backed DAG would need.
- **Invisible where photos are biggest.** At 24 MP one step is ~192 MB, a
  branch never fits, and the list stays empty. Rule 4 doing its job; it will
  read as "it doesn't work" to whoever meets it there first.
- A branch whose fork is trimmed off the undo stack disappears on its own.
- Reload loses every branch, and the panel does not say so.
- Engine +14,974 B (870,406 → 885,380) for the branch store, the splice and six
  exports. Paid by everyone, Beta on or off.
- `capture_ui_state()` gained a String field, so every sync copies two more
  bytes out of wasm memory with the Beta off.

## Alternatives rejected

1. **Ship it on for everyone (the 09-24 branch as written).** Nothing but tests
   has judged it, and it sits on every edit.
2. **Gate in JS only** (JS reads the flag and calls a different method). The
   decision "clear or keep" is made inside `push`, so the engine has to know.
3. **Wait for item 37** and build on the op log. Keeps dropping the states.
4. **Anchor to undo depth.** Wrong after the second fork, silently.
5. **A separate memory budget for branches.** Costs undo depth and makes the
   "Undo NN%" readout lie.
6. **New props through AppShell.** It is at its cap and being dismantled.

**Pre-mortem warning sign:** a report of the editor getting slow or heavy that
mentions undoing a lot, from someone with the Beta on. `Snapshot::bytes` omits
layer masks, and a branch store multiplies whatever that estimate misses.
