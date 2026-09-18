# ADR-059: A shape is its upright box plus an angle, and the op log goes to v8
Date: 2026-09-18   Status: draft

Follows [ADR-053](053-a-shapes-perspective-is-normalised-over-its-bbox-and-its-tile-is-padded.md)
(shape perspective, op log v6) recipe for recipe and takes `OP_FORMAT_VERSION`
**7 → 8**. v7 (sloppiness, #172) used the same recipe and has no ADR of its own.
Neighbor of [ADR-050](050-rotated-text-is-anchored-by-its-growing-tile-centre.md),
rotated text. Branch `feat/shapes-triangle-rotate`, uncommitted. Supersedes nothing.

## Context

The Shapes tool could not turn a shape, had no triangle, and drew every star
with five points. A rotation has to survive a reload, so this changes a
persisted format: `ShapeAdd`/`ShapeEdit` have been on disk since v2, and adding
a field to them would mis-decode every one already stored (ADR-053 §4). Two
limits shaped the rest: `src/lib.rs` sits exactly on its guardrails ratchet
(**4,808** lines, can only go down), and master's wasm had **1,913 B** of
headroom under the deploy sentinel's 860,000 B ceiling.

## Decision

**1. The model.**

| Field / kind | Stored as | Why |
|---|---|---|
| `rotation_deg: f64` | degrees, clockwise on screen, about the bbox center, normalized to (−180, 180]. `x0..y1` stay the UNROTATED box | resize handles, the ADR-053 perspective basis and the sketch-wobble seed all keep working in the shape's own frame. θ is applied last, at render and hit-test time |
| `star_points: u8` | canonical: 0 = the classic five, else 3..=12 and never 5. Every other kind stores 0 | one value per meaning. A stored 5 would differ from the 0 a v7 decode gives, and every default star would sync a side op that changes nothing |
| kind **10**, triangle | isosceles, apex up, outline only (like diamond and star) | `fill_shape` handles kinds 0 and 1 only |
| a line | its rotation lives in its endpoints. The UI moves them and `rotation_deg` stays 0 | one representation per shape, never two that can disagree |

ADR-050's drift does not carry over. That pivot moved with the text's length.
A shape's center depends only on its stored box, and the one gesture that moves
the center (resize) re-pins it (Decision 7).

**2. Render: two routes, chosen by what has to turn.** Measured on a 700×500
rect on a 1600×1200 canvas, native release build:

| Shape | Route | ms / recomposite |
|---|---|---|
| unfilled rect, line, diamond, star, triangle | the outline's POINTS are rotated, then stroked. Edges stay crisp, and the wobble matches the SVG preview because its seed comes from the unrotated box | 22.3 → 23.1 |
| filled rect, gradient circle | the ADR-053 warp tile, with the rotation composed onto the quad (warp, then rotate). Every fill kind turns with no fill code of its own | 37.7 → **87.3** (solid) |
| plain circle | θ is ignored because a circle looks the same at any angle. A warped circle takes the warp route | — |

At θ = 0 every shape makes the same calls it made before rotation existed.
`tests/shape_rotation.rs` pins that with 20 hashes recorded on master `4890bf1f`.

**3. Hit-test in the shape's own frame.** `shape_annotation_at` turns the query
point by −θ about the bbox center, then runs the unchanged ring/edge/box rules.
The TS mirror was ported first, and #60's drift hash was re-pinned
`2f58b7e76eb659d0 → ba5ac4fcb5d475f3`.

**4. Op log v8, same recipe as v6 and v7.** Both fields are `#[serde(skip)]`
on `ShapeParams`, so the wire layout is still v2's. The values ride in two
APPENDED variants, `Op::ShapeRotation` and `Op::ShapeStarPoints` (the sixth and
seventh appends), and as the 9th and 10th trailing elements of
`encode_annotations`. v8 decodes through the v7 branch as a prefix plus a tail,
so an empty tail means a v7 blob, read as upright and five-pointed. There is
no Dexie `.version()` bump (ADR-033 precedent): the op-log bytes are opaque
fields, and the layer archive's shape JSON gains two optional keys that are
read as `?? 0`.

**5. A replayed `ShapeEdit` keeps what the side ops own.** `apply` used to do
`*s = p.clone()`. A `ShapeEdit` read back from disk carries its skipped fields
at their defaults, so after a reload, replaying one wiped the shape's warp and
sloppiness. That bug has been latent since v6/v7. The arm now carries over
perspective, sloppiness, rotation and star points. The rule: **skipped fields
are owned by their side ops.** The sync diff also neutralizes all four before
it decides a `ShapeEdit` is needed. It used to neutralize the quad only, so a
sloppiness-only change recorded two ops. Pinned by
`a_decoded_shape_edit_keeps_the_side_op_fields`.

**6. The export pattern.** Widening `add/update/restore_shape_annotation` would
have made rustfmt spread eight single-line `lib.rs` test calls vertically,
which pushes `lib.rs` over its ratchet. So new `*_shape_annotation_full`
methods are exported under the ORIGINAL JS names via
`#[wasm_bindgen(js_name = …)]`. The old Rust signatures stay as non-exported
wrappers that pass `(0, 0.0)`. `lib.rs` is unchanged at 4,808.

**7. Frontend.** A turned box is resized in its own frame and re-pinned by
(I − R)·Δcenter, so the opposite edge stays put. Shift snaps rotation to 15°.
The Points slider (presets 3/5/8/12) goes on the star, not the triangle,
because a five-point triangle is a pentagon and the diamond already covers
four. The edit overlay moved out of `CanvasArea.tsx` into
`ShapeEditOverlay.tsx` (3,010 → 2,368 lines, max-lines cap lowered to match).

## Consequences

+ Six kinds take an angle, every fill turns with its shape, and nothing
  unrotated changed by a byte.
+ The replay fix also repairs v6/v7 documents. After a reload, editing a warped
  or sketchy shape no longer breaks the log. `ops_engine_parity` covers a
  rotated, warped seven-point star through persist, restore and a
  post-reload undo, byte-exact.
- **Wasm +6,059 B (858,087 → 864,146), 4,146 B over the 860,000 sentinel
  ceiling.** The first deploy that carries this goes red. Raising the ceiling
  (as #160 did) or trimming something else is Chris's call, and it is not
  made here. An `fmod` and a duplicated decode branch are already cut, and
  nothing further comes out without dropping v8 persistence.
- **Op-log undo can take two presses.** One gesture records `ShapeAdd` plus a
  side op under ONE snapshot, and op-log undo rewinds one op per snapshot. So
  the first press after drawing a turned shape or a seven-point star changes
  nothing on screen, and later presses land one gesture late. This has been
  true of sloppiness since v7, and v8 extends it to rotation and points. Today
  it is masked by the 2026-09-15 PARKING_LOT entry (undo of any recorded edit
  breaks the log). `one_undo_removes_a_seven_point_star` reproduces it and is
  `#[ignore]`d.
- **The legacy Rust `update_shape_annotation` RESETS rotation and points.** JS
  is safe because it reaches `_full`. A new Rust caller of the short name is
  not. The Rust name and the JS name of each export now differ.
- Rotated fills are resampled on every composite (87.3 vs 37.7 ms, 2.3×,
  scaling with area) and come out slightly softer than a rotated outline.
  Rotated pixelate averages the UNROTATED region under it, the same limit
  ADR-053 accepted. A non-uniform canvas resize brings a rotated shape back as
  a rotated rect, not the parallelogram it should be.
- `Op::TextEdit` has the same replay wipe (wrap, box height, quad). It was
  probed and parked, not fixed, so the rule in Decision 5 does not yet hold
  for text.

## Alternatives rejected

1. **Bake the angle into the geometry** (store four turned corners). A rect
   stops being a rect, resize and the perspective basis would need a rotated
   frame, and the angle could not be re-edited. Its one advantage: a
   non-uniform resize would come out exact.
2. **Put the fields on the `ShapeAdd`/`ShapeEdit` wire.** Every persisted
   ShapeAdd and ShapeEdit since v2 would mis-decode.
3. **One route for everything** (turn every shape through the warp tile).
   Simpler, but outlines would be resampled and soft, and would pay the
   warp's cost for nothing. Filling the rotated area directly is the parked
   follow-up. It needs fill code per kind, and the warp gave every kind now.
4. **Widen the existing exported signatures.** That breaks the `lib.rs` ratchet.

## Pre-mortem

It is six months later and this was a mistake. Most likely reason: v8 used the
side-op recipe a sixth and seventh time, at the moment it should have changed.
The recipe records several ops per gesture, and rotation is the side field
users will set most often. When the 09-15 undo bug is fixed, the masked defect
comes back as "undo does nothing after I rotate". The fix (gesture boundaries,
or one `ShapeAddStyled` op) is then a v9 that still has to decode v8's
multi-op gestures forever.
Early warning sign to watch for: that 09-15 PARKING_LOT entry closing while
`one_undo_removes_a_seven_point_star` is still `#[ignore]`d, or a new Rust call
site of the short `update_shape_annotation`.
