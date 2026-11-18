# ADR-106: The engine's text size is the truth; the preview adapts to it
Date: 2026-11-18   Status: draft (`fix/text-preview-size`, Night 11-17 PR A)   Relates to: ADR-050, ADR-051, ADR-104

## Context

The text tool's size means two different things on the two sides of a commit.
The engine builds every glyph at ab_glyph `PxScale::from(size)`, and ab_glyph's
scale is the face's ascent-to-descent HEIGHT: `as_scaled` divides by
`height_unscaled()` = `ascender − descender` (ttf-parser: `hhea`, or `OS/2`
typo metrics when a face sets USE_TYPO_METRICS). The textarea used the same
number as its CSS `font-size`, which is the EM. For Liberation Sans that is
2048 / (1854 + 434) = **0.895**, so the preview drew ~10% wider than the
commit (`HHHHHHHH` at 48, ink: **272 px** preview, **242 px** committed),
a paragraph in a 300 px box broke into different lines, and the text
jumped **14 px** up and 4 px left on commit (master, measured 11-18).

## Decision

1. **The engine does not change.** No change to `PxScale`, line breaking,
   stored sizes or the op log. Changing it would redraw every saved text, every
   export and every op-log replay; the commit path in `useTextTool` is
   untouched too, so the same clicks commit the same pixels (hashes below).
2. **One read-only engine function**, `text_em_ratio(font_id, bold)`
   (`fonts::em_ratio`): `units_per_em / height_unscaled`, read off the
   rasterizer's own `ScaleFont` (horizontal scale factor at 1 px × the em),
   through `with_face`, so bundled, runtime-registered and fallback faces all
   answer. Cached in `textMetricsCache` on (face, weight), primed with the
   other render metrics. Sans **0.8951**, Serif **0.9030**, Mono **0.8828**
   (Regular and Bold the same).
3. **The textarea is laid out as the engine lays out the text**
   (`lib/textPreviewLayout`): `font-size` = size × ratio × scale; line height
   = 1.3 × size px (the engine's pitch, not 1.3 em); left/right padding =
   `side_padding`, so the content box is the engine's and the browser wraps
   and aligns in the same width; the box sits on the tile origin `commitText`
   will store (its own arithmetic, `alignShiftFrom`), and the top padding puts
   the first baseline where the engine's is (CSS centers ascent + descent,
   which at this em is exactly `size`, in the 1.3 × size line), plus 1 px
   measured in Chrome (`BASELINE_SNAP`, see Consequences). Kerning and
   ligatures off and `geometricPrecision`, because ab_glyph applies none of
   them (the Liberation faces kern only through GPOS). The text and its plate
   rotate about the engine's pivot (the tile's top-left, ADR-050), and the
   plate is the engine's text block.
4. **The panel's size is unchanged**: it is the engine's size, what is stored
   and what every saved text means. Only the CSS em is derived from it.

## Consequences
+ Preview ink = committed ink within 1 px, every bundled face at 24 / 48 / 96,
  every Text in Box cell boxed and no-box, a paragraph breaks into the same
  lines, and re-editing an old text opens on its own pixels: 9 face/size
  cases, 18 cells, a 6-line paragraph and a 30° rotation, every ink edge
  ≤ 1 px (`e2e/text-preview-size.spec.ts`, all 7 red on master).
+ Every committed pixel is unchanged: the composite and annotation list
  hashed at the end of each of the 63 existing text e2e tests that reach the
  engine are equal on master and this branch (aggregate `c595aae83e97d82d`
  both), and the v15/v16 op-log fixtures replay to their recorded frames.
- The no-box frame keeps its old width (measured at the tool's size), roomier
  than the text by ~10%: the commit's Center/Right anchor is measured against
  it, so shrinking it would move where those texts land for the same clicks.
- What stays different: the browser's rasterizer vs ab_glyph (antialiasing,
  and Chrome draws the baseline on a whole pixel), so edges agree to ~1 px,
  not bit for bit. The vertical needs a measured +1 px (`BASELINE_SNAP`):
  with it 43 of 52 line tops agree exactly, the rest by 1 px; it is an
  observation about Chrome, not derived. A runtime face with USE_TYPO_METRICS may be measured by the
  browser on other metrics than ttf-parser's; the bundled faces don't set it.
- A miss in the metrics cache shows one frame at the old size until the prime
  lands. wasm 967,840 → 969,207 B (+1,367), built after the last `.rs` edit.

## Alternatives rejected
- Draw the engine at size ÷ ratio (scale by the em): redraws every saved text,
  export and replay, and needs an op-log/version story for old documents.
- A per-font constant in TypeScript: wrong for any runtime-registered face, and
  a second source of truth for a number the engine already knows.

## Pre-mortem
It is six months later and this was a mistake. Most likely reason: the
preview's layout now mirrors five engine rules (em, pitch, side padding, pen
origin, row offset) in TypeScript, and a later engine layout change (a new
line-height rule, justify) updates the Rust and not `textPreviewLayout`, so
the preview drifts again with every gate green except the e2e.
Early warning sign: `e2e/text-preview-size.spec.ts` needing a wider tolerance.
