# ADR-099: Text gets an outline drawn outside the glyphs, and the op log goes to v15
Date: 2026-10-31   Status: draft (PR #420, `claude/inspiring-pasteur-1ru7nk`)   Relates to: ADR-050, ADR-060, ADR-082

## Context

Shapes had a stroke and text did not. Every text property added since v2
(wrap, box height, perspective, font) is `#[serde(skip)]` on `TextParams`,
because postcard writes fields by position: a real field would shift every
byte of the `TextAdd` / `TextEdit` payloads already sitting in users'
IndexedDB. An outline is one more of those fields.

## Decision

1. **Engine.** `TextStroke { width 0..=20, r, g, b, a }` on `TextAnnotation`.
   Width 0 or alpha 0 is stored as the default, "no outline".
   `outline_glyphs` (`src/layer.rs`) dilates the glyph alpha with a disc of
   radius `width`, adds a 1 px anti-aliased rim, fills it with the stroke
   color, then pastes the original glyphs on top. The tile grows by `width`
   on every side and its offset moves by `-width`, so the letters never
   move and `annotation_ink_offset` needs no stroke term. The rotation
   pivot leaves the margin out (ADR-050).
2. **Op log v14 → 15.** `TextParams::stroke` is `#[serde(skip)]`. The stroke
   travels as the appended `Op::TextStroke { id, width, rgba }` (index 25)
   and as a 13th `encode_annotations` element, read as a tail after v11's.
   An empty tail means a v14-or-older blob: no outlines.
3. **Archive.** `annotations_to_json` writes `stroke_width`, `stroke_r/g/b/a`.
   `PersistedAnnotation` types them as optional, not indexed. Absent reads
   as 0. No Dexie version bump (same reasoning as `font_id` / `perspective`).
4. **Preview.** The open textarea uses `-webkit-text-stroke` at twice the
   width with `paint-order: stroke fill` (`textStrokeCss`), so the band you
   can see is the outer half, the one the engine commits.

## Consequences
+ An outline never thins the type. Turning it on leaves the letters exactly
  where they were (`an_outline_never_moves_the_letters`, kinds 0/1/2).
+ Old logs, keyframes and archives decode unchanged and read as "no outline".
  The `TextAdd` wire bytes are pinned by a test.
- `TextParams` now has five skipped fields. Each new text property costs a
  version bump, a variant and a tuple tail, and the v15 tail is only read if
  the v11 tail decodes.
- The preview is CSS, not engine pixels. CSS stroke joins are miter by
  default, while the engine's disc gives round corners, so sharp corners can
  differ. This PR does not compare them side by side.
- wasm 946,428 → 954,456 B (+8,028). Measured from `pkg/` built at 10:28,
  after the last `.rs` edit at 10:26. Another branch that also takes v15 or
  index 25 will collide (it has happened twice before).

## Alternatives rejected
- A centered stroke in the engine: half the band covers the letters, so the
  type gets thinner as width goes up.
- A real `stroke` field in `TextParams` serde: shifts the positional
  postcard layout and mis-decodes every stored `TextAdd` / `TextEdit`.

## Pre-mortem
It is six months later and this was a mistake. Most likely reason: the
splat costs too much at the top of the range. Every edge pixel stamps a
disc of about π·20² ≈ 1,300 taps at width 20, and this runs on every tile
rebuild: commit, restyle, and the resize rescale in `lib.rs`. At a big font
size that adds up to tens of millions of writes per rebuild. Nobody has
measured it, so it shows up as lag on exactly the headline-sized text people
outline. A distance transform would have cost the same at any width.
Early warning sign to watch for: commit or restyle of a 200 px+ text at
stroke 20 taking visibly longer than with stroke 0.
