# ADR-041: Color Overlay is a field on the Layer, not a layer in the stack

Date: 2026-08-28   Status: draft

## Context

The first non-destructive layer STYLE enters the engine: Photoshop's Color
Overlay, a solid colour tinting a layer's own pixels. A style needs four
things decided at once — where it lives, where in the composite it applies,
when it snaps history, and what happens on every path that flattens pixels by
hand. Each fails silently; the worst is `composite_layers_into`'s fast path,
which copies a lone opaque layer out WITHOUT calling `render_layer` — exactly
the single-layer document `load_image` produces.

## Decision

`Layer.overlay: Option<ColorOverlay>` (`{r,g,b,opacity:f64}`, `Copy` — so
`Layer::clone` carries it into every history snapshot for free).

| Question | Answer |
|---|---|
| Composite order | in `render_layer`, AFTER shapes/text, BEFORE the mask — Photoshop's order: the style tints the whole styled layer, the mask hides the styled result |
| Alpha | never modified; tint clipped to the layer's existing alpha (tints, never fills); fully-transparent pixels skipped so downsampling can't bleed a halo |
| Fast path | the single-visible-layer copy in `composite_layers_into` gains `overlay.is_none()` — without it the style is invisible on exactly the common single-layer document while working at 2+ layers. Regression test: `color_overlay_tints_through_the_single_visible_layer_fast_path` |
| History | snap ONCE on the None→Some transition, never on adjustment — swatch grid and opacity slider are the same engine call and a drag fires per pointer move. Precedent: `set_layer_opacity` snaps not at all |
| Persistence | session-lived: `push_restored_layer` sets `overlay: None`, exactly as it already does for `mask`. Persisting either is a dexie-migration and both go in ONE migration — filed in docs/PARKING_LOT.md (2026-08-28), not here |
| Baking | ONE helper, `apply_color_overlay`, shared by the live render, `apply_layer_color_overlay` and `merge_down` (which flattens the LOWER layer by hand and would otherwise silently discard its style) — baked pixels are byte-identical to the screen |

Adding the field broke two identical hand-built snapshot initializers in
lib.rs at once; they collapsed into `Layer::from_snapshot_pixels`
(src/lib.rs 5213 → **5183**, guardrails ratchet lowered in the same change).

UI: Layers panel, directly under Layer Mask (the same kind of thing), reusing
`ColorSwatchGrid` — the swatch grid IS the on-switch, no separate Add tile.

## Consequences

+ One arithmetic everywhere: the live view, Apply, and merge-down cannot
  disagree about what the tint looks like.
+ The stack's shape is untouched — `layer_count` / `content_layer_count`, and
  with them the op log's view of the document, stay exactly as they were.
+ 7 engine tests (178 lib total) + `e2e/color-overlay.spec.ts`; wasm
  812,652 → **815,801 B** local (+3,149, inside ADR-037's 780–850k band).
- **One undo removes the whole overlay**, intermediate colour choices
  included — the cost of the single snap.
- **A reload silently drops the style** (as it already drops the mask) until
  the shared persistence migration lands.
- **The fast-path guard is convention, not structure**: the next
  non-destructive style must remember the same opt-out or ship invisible on
  single-layer documents — and only a test written for THAT style would catch
  it.

## Alternatives rejected

1. **A separate tint layer in the stack** — changes `layer_count` /
   `content_layer_count` and therefore the op log's view of the document
   (ADR-016 territory), and a stack layer fills the frame instead of tinting
   the layer's silhouette.
2. **Snap on every set** — the slider fires the same call per pointer move; a
   drag would bury the undo stack under a hundred identical entries.
3. **Persist it now** — an IndexedDB schema change (dexie-migration skill),
   and it should carry mask AND overlay together rather than adding a second
   half-persisted style.

## Pre-mortem

It is six months later and this decision was a mistake. Most likely reason:
the second layer style arrived (stroke, drop shadow, gradient overlay) and an
`Option` field per style does not scale — each new one needs its own
fast-path guard, its own `get_layers` key, its own `merge_down` bake and its
own history rule, one of them missed a step silently, and the
`Vec<LayerStyle>` restructure this ADR declined now has to happen with live
user expectations attached.

Early warning sign to watch for: a second `Option<…Style>` field proposed on
`Layer`, or a "tint vanishes on single-layer documents" report about a NEW
style — the fast-path guard missed again.
