# ADR-065: An abandoned timeline is kept as a branch anchored to a node, sharing the undo budget and losing it first
Date: 2026-09-24   Status: draft

## Context

Backlog item **#8, "Time Machine DAG"**, has sat under *not doing* with no ADR
and no recorded reason. ADR-052 guessed at the reason while surveying the op
log, and said so out loud:

> it is almost certainly why **#8 (Time Machine DAG)** sits under "not doing"
> with no ADR and no recorded reason — a branching history needs cheap
> branches, and snapshot undo gives about five steps on a 24 MP photo. You
> cannot build a DAG on a log that goes permanently stale the first time
> somebody moves a slider.

That is half right, and the half it gets wrong is the half that was blocking
the feature. Read the two claims separately:

1. **A DAG needs cheap branches.** True, and unchanged: the op log records 6
   of 67 operations (ADR-052), so a log-backed branch — a few kilobytes of ops
   that replays into any state on demand — is not available and will not be
   until item 37 is paid down.
2. **Therefore a DAG cannot be built.** False. A branch made of *snapshots* is
   expensive, but it is expensive in a currency the engine already spends and
   already bounds: `DEFAULT_MAX_HISTORY_BYTES`, 512 MB. The question is not
   "can we afford branches" but "**what does a branch displace**" — and the
   answer can be *nothing*, if branches are made to lose every contest against
   the undo stack.

There is a second thing the survey did not notice, and it is the reason this is
worth a session rather than a `TODO`: **the data is already being thrown away
on purpose.** `History::push` ends in `redo_stack.clear()`. Undo three steps,
move a slider, and three documents the user made are freed with no warning, no
record and no way back. Every editor does this, so it reads as physics rather
than as a decision — but the states exist, in memory, at the moment they are
dropped. Keeping them costs nothing *at that instant*; only holding them costs.

## Decision

**Editing after an undo forks the history instead of truncating it.** The
abandoned redo tail becomes a `Branch`, listed in a "Time Machine" list under
History, and taking a branch is reversible because the timeline it displaces
is archived the same way.

Four things make that safe to ship on today's snapshot history:

**1. A branch is anchored to a NODE, not to a depth.** Every `Snapshot` gets a
`node: u64`, minted by `History` and carried *through* undo and redo, so a
document state keeps one identity however often it moves between the stacks.
`Branch::fork_node` names the state it hangs off.

Depth was the obvious anchor and it is wrong in a way that would have shipped:
after one fork, "undo index 4" names two different documents, and a branch
restored by depth grafts onto whichever one happens to be there. Silently. The
node id is the difference between a DAG and a fan of wrong answers
(`a_branch_that_forks_from_inside_another_branch_is_still_reachable` is the
test that fails without it).

**2. The DAG is a DAG, not a depth-1 fan.** A branch's fork may live inside
*another branch's* steps — undo, edit, undo further, edit again. `take_branch`
walks that: it materialises the parent branch first, then splices. The walk is
by moves, never clones, and terminates because each level removes one branch
from the store.

**3. Branches share the undo stack's byte budget and are evicted first.** Not a
second budget — the same 512 MB. `trim()` drops branches, oldest first, before
it will drop a single undo step. So:

- total memory is bounded by exactly what bounded it before branches existed;
- undo depth is never one step shorter because a branch was kept;
- the status bar's "Undo NN%" (ADR-052's part 2), which divides that same
  budget by one whole-image copy, stays true without being touched.

The cost lands where it should. On a 24 MP photo one step is ~192 MB, there is
no slack, and a fork does not survive its own creation — the Time Machine is
simply empty there. On the small and medium documents where people actually
experiment, there is room for several. A feature that degrades to *nothing* is
the right shape for one whose budget is already spoken for.

**4. Nothing is dropped silently anywhere else either.** `begin_stroke` used to
take `&mut Vec<Snapshot>` and call `.clear()` — the one remaining path that
could discard a fork — and now takes the `History` and archives it.
`delete_history_entry` archives its tail too. `clear_history` clears branches,
because rows that fork from a history that no longer exists cannot be taken.

The engine surface is four methods (`history_branch_count`,
`history_branches_json`, `restore_history_branch`, `delete_history_branch`),
and the list rides on `capture_ui_state` as an eleventh field so the panel is
right after every history move without a second sync path.

## What this does NOT do — and why item 37 still matters

This is the Time Machine over **snapshots**. It is not the op-log DAG:

- **It does not survive a reload.** Branches are in memory; the persisted log
  (ADR-006) has a `branch` column reserved and this writes nothing to it.
- **It is not cheap.** A branch is full document copies. Item 37 (recording the
  other 61 operations) is what would make a branch a few kilobytes of ops, and
  with it the Time Machine would work on a 24 MP scan instead of quietly
  holding nothing.
- **Taking a branch marks a live op log stale**, exactly as undo through the
  snapshot path already does (`restore_snapshot`). An append-only log cannot
  describe a jump between timelines.

So item 37 is still the unlock, and ADR-052's proposal (part 3) still stands on
its own reasoning. What changes is that #8 is no longer *behind* it: the useful
half of the feature did not need it, and shipping this half makes the other
half's value concrete instead of hypothetical.

## Consequences

+ The states an edit-after-undo used to free are kept, listed and re-enterable.
+ Travel is reversible: taking a branch archives the timeline it displaced, so
  there is always a way back and it is a row in the same list.
+ Undo, redo, undo depth, the byte ceiling and the "Undo NN%" readout are
  behaviourally unchanged — branches are pure slack-filling.
+ Snapshots have identity now, which is the piece a persisted, op-log-backed
  DAG would need anyway.
- **The feature is invisible exactly where photos are biggest.** On a 24 MP
  document the store is empty because a branch never fits. That is the honest
  outcome of rule 3, and it will read as "the Time Machine doesn't work" to
  anyone who meets it there first.
- A branch whose fork state is trimmed off the front of the undo stack is
  pruned — the row disappears without the user doing anything to it.
- `MAX_BRANCHES` is 12. Past that, the oldest fork is forgotten silently.
- Nothing is persisted, so a reload still loses every branch, and the panel
  gives no hint that it will.
- `push` is now on every edit's path *and* has a branch store to maintain. The
  work is a `Vec` move and a small retain, but it is new work in the hottest
  history path in the app.

## Alternatives rejected

1. **Wait for item 37 and build the DAG on the op log.** The end state, and the
   reason this ADR exists is that it is not the *only* state. Waiting keeps
   shipping nothing while the states keep being dropped.
2. **Anchor branches to undo depth.** Simpler by about thirty lines, and wrong
   after the second fork (see Decision 1). It fails silently, which is the
   worst way for a history feature to fail.
3. **Give branches their own memory budget.** Then a branch can cost the user
   undo depth, the "Undo NN%" readout starts lying, and the feature has to be
   explained in the settings. Sharing one budget with a strict priority needs
   no dial and no explanation.
4. **Keep only the branch tip.** A third of the memory, and it turns a timeline
   into a bookmark: you could jump there, but not undo *within* it, and the
   step count that makes a row meaningful would be a lie.
5. **A fifth panel section.** The Review panel allows three open sections at
   once and evicts one to open a fourth. The Time Machine is history that is
   not on this path, so it belongs under History, where it is also invisible
   when empty.

## Pre-mortem

It is six months later and this was a mistake. The most likely reason: **memory
on mid-size photos.** The budget arithmetic is correct and the eviction order
is tested, but `Snapshot::bytes` is an estimate that already omits layer masks
(ADR-052's amendment says so), and a branch store multiplies whatever that
estimate gets wrong. The symptom would be a tab that gets slower and heavier
during a long experimenting session on a 6 MP photo — the exact session this
feature is for.

Second candidate: **the Time Machine is a list of things nobody can name.** A
row says "Crop · 4 steps". Two rows say "Crop · 4 steps". There are no
thumbnails, and the labels come from an op name rather than from anything the
user chose.

Early warning sign for the first: a bug report about the editor getting heavy
that mentions undoing a lot. For the second: a user asking which "Crop" is
which — or the list being ignored entirely, which is harder to see and more
likely.
