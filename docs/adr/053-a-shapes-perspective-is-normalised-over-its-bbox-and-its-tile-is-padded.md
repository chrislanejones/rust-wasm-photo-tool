# ADR-053: A shape's perspective is normalised over its bbox, and the tile it warps through is padded
Date: 2026-09-11   Status: draft

Extends [ADR-034](034-perspective-is-projective-and-text-keeps-its-corners.md)
(one quad, three drag rules, normalised corners on the annotation) to every
vector object the app draws. Takes `OP_FORMAT_VERSION` 5 → 6 by the same
prefix-extension recipe as [ADR-033](033-the-text-box-has-a-height-and-the-op-log-goes-to-v4.md).
Supersedes nothing.

## Context

Chris, 2026-09-11:

> Perspective, skew, and distort only work with vector objects, it needs to
> work with vector objects like the square, circle, and text

and, a few minutes later:

> only works with raster - needs to work with vector and or designs made with
> the app

Both describe the same gap. ADR-034 shipped two paths: a non-destructive one
for **text**, and a destructive pixel warp for everything else. "Everything
else" silently included every shape the app draws. Point the tool at a square
you had just drawn and the tool did exactly what it was built to do — lifted
the pixels in a rectangle, resampled them, and put them back — while the square
itself, being an annotation composited *over* those pixels, stayed exactly as
drawn. The photo moved and the square did not.

So the feature was not broken; it was **absent for shapes**, and its absence
looked like a bug because the destructive path is always available and never
refuses.

The text path already answered the hard question (store corners as fractions,
apply at render time), so extending it is mostly mechanical. Two things are
genuinely new, and both are places to get it wrong.

## Decision

**Give `ShapeAnnotation` a `perspective` quad normalised over its BARE BBOX,
and render it by warping a tile that is PADDED past that bbox.**

### 1. The basis is the bbox — `(min(x0,x1), min(y0,y1))` to the opposite corner

A text annotation's quad is normalised over its **tile**, which is the only
rectangle text has. A shape has two candidates, and they are not the same:

| candidate | what it is | why not |
|---|---|---|
| **bbox** | `x0,y0,x1,y1` — the shape's own geometry | ✅ chosen |
| ink bounds | what the shape actually rasterises to | needs stroke width, arrowhead geometry, pin label metrics — all engine-internal |

The overlay draws its handles by denormalising the stored quad onto the basis,
and the engine re-normalises against its own copy on commit. So the basis is a
number **two implementations have to agree on to the pixel**:
`basisOfShape` in `app/src/lib/perspectiveTarget.ts` and `shape_basis_rect` in
`src/annotations.rs`. Every round trip re-normalises, so a disagreement does not
merely offset the warp once — it compounds on each reselect.

The bbox is the only rectangle both sides can compute from the shape JSON
alone. Choosing ink bounds would mean shipping arrowhead trigonometry to
TypeScript and keeping it in step forever; this repo already carries one such
hand-mirror (`annotationHitTest.ts`, #60) and knows what it costs.

### 2. The rendered tile is padded, and the padding does not move the basis

A stroke straddles its path, an arrowhead is drawn past the endpoint, and both
are anti-aliased. Warping a tile cropped to the bare bbox shaves all of that
off, so a warped square comes back visibly thinner than it was drawn.

The tile is therefore grown by `shape_ink_pad` on every side — and the quad
stays normalised against the **un-padded** bbox. Those two facts coexist
because of a property of projective maps, not by approximation:

> A homography is fixed by four correspondences. The bbox→quad correspondence
> defines `H`; feeding the PADDED rectangle's corners through that same `H`
> gives the destination quad for the padded tile, and the map that takes one to
> the other is `H` itself.

So the padding extends the input rectangle and the image of it, and changes
nothing about the transform. `render_shape_warped` does exactly that: solve
once on the bbox, map the padded corners through it, resample.

It falls back to the un-padded tile when a corner maps to the horizon (an
extreme keystone can push a padded corner across it while the bbox is still
finite), and to a flat render if even that fails. A clipped stroke beats a
vanished shape; a vanished shape is unacceptable either way.

### 3. `NormQuad` — the identity is the default, in the type

`ShapeAnnotation` derives `Default`, and six of its constructors build
themselves with `..Default::default()`. `[(f32, f32); 4]`'s default is four
corners at the origin — a **collapsed point**, not "no perspective" — so a bare
array field would have given every pin, polyline and Bézier path a degenerate
warp the day the field landed.

`ops.rs` already carries this hazard on the text side and answers it at
runtime with `default_quad_if_unset`, which works and has to be *remembered* at
each new site. The shape side answers it in the type: `perspective::NormQuad`
is a newtype whose `Default` is the identity, so the wrong default is not
constructible.

### 4. Format v6, by the v3/v4/v5 recipe

`ShapeParams::perspective` is `#[serde(skip)]`, the quad rides in an appended
`Op::ShapePerspective`, and `encode_annotations` gains a seventh trailing tuple
element. A v5 document decodes with every shape unwarped, which is what a v5
document meant.

This matters more for shapes than it did for text: `ShapeAdd`/`ShapeEdit`
payloads have been persisted since v2, so a shifted byte mis-decodes every one
of them. Pinned by `v5_blobs_still_decode_under_v6` and
`v5_op_bytes_still_decode_under_v6`.

## Consequences

+ Distort, Perspective and Skew work on squares, circles, lines, arrows, pins
  and pen paths, non-destructively — the shape stays a shape, so it can be
  recoloured, moved, resized, duplicated and re-warped afterwards, and the warp
  comes along. `tests/shape_perspective.rs` pins each of those.
+ Because the quad is normalised, resizing a warped shape keeps the same
  transform rather than sliding it off the geometry.
+ Layer separation is free and not a new rule: `get_text_annotations` and
  `get_shape_annotations` answer for the ACTIVE layer only, so the pickable
  list is already scoped, and the tool drops its target when the active layer
  changes.
- One more `Op` variant and one more format version. The op log's variant list
  is append-only forever; this is the fourth append.
- A warped shape's ink can now fall OUTSIDE its bbox, while its click target —
  in the Perspective overlay and in `shape_annotation_at` — is still the bbox.
  Clicking the part of a heavily warped shape that hangs outside its box does
  not select it. Hit-testing through the inverse homography is the fix if this
  is ever reported; it was not done here because it would put a second solver
  in the hit-test path for a case nobody has hit yet.
- The Shapes tool's **live edit preview** (the JS overlay drawn while a
  reselected shape is being dragged) draws the shape unwarped, because that
  preview is a JS redraw of the geometry and knows nothing about the quad. The
  warp returns the moment the edit commits, and no data is lost — but the
  preview and the committed result disagree for the length of a drag.
- Pixelate fill (`fill_kind == 3`) needed a special case: it averages the pixels
  already beneath it, so on a blank tile it would warp to nothing. The tile is
  seeded from the canvas region and masked back to the shape's own silhouette.
  This is the one fill whose rendering is not a pure function of the shape.

## Alternatives rejected

1. **Bake the warp into the shape's geometry** — resample once and store the
   result. This is what "only works with raster" already did. It makes the
   warp permanent, unrepeatable and destructive, and it is exactly what ADR-034
   rejected for text.
2. **Give shapes a tile, like text.** Text has a tile because rasterising a
   glyph run is expensive and worth caching; shape rasterisation is cheap, and
   the existing comment on `ShapeAnnotation` says so. A tile would add a cache
   to invalidate on every restyle for no gain.
3. **Normalise over the ink bounds.** See Decision 1 — it needs engine-internal
   geometry in TypeScript, forever.
4. **One id space for text and shapes**, so a target could stay a bare number.
   The engine keeps `next_text_id` and `next_shape_id` separately and a great
   deal of code depends on that; merging them to simplify one tool's state
   would be the tail wagging the dog. The tool carries a `(kind, id)` pair
   instead.
5. **Apply the warp on pointer-up**, so there is no Apply button. Rejected for
   the reason ADR-034 gave: an exploratory drag must not be destructive, and on
   the pixel path it is.

## Pre-mortem

It is six months later and this was a mistake. Most likely reason: the two
copies of the basis rule drifted. Somebody padded `shape_basis_rect` by the
stroke width to "fix" a clipped edge — a plausible-looking one-line change that
is already handled by `shape_ink_pad` — without touching `basisOfShape`, and
every warp now lands slightly off where it was dragged and creeps further on
each reselect. **The warning sign is a stroke term appearing in either basis
function.** The guard is the ⚠️ on both, and
`basisOfShape — the quad's normalisation rect` in
`app/src/lib/perspectiveTarget.test.ts`.

Second most likely: the un-hit-testable overhang above becomes a real
complaint once somebody warps a shape hard enough to reach past its own box,
and the fix applied is to grow the picker rectangle — which makes overlapping
shapes fight over clicks — rather than to hit-test through the inverse map.
