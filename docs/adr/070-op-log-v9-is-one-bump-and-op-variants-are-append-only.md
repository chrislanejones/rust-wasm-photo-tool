# ADR-070: Op-log v9 is one bump for shapes and the six tonal adjustments, and `Op` variants are append-only
Date: 2026-09-24   Status: proposed   Relates to: ADR-060, ADR-066, ADR-069, ADR-059 (#187)

## Context
`OP_FORMAT_VERSION` is 8 (`src/ops.rs:190`); `decode_op` accepts `2..=8`
(`:975`), so a v9 frame is unreadable by every shipped build. Several changes
each want a new number, and bumping one at a time spends v9, v10 and v11 inside
a month. It has already collided twice: #131 and the shapes branch both claimed
v6, then both claimed v8. PR #187 (`feat/shapes-triangle-rotate` @ `8d497502`)
still says `OP_FORMAT_VERSION: u8 = 8` and puts `ShapeRotation` at index 18,
which is `TextFont`'s index on master and on users' disks. Its 9th annotation
tuple element (rotations) is master's 9th (fonts).

## Decision
1. **`Op` variants are append-only.** postcard writes an enum as
   `varint(index) ++ payload`, so inserting or reordering shifts every later
   index and an old log replays as the wrong op. If the payload happens to
   parse, nothing errors. The rule already lives in a comment on `TextWrap`
   (`ops.rs:793-805`). This ADR makes it the record. Current order: 0 Stroke,
   1 FillRegion, 2 Blur, 3 Levels, 4 Crop, 5 TextAdd, 6 TextEdit, 7 TextRemove,
   8 ShapeAdd, 9 ShapeRemove, 10 LayerMove, 11 ShapeEdit, 12 TextWrap,
   13 TextBoxHeight, 14 TextPerspective, 15 PerspectiveWarp,
   16 ShapePerspective, 17 ShapeSloppiness, 18 TextFont (`ops.rs:756-870`).
2. **v9 contains exactly this**, appended after `TextFont`:

   | Index | Variant | From |
   |---|---|---|
   | 19 | `ShapeRotation { id, rotation_deg: f64 }` | #187 |
   | 20 | `ShapeStarPoints { id, star_points: u8 }` | #187 |
   | 21-26 | `Brightness`, `Contrast`, `Saturation`, `Shadows`, `Highlights`, `Sharpen`, each `{ amount: f64 }` | plan #37: `lib.rs:2988-3030` call `snap()` and record nothing, so the first nudge breaks the log |

   Also `encode_annotations` gets a 10th element (rotations) and an 11th (star
   points), after master's 9th (fonts). The triangle is shape `kind` 10 inside
   the existing `ShapeParams` bytes, so it needs no variant.
3. **#187 rebases onto v9.** Move its two variants to 19 and 20 and its tuple
   elements to 10 and 11, set the constant to 9, and add decode tests for v7
   and master's v8 under v9. `tests/oplog_v7_v8_fixture_resume.rs` must pass
   **unedited**. It replays real captured bytes: `v8-text-font-wrap-shape.frames.bin`
   carries a `TextFont` frame at index 18, and `a_v8_log_resumes_with_its_face_and_its_box`
   (`:111`) asserts `font_id` comes back `"liberation-serif"`. The current #187
   order decodes that frame as `ShapeRotation`, so this test is the tripwire.
   ADR-059's "op-log goes to v8" title gets retitled in the same PR.
4. **Stays unrecorded, and why.**
   - Selection steps (Refine Selection, retune, Intersect, Add/Subtract, Select
     All, Deselect) go through `snap_selection` (`lib.rs:690`). Those steps are
     invisible to the log. They never start it and never move its cursor, so
     they do not break it. The op-log `Document` (`ops.rs:1344`) holds no
     selection, so there is nothing to record them into.
   - Add Mask from source (`selection_refine.rs:313`) is unrecorded like every
     mask op (`layer.rs:1616-1666`). `Document` has no mask plane, so recording
     masks means a new document model, not a new variant. That is its own ADR.
   - ADR-024-F7 / plan #33a (wrap width on the archive path) is not part of
     this bump. #195 (v8.81) already carries wrap, box height, quad and font
     through `restore_text_annotation` (`layer.rs:1853-1905`), and ADR-060
     kept v8 on purpose.
5. **Capture a v9 fixture after v9 ships.** Use the live build and
   `tests/fixtures/oplog/capture-harness.mjs`. The session must contain the
   highest index (a Sharpen at 26) plus a ShapeRotation and a ShapeStarPoints.
   A fixture only catches an insertion at or below the highest index it holds.

## Consequences
+ One migration instead of three, and one number nobody else can claim.
+ Nudging a tonal slider no longer drops undo to whole-image copies (~2 steps
  at 24 MP, `useUndoDepth.ts:23-27`).
- #187 waits for the tonal work, or the tonal work lands on #187's branch.
  Either way one PR carries both engine changes.
- Six more variants and replay arms cost wasm bytes against the 860,000
  ceiling (35,714 B of headroom at v8.98). Not measured yet.
- f64 tonal replay has to match the live path to the byte, or the composite
  hash check breaks the log anyway. Same exposure `Levels` already has.

## Alternatives rejected
- **Bump per feature.** Three migrations, and it already collided twice.
- **One `Tonal { kind: u8, amount }` variant.** Fewer indices, but an unknown
  `kind` becomes a runtime decode case instead of a type error.

## Pre-mortem
It is six months later and this was a mistake. Most likely reason: bundling
held #187 hostage to the tonal work, it went stale a third time, and a parallel
branch claimed v9 while it waited. The append-only rule held, and the number
collided anyway. Early warning sign: any open branch other than the one
carrying this ADR showing `OP_FORMAT_VERSION: u8 = 9`.
