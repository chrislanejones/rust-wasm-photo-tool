# ADR-098: UI code names a history state by engine node + document revision, not by undo count
Date: 2026-10-27   Status: draft (#413, `fix/batch-crop-full-res`, night 10-27)   Relates to: ADR-086

## Context

Batch › Crop re-apply knew its last crop on the open photo by undo count
(`activeCrop = { undoCount, steps }`). Crop, undo, one new edit, and the count
matches again, so re-apply rewound the new edit instead of the crop
(CodeRabbit on #267, PARKING_LOT 09-29). Red on master: crop → undo → paint →
re-apply left `["Crop"]`, expected `["Paint","Crop"]`. In the same PR, the
non-active photos were cropped from the ≤2048 working copy, so 1:1 "Keep" on
a 4000×3000 photo gave 1536×1536.

## Decision

The engine exposes the identity it already keeps, `Snapshot::node` (ADR-086),
read-only: `history_node()` (wasm export) and a `history_node` field on
`capture_ui_state`. UI code names a state as `{ node, documentRevision }`,
since a load or restore rebuilds history. `activeCrop` stores `after`,
`before` and `steps`. Re-apply rewinds only when the live state IS `after`,
then checks it landed on `before`. If not, it redoes every step and crops
what is on screen. No op-log or `OP_FORMAT_VERSION` change.

Non-active photos are cropped from the stored original at full resolution
(`decodeRegion`: decode, read out only the crop, store, close the bitmap, one
photo at a time), writing existing fields (`originalKey`, `origWidth/Height`,
`workingWidth/Height`). No Dexie schema change.

## Consequences
+ Crop → undo → edit → re-apply keeps the edit. Undo → redo is still the same
  state, so a plain re-apply still rewinds.
+ Keep is full resolution for non-active photos: 3000×3000, not 1536×1536.
  12 × 24 MP measured renderer RSS +557 MB (~1.1 GB if all were decoded).
- Identity dies on a photo switch (history rebuilt), so re-apply crops on top
  there. The old count happened to rewind in that case (parked).
- The open photo is still the ≤2048 working copy, so Keep differs between the
  open photo and the others (parked).
- wasm +283 B (936,626 → 936,909 at draft; 946,145 → 946,428 after merging v9.43). One more field every `syncState` reads.

## Alternatives rejected
- Keep counting: wrong by construction, as the red test shows.
- Persist node ids with the edit so identity survives a reload: a storage
  change (`dexie-migration`), out of scope for a fix.
- Op-log generation counter: an op-log format change, ruled out for the night.

## Pre-mortem
It is six months later and this was a mistake. Most likely reason: a second
feature copied `{ node, revision }` and forgot that a load, restore or photo
switch rebuilds history. Its stored identity silently never matches again, and
it falls back without anyone noticing, the same way Batch › Crop does after a
switch. Or someone pairs the node with a revision that is not bumped by every
history rebuild, and a stale id matches a fresh one (both start at 0).
Early warning sign to watch for: a new `history_node()` caller that does not
also read `documentRevision`.
