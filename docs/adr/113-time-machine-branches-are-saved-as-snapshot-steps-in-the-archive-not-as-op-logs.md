# ADR-113: Time Machine branches are saved as snapshot steps in the archive, not as op logs
Date: 2026-11-28   Status: **Proposed**, draft, Chris decides (`adr/113-time-machine`)   Relates to: ADR-003, ADR-086, ADR-088, ADR-112, ticket #8

## Context

History forks (ADR-086, a Beta) keep the redo tail an edit-after-undo would
drop, as a `Branch { id, label, fork_node, steps: Vec<Snapshot> }`, listed
under History as the Time Machine. Branches live **in memory only**: a reload
loses every one, and the ADR lists that as the feature's main cost.

ADR-112 (archive v7) gave each saved undo step its full layer stack, and
reserved a `BRCH` section beside `STEP` so this record would not be redesigned
for #8 (ADR-112 §7). This ADR says how a branch uses that slot, whether the op
log has to change, and when the Beta can come off.

Three facts from the code (master `6440463`):

- **Branches are snapshots, not logs.** `Branch::steps` are `Snapshot`s, the
  same structure as undo steps. ADR-052's "a branching history needs cheap
  branches" was about LOG-backed branches; ADR-086 chose snapshot-backed ones
  on purpose, inside the 512 MB undo budget.
- **The op log is linear.** `OpLog::append` with the cursor rewound drops the
  tail (truncate-on-branch). Its Dexie tables already carry a `branch` column
  (`opLogs: [photoId+branch+chunkSeq]`, `keyframes: [photoId+branch+atOp]`,
  always `"main"`, ADR-003), but `oplogManifests` is keyed by `photoId` alone,
  so one log per branch would need a new manifest key: a Dexie `.version()`
  bump.
- **`Snapshot::node` is per session.** Minted by `History`, never persisted.
  A saved branch cannot name its fork by node.

## Decision (proposed)

### 1. A branch is saved in the archive's `BRCH` section, as steps

```text
  BRCH: branch_count(4) {
          label
          fork_kind(4)  fork_index(4)     -- where it hangs, see 2
          step_count(4) { the STEP record for one step } × n
        } × N
```

Each step is ADR-112's per-step record, against the **same PNG pool** as
`STEP`. A branch step whose pixels equal an undo step's costs no pixel bytes
(the common case: a branch is usually a few steps of shapes or adjustments).
Locally: `SavedEdit.branches?: { label, fork, steps: SnapEntry[] }[]`,
optional, no Dexie bump.

Written by `capture_state` (frame v4, transport only) when history forks are
ON and branches exist; with forks off the section is absent and the archive is
byte-for-byte ADR-112's.

### 2. A branch names its fork by position in this archive

`fork_kind` 0 = undo step `fork_index`, 1 = redo step `fork_index`, 2 = the
live document, 3 = step `fork_index` of an earlier branch in this section (the
DAG case `take_branch` already walks). The writer maps `fork_node` to that
position at save time; a branch whose fork isn't in the saved history (it was
trimmed) is not saved. On restore, nodes are minted fresh and the branch is
re-anchored to the restored step's node.

### 3. The op log stays as it is: no v18

Branches are snapshot steps, so nothing about the op log or its persistence
changes. A resume from the op log (the usual path) restores the main timeline
from the log and the branches from the saved edit record, which is written on
every save beside the log. If the record is older than the log (a save in
flight), branches whose fork can't be found are dropped, not guessed.

Rejected: **op-log branches** (one log per branch under the existing `branch`
column). Cheaper per branch for long pixel histories, but it needs a manifest
keyed by `[photoId+branch]` (a Dexie bump and an upgrade function), a branch
table, and replay for every branch restore. Worth it only if snapshot branches
are measured too big.

### 4. Archive version

`version 8, compat 7`. v9.84 (ADR-112's reader) reads a v8 archive and skips
`BRCH`: the user loses the branches on that device, never the edit. A v9.84
save over it writes v7 and drops them; branches are evicted first anyway
(ADR-086), so this matches how the feature already treats them.

### 5. When the Beta comes off

All of these, in order:

1. Branches survive a reload (this ADR), e2e on both resume paths.
2. Measured on a 24 MP photo: save bytes and time with 12 branches, and
   memory after a restore against the 512 MB budget.
3. Four weeks in the Beta ring with no "the editor got heavy" report
   (ADR-086's pre-mortem sign) and no "Cloud archive could not be read" in
   Diagnostics.
4. The Time Machine list keyboard- and screen-reader-checked (it is a list of
   buttons today).

Then the default flips to ON in `lib/historyForks`, and Settings › Beta keeps
an Off switch for one release.

## Consequences

+ A branch outlives a reload, which is the one cost ADR-086 called the
  feature's main one.
+ No op-log change and no Dexie change.
- Saves with branches are bigger; bounded by the undo budget (branches share it
  and go first).
- A third reader of the STEP record encoding (undo, redo, branch steps), which
  is why it is one function, not three.

## Pre-mortem

Six months later this was a mistake because people with long pixel histories
kept 12 branches of full-size steps and every save carried them: autosave got
slow on exactly the users who like the feature. Warning sign: capture bytes per
save with forks on, against forks off, on the same document.
