# ADR-082: A shape's corner radii are a side field, and the op log goes to v11
Date: 2026-10-05   Status: draft   Relates to: ADR-059, ADR-070

## Context

Chris asked for Figma's corner radius on every shape but the line: a slider in
the Shapes panel, and the small dots inside the edit box's corners on the
canvas, where Shift-dragging one dot rounds that corner and leaves the others.

A radius has to survive a reload, so this is a persisted-format change, the
same position ADR-059 was in for rotation: `ShapeAdd`/`ShapeEdit` have been on
disk since v2 and cannot gain a field. ADR-070 reserves **v10** for the tonal
ops by name and says "a branch that needs a number takes v11".

## Decision

**1. The model.** `ShapeAnnotation::corner_radii: [u16; 4]`, whole px, in the
shape's own unrotated frame (like the box). One stored form per meaning,
`canonical_corner_radii`:

| Kind | Corners | Stored |
|---|---|---|
| rect (0) | TL, TR, BR, BL | as given |
| diamond (8) | top, right, bottom, left | as given |
| triangle (10) | apex, bottom-right, bottom-left | 4th always 0 |
| star (9) | every tip and valley alike | the first radius, copied into all four |
| everything else | none — the circle has no corners, the rest are not closed | `[0; 4]` |

The star takes one radius because it has up to 24 corners and Figma gives it
one control too. Shift on its one dot does nothing extra.

**2. Render.** `drawing::round_corners` replaces each vertex with a circular
fillet tangent to both edges, the tangent points clamped to half of each edge
so two corners never cross (a huge radius gives a stadium). Reflex corners (a
star's valleys) round inward. Arcs are flattened to ≤ ¼ px sagitta. The fill
clips by the same rounded polygon. A sketchy rounded outline uses a new
`sloppy_loop_points` — a periodic wobble around the loop — because the
per-edge `sloppy_polyline_points` overshoots every vertex and turns a
flattened arc into a saw blade. **With all radii 0 every call is the one it
was**, so nothing drawn before this changes by a byte
(`zero_radii_are_the_square_shape_byte_for_byte`, and the pinned hashes in
`tests/shape_rotation.rs` pass unedited). Rotation and perspective need
nothing new: the rounded outline is built unrotated and goes down the same two
routes ADR-059 describes.

**3. Op log v11, the recipe an eighth time.** `#[serde(skip)]` on
`ShapeParams::corner_radii`; the value rides in an appended
`Op::ShapeCornerRadii { id, radii }` at **index 21** and as a twelfth
`encode_annotations` element, read as a tail after v9's, so an empty tail is a
v9 blob with square corners. `carry_skipped_from` and the sync diff own the
fifth skipped field exactly as they own the other four.

**10 is skipped, not taken.** No build ever wrote a 10, and `decode_op`'s
`2..=OP_FORMAT_VERSION` range accepts it for free.

**4. The wasm surface.** `add/update/restore_shape_annotation` gain one
trailing `corner_radii: &[u16]` (a `Uint16Array` from JS; a short slice reads
as zeros). The Rust short wrappers pass `&[]`.

**5. Frontend.** `ToolSettings.cornerRadii` is the one value both controls
write. The panel slider sets all four (it reads *Mixed* when they differ). The
canvas dots write the same store value, so a new shape reads it live and a
reselected one takes it through `panelStylePatch`, exactly as a slider move
would, with no second path into the edit state. A dot sits at its arc's
center, never closer than 14 screen px to the corner, and a drag moves the
radius by the pointer's motion along the corner's bisector in the shape's own
frame (`lib/cornerRadiusHandles.ts`). The dots hide below a 40 px box.

## Consequences

+ Rect, diamond, triangle and star round, uniformly or per corner, and the
  radius survives move, resize, rotate, duplicate, image resize (scaled with
  the stroke), undo and reload.
- **v11 takes index 21, which ADR-070 decision 4 listed for `Brightness`.**
  The tonal ops are unbuilt, so nothing on disk moves; they now start at 22.
  And because format numbers only rise, the tonal bump can no longer be
  literally "v10" — it ships as the next number after 11. ADR-070 should be
  amended to say so if this lands.
- One gesture can record `ShapeAdd` plus `ShapeCornerRadii` under one
  snapshot, so the known two-press undo gap (ADR-059, PARKING_LOT) now
  covers a rounded shape too.
- The hit test is unchanged: a click in the cut-off corner of a rounded
  shape's bbox still selects it. It matches the TS mirror and #60's drift hash,
  and a corner a few px wide is not worth re-pinning both.
- Wasm grows. Measured unoptimized only (binaryen could not be fetched in the
  build environment): +14,116 B (972,238 → 986,354). There is no ceiling since
  09-25; the release metrics will show the optimized number.

## Alternatives rejected

1. **Pack the radii into an unused `ShapeParams` field** (`number`, which only
   pins use, or `points`). No bump at all, but one value with two meanings, and
   `points` is moved by every translate and resize.
2. **A separate setter that does not snap**, to avoid widening the exports.
   Two calls per gesture that must stay adjacent, for a parameter that belongs
   with the rest of the style.
3. **Take v10.** ADR-070 reserves it by name, and says what to do instead.

## Pre-mortem

It is six months later and this was a mistake. Most likely reason: the tonal
branch was written against ADR-070's numbers (v10, index 21) and merged
without reading this, so its `Brightness` lands on index 21 and decodes every
`ShapeCornerRadii` frame as a brightness change. Early warning sign:
`op_variant_indices_are_append_only` failing on that branch, or a tonal branch
showing `OP_FORMAT_VERSION: u8 = 10`.
