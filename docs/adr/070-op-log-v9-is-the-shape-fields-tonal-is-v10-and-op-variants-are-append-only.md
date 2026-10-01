# ADR-070: Op-log v9 is the shape fields alone, the tonal adjustments are v10, and `Op` variants are append-only
Date: 2026-09-24   Amended: 09-30-2026   Status: proposed   Relates to: ADR-060, ADR-066, ADR-069, ADR-059 (#187)

## Amendment, 09-30-2026 (Chris)

The first draft of this ADR put the shape fields and six tonal-adjustment ops
into one v9. Chris decided on 09-30 that **v9 is the shape fields alone and the
tonal adjustments are v10**. What changed and why:

| | First draft | Now |
|---|---|---|
| v9 | shapes (19, 20) **and** six tonal ops (21 to 26) | shapes (19, 20) only |
| Tonal ops | in v9 | **v10**, reserved here, not built |
| #187 | waits for the tonal work, or the tonal work lands on its branch | built and renumbered to v9 (#187, squash-merged as `0ef95437`), no wait |

The reason is the first draft's own pre-mortem. It named "bundling held #187
hostage to the tonal work, it went stale a third time" as the most likely way
this goes wrong, and by 09-30 that was happening: #187 was 104 commits behind
master and had been parked for twelve days while the tonal ops were unbuilt.
Shipping the shape fields now costs one extra migration later. That is cheap,
because a new format number is read through the previous one as a prefix plus a
tail (see decision 3), so the second bump does not copy the decoder.

## Context
`OP_FORMAT_VERSION` was 8 when this was written (`src/ops.rs`), and
`decode_op` accepts `2..=OP_FORMAT_VERSION`, so a v9 frame is unreadable by
every shipped build. It has collided twice: #131 and the shapes branch both
claimed v6, then both claimed v8. #187 (`feat/shapes-triangle-rotate`) still
said `OP_FORMAT_VERSION: u8 = 8` and put `ShapeRotation` at index 18, which is
`TextFont`'s index on master and on users' disks. Its 9th annotation tuple
element (rotations) was master's 9th (fonts).

## Decision
1. **`Op` variants are append-only.** postcard writes an enum as
   `varint(index) ++ payload`, so inserting or reordering shifts every later
   index and an old log replays as the wrong op. If the payload happens to
   parse, nothing errors. The rule already lives in a comment on `TextWrap`
   (`ops.rs`). This ADR makes it the record. Order through v9: 0 Stroke,
   1 FillRegion, 2 Blur, 3 Levels, 4 Crop, 5 TextAdd, 6 TextEdit, 7 TextRemove,
   8 ShapeAdd, 9 ShapeRemove, 10 LayerMove, 11 ShapeEdit, 12 TextWrap,
   13 TextBoxHeight, 14 TextPerspective, 15 PerspectiveWarp,
   16 ShapePerspective, 17 ShapeSloppiness, 18 TextFont, **19 ShapeRotation,
   20 ShapeStarPoints**. `op_variant_indices_are_append_only` pins 17 to 20.
2. **v9 contains exactly this**, appended after `TextFont`:

   | Index | Variant | From |
   |---|---|---|
   | 19 | `ShapeRotation { id, rotation_deg: f64 }` | #187 |
   | 20 | `ShapeStarPoints { id, star_points: u8 }` | #187 |

   `encode_annotations` gets a 10th element (rotations) and an 11th (star
   points), after v8's 9th (fonts). The triangle is shape `kind` 10 inside the
   existing `ShapeParams` bytes, so it needs no variant.
3. **A new format number is read through the previous one.** v9 decodes as the
   v8 tuple plus a tail that is either empty (a v7 or v8 blob, read as upright
   and five-pointed) or `(rotations, star points)`. A separate 11-tuple branch
   would copy the whole decoder for two loops; the tail read costs about 5 KB
   less wasm. v10 does the same over v9.
4. **v10 is reserved for the six tonal adjustments** and is not built.
   Indices 21 to 26 (`Brightness`, `Contrast`, `Saturation`, `Shadows`,
   `Highlights`, `Sharpen`, each `{ amount: f64 }`) follow on from 20. They
   come from plan #37: the tonal setters in `lib.rs` call `snap()` and record
   nothing, so the first nudge breaks the log. **No other branch may claim v10**;
   a branch that needs a number takes v11.
5. **#187 is on v9 (done: #187, squash-merged as `0ef95437`).** Its two variants are at 19 and
   20, its tuple elements at 10 and 11, the constant is 9, and decode tests
   cover a v7 and a v8 blob under v9. `tests/oplog_v7_v8_fixture_resume.rs`
   passes **unedited**. It replays real captured bytes:
   `v8-text-font-wrap-shape.frames.bin` carries a `TextFont` frame at index 18,
   and `a_v8_log_resumes_with_its_face_and_its_box` asserts `font_id` comes back
   `"liberation-serif"`. The old #187 order decoded that frame as
   `ShapeRotation`, so this test is the tripwire. ADR-059's title is retitled to
   v9 in the same PR.
6. **Stays unrecorded, and why.**
   - Selection steps (Refine Selection, retune, Intersect, Add/Subtract, Select
     All, Deselect) go through `snap_selection`. Those steps are invisible to
     the log. They never start it and never move its cursor, so they do not
     break it. The op-log `Document` holds no selection, so there is nothing to
     record them into.
   - Add Mask from source is unrecorded like every mask op. `Document` has no
     mask plane, so recording masks means a new document model, not a new
     variant. That is its own ADR.
   - ADR-024-F7 / plan #33a (wrap width on the archive path) is not part of
     this bump. #195 (v8.81) already carries wrap, box height, quad and font
     through `restore_text_annotation`, and ADR-060 kept v8 on purpose.
7. **Capture a v9 fixture after v9 ships, and a v10 one after v10.** Use the
   live build and `tests/fixtures/oplog/capture-harness.mjs`. The v9 session
   must contain a ShapeRotation and a ShapeStarPoints. A fixture only catches
   an insertion at or below the highest index it holds.

## Consequences
+ Shapes ship now. #187 does not wait for, or carry, the tonal work.
+ The append-only rule is written down and pinned by a test.
+ v9 was measured: **+5,320 B** of wasm (820,341 to 825,661), 34,339 B under the
  860,000 ceiling.
- Two migrations instead of one. Each is cheap by decision 3, but a document
  saved under v9 cannot be read by a build older than v9, and the same will be
  true of v10.
- Until v10 lands, nudging a tonal slider still drops undo to whole-image copies
  (about 2 steps at 24 MP, `useUndoDepth.ts`).
- The six tonal arms will cost wasm bytes against the ceiling. Not measured.
- f64 tonal replay has to match the live path to the byte, or the composite
  hash check breaks the log anyway. Same exposure `Levels` already has.

## Alternatives rejected
- **One bump for shapes and tonal (the first draft).** One migration instead of
  two, but it tied a finished feature to an unbuilt one, and the first draft's
  own pre-mortem predicted the failure. Rejected 09-30.
- **A bump per feature with no reservation.** It already collided twice. What
  is different now is decision 4: the next number is reserved by name, so two
  branches cannot both claim it.
- **One `Tonal { kind: u8, amount }` variant.** Fewer indices, but an unknown
  `kind` becomes a runtime decode case instead of a type error.

## Pre-mortem
It is six months later and this was a mistake. Most likely reason: the tonal ops
were never built, v10 sat reserved and empty, and a slider nudge kept breaking
undo because nobody was carrying it. The other likely one is a parallel branch
that claimed v10 anyway. Early warning signs: any open branch other than the one
carrying the tonal ops showing `OP_FORMAT_VERSION: u8 = 10`, or an open branch
showing `9` after #187 has merged.
