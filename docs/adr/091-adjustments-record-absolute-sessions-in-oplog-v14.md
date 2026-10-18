# ADR-091: Adjustments records absolute sessions in op-log v14

Date: 2026-10-17. Status: draft, branch review; not released. Relates to ADR-055,
ADR-070, ADR-088 and ADR-090.

## Context

`adjust_commit` saves each slider release as an undo step but recorded no op.
The working copy retained the image; replay could not retain its undo history.
ADR-090 proposed reusing `TonalStack` for the five tonal sliders. Inspection
shows two differences that make that unsafe:

- Presets apply brightness, contrast, highlights, shadows, saturation.
  Adjustments applies brightness, contrast, saturation, shadows, highlights,
  followed by sharpen and blur. The order changes pixels.
- Each Adjustments release recomputes from the session's untouched base.
  Appending a cumulative stack would instead compound prior settings. A delta
  cannot reverse clipping, and an identity reset must still undo prior changes.

## Decision

Append `Op::Adjustments` at index 24 and advance the format from 13 to 14.
It carries the seven clamped panel values and a `new_session` flag. The first
release captures the replay document's pixels; later releases apply the shared
`adjust_in_place` function to that base. No filter math, units or order changes.
All seven controls are recorded, so sharpen or blur cannot silently desync an
otherwise recorded tonal session. Each changed release is one operation and
one undo step. Identity at the start, repeated settings and preview moves record
nothing. Reset after a change records the identity on the same base.

The replay document holds the base as an `Arc<[u8]>`, shared with its in-memory
keyframes. Another operation drops the live copy; a new Adjustments session
captures its new starting pixels. The persistence reader restores from keyframe
0 and replays all frames, reconstructing session bases and interior keyframes.
No pixel bytes are added to operation frames, no annotation tuple changes, and
the IndexedDB container version stays 1.

Keep the label "Adjustments" for this operation. Existing TonalStack remains
index 23 with its unchanged five-value payload, apply order and "Preset" label.
The reader still accepts versions 2 through the current version. A captured
production v13 preset fixture proves the old payload replays byte-exactly.

## Costs and alternatives

A live replay session retains one extra RGBA base (4 bytes per document pixel).
Keyframes share that base, rather than multiplying it for each slider release.
Older session bases may stay alive with retained keyframes; the existing
keyframe budget bounds them. Replaying a release copies the base and runs the
same filters; this is off the zero-copy display flush path.

Older builds reject v14 logs and fall back to their working copies, preserving
the image but losing that log's undo history. Reusing v13 would disguise the new
vocabulary as corrupt data on those builds. Storing a full pixel payload per
release would avoid session state but defeat the compact log's purpose.

## Verification and pre-mortem

Tests cover a clipped release, all seven settings, exact reset, further edits,
reloaded undo/redo on both document shapes, new sessions, redo-tail replacement,
and 300 releases crossing keyframes and pruning. Browser coverage drives real
sliders, Reset, reload, undo and redo. The v13 fixture comes from the deployed
master's IndexedDB and checks its browser-recorded composite hash.

Most likely regression: a future loader starts from an interior persisted
keyframe without rebuilding the session base, or a new Adjustments caller
forgets the first-release marker. Warning signs are loss of reset parity or
the log switching to snapshot undo after reload. Keep the base-0 restore rule
and the session tests together when changing either.
