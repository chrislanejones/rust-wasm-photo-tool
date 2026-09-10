# ADR-050: Rotated text drifts because it is anchored by its own tile's centre
Date: 2026-09-08   Status: draft — anchor SHIPPED 2026-09-09 (#99), migration DECLINED on measurement

Filed against "the text bounding box moves/resizes as you type". Reproduced,
mechanism found, and now SHIPPED — see "Resolved" at the end. The fix changes
how every saved rotated text annotation renders, which is why it waited on a
count rather than on an opinion.

## Context

The report is two different defects wearing one sentence, and only one of them
is what it sounds like.

**Unrotated text is fine.** The box grows rightward from a fixed origin, which
is what a left-aligned text box should do. Measured in the browser on the
production build, typing into an unrotated box:

| Text | left | top | width |
|---|---|---|---|
| *(empty)* | 820 | 404 | 75 |
| `AAA` | 820 | 404 | 75 |
| `AAAA AAAA` | 820 | 404 | 150 |
| `AAAA AAAA AAAA AAAA` | **820** | **404** | 291 |

**Rotated text translates as you type**, and not only in the preview. Driving
the engine directly — `add_text_annotation` onto a white 600×400, measuring the
ink's bounding box:

| Case | ink minX | ink minY |
|---|---|---|
| 0°, `AAA` | 106 | 110 |
| 0°, `AAA AAA AAA AAA` | **106** | **110** |
| 30°, `AAA` | 107 | 104 |
| 30°, `AAA AAA AAA AAA` | **118** | **67** |

At 0° the origin is stable across a 4× length change. At 30° it moves 11px
right and 37px up. The committed pixels move, so this is not a preview artifact.

## The mechanism

`text::rotate_pixels` rotates about the centre of the tile it is given:

```rust
let cx = w as f32 / 2.0;
let cy = h as f32 / 2.0;
```

`w` and `h` are the extents of the rendered text, so **the rotation anchor is a
function of the text's own length**. Add a character, the tile widens, its
centre moves, and rotating about a moved centre translates the result. The
rotated bounding box is then placed at the annotation's `(x, y)`, so the ink
inside it lands somewhere new.

The DOM preview mirrors this faithfully and on purpose —
`pivotLocalX = (measured[0] * scaleX) / 2` in `CanvasArea.tsx`, read from the
engine's own measurement so preview and commit agree. Confirmed by watching
`transform-origin` while typing: **10px → 130px** across the same five inputs.
That code is not the bug; it is correctly tracking a model that moves.

**So this is an engine change, not a leaf TS one.** Freezing the pivot in
TypeScript would desync the preview from the commit, which is the exact defect
the comment above that line was written to prevent.

## Decision

**Not fixed here.** The fix is to anchor rotation at a point that does not
depend on the text's extents — the unrotated tile's top-left mapped through the
rotation is the obvious candidate, matching what the 0° path already does.

That is a one-file change in `text.rs` and a re-place in the caller. What makes
it a decision rather than a fix: **every saved document containing rotated text
renders in a new position afterwards.** Nothing migrates that; the annotation
stores `(x, y, rotation_deg)` and the meaning of `(x, y)` changes underneath it.

The options, none picked:

| Option | Cost |
|---|---|
| Change the anchor, accept the shift | Saved rotated text moves once, silently |
| Change the anchor, migrate `(x,y)` on load | Needs a text-annotation format bump + `dexie-migration` |
| Leave it, document it | Typing into rotated text stays unpleasant |

The middle option is the honest one and is also the most expensive, which is
exactly why it needs a decision instead of a commit.

## Consequences

+ The report is now specific: 0° is correct, rotation is not, and the engine
  owns it.
+ The preview/commit agreement is intact and worth keeping — whatever the new
  anchor is, `CanvasArea`'s pivot must be re-derived from the same measurement.
- Doing nothing leaves a defect that gets worse the longer the text.
- Any fix touches the wasm, so the size band and the reproducible-build
  machinery are in play for what is conceptually a geometry change.

## Alternatives rejected

1. **Freeze the DOM pivot only.** Cheap, and it reintroduces preview-vs-commit
   drift — a worse bug than the one it hides.
2. **Fold this into the font work.** Unrelated mechanism; the font defect is a
   surface disagreement (see ADR-051) and this is a rotation anchor. Keeping
   them apart is what let both be stated precisely.

## Not the same as ADR-024-F7

Checked, because they look adjacent. F7 — "a dragged text box does not survive a
reload" — is the layer-JSON restore path hardcoding **0** for `wrap_width` and
`box_height`. Different file, different mechanism, no shared logic with the
rotation anchor. **Neither closes the other.**

## Pre-mortem

It is six months later and this was a mistake. Most likely reason: the ADR sat
in Draft because no one wanted to own "saved documents move", so the defect
shipped for another half-year while every rotated-text user quietly learned not
to edit after rotating. The second-most-likely: the anchor got changed without
the migration, because the diff is small and the breakage is invisible in every
gate — nothing in this repo renders a saved rotated annotation and compares it
to a stored expectation.

Early warning sign: a bug report that rotated text "jumped" after an update, or
any change to `rotate_pixels` landing without a matching change to
`pivotLocalX` in `CanvasArea.tsx`. Those two are a matched pair now, and like
`blurReference.ts` before them, nothing enforces it.

## Resolved — 2026-09-09

**Anchor: TOP-LEFT.** Chris's reasoning: predictability is the point — a box
stays where you dragged it. Shipped in #99.

**Migration: NOT DONE, on measurement.** The rule was "migrate if the count is
anything but zero". The count was taken on the production origin
(`rust-wasm-photo-tool.netlify.app`, the host the marketing site links to — no
custom domain exists) with `window.__ihRotatedTextAudit()` (#100):

| | |
|---|---|
| Photos with a stored archive | 5 |
| Text annotations | 2 |
| **Rotated (\|deg\| >= 0.5)** | **0** |
| Estimated to shift visibly | 0 |
| Annotations in op-log keyframes | **0** — the Dexie store is empty |

That last row is why the archive count is the whole picture rather than half of
it: text annotations can also live postcard-encoded in keyframes, and on this
profile there are none.

⚠️ **A thin sample, stated as one.** Two text annotations is not a survey. This
says "nothing on this profile moves", not "no rotated text exists anywhere". The
cost of being wrong is the one already priced above — some saved rotated text
renders in a new position, once. The audit ships (#100), so the number can be
re-taken on any profile at any time rather than re-derived.

**Two corrections to this ADR's own costing**, both found while building the fix:

1. The migration was priced as "a text-annotation format bump + `dexie-migration`".
   It is cheaper than that. `restore_text_annotation` does not take
   `tile_offset_x/y`, and `editPersistence.ts` strips `tile_*` on save
   *because it is re-rendered on restore*. So the old-to-new delta is a pure
   function of fields already stored: no per-annotation data is needed, only a
   version marker — and the archive record has none today (the existing
   `formatVersion` is on `PhotoOplogManifest`/`Chunk`, the op-log path).
2. The blast radius is smaller than the `-5°` default in `text.rs` suggests.
   Red stamps go through `commit_red_stamp`, which renders, scales and
   `paste_region`s — **baked pixels, not text annotations**. An anchor change
   moves none of them.

**The pre-mortem's second failure mode is now closed.** It warned the anchor
could change "without the migration, because the diff is small and the breakage
is invisible in every gate". The matched-pair guardrail
(`rotated-anchor-pair` in `scripts/guardrails.sh`, #99) fails when
`text::rotated_tile_offset` changes without `CanvasArea`'s `pivotLocal*`,
scoped to the lines carrying the trig so a comment cannot turn it red. Proven
to fail before it was believed.

The first failure mode — "it sat in Draft because nobody wanted to own 'saved
documents move'" — was closed by measuring instead of deciding.
