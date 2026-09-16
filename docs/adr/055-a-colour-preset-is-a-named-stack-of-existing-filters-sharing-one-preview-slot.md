# ADR-055: A colour preset is a named stack of filters the engine already has, previewed from the slot Levels now shares
Date: 2026-09-15   Status: draft (extended 2026-09-16 — the Quick Adjust grid is retired)

> **Numbering.** 054 is the highest ADR on master, so 055 is the next one — but
> 053 is not free and never will be: two unmerged branches each hold a different
> 053 (`feat/runtime-fonts` and `origin/claude/optimistic-johnson-s1ak3i`),
> which is why Levels took 054. Whichever of those lands second needs a new
> number, and it is not this one. (043 is a permanent gap: no such file on any
> ref, no INDEX row.)

## Context

The Quick Adjust grid inside Adjustments (`EffectsSettings.tsx`) had four
looks — Enhance, Vivid, Fade, Dark — and each called `adjust_brightness` then
`adjust_contrast`, both of which `snap()`. One click cost **two** undo steps,
and neither half was a look on its own. #88 asks for real presets: more
components than two, and the photo wearing the look before you commit to it.
ADR-054 built exactly that preview machinery for Levels a day earlier.

## Decision

- **A preset is a stack of the existing filters, not a new primitive.**
  `src/presets.rs` holds `PresetStack` (five values) and `apply_stack`, which
  calls `filters::adjust_brightness → adjust_contrast → adjust_highlights →
  adjust_shadows → adjust_saturation`, skipping any component at its identity.
  No new pixel math, no new `Op`. Sharpen stays out: it is a convolution with
  two full-buffer scratch allocations, it is not colour, and a hover would pay
  for it every pass.
- **The order is part of the definition** — tone first, colour last. Pinned by
  `a_preset_equals_its_filters_applied_in_the_documented_order` (a preset must
  equal the five raw filter calls) and `the_stacks_order_is_load_bearing` in
  `tests/presets.rs`.
- **The five components keep the units of the filters they feed, untouched.**
  brightness is a −1..1 fraction; contrast and saturation are factors (1 =
  identity); shadows and highlights are **absolute 8-bit**, clamped to
  −255..=255 in `simd::color`. Found the hard way: 0.1 in shadows is a tenth of
  one level out of 255, so the component silently contributes nothing.
- **Presets are UNRECORDED in the op log**, exactly like the six tonal sliders
  (ADR-052). `preset_apply` closes any open preview, `snap("Preset")`s once and
  applies; an identity stack costs no undo step.
- **One preview slot for both tools, not one each.** `LevelsPreview` became
  `TonalPreview` in the new `src/tonal_preview.rs`, and the wasm exports
  `levels_preview_begin/active/cancel` are **renamed** `tonal_preview_*`
  (`levels_preview_set` and `levels_apply` stay Levels' own). ADR-054's
  `History::generation` staleness guard moved with it and now guards both.
- UI: Enhance › Presets is a third `effectsMode` on the `effects` tool id (six
  presets; hover previews, pointer-leave restores, click commits). The sidebar's
  `effectsMode !== "levels"` became `=== "adjust"` — a negated test there
  swallows every mode added later. AppShell gains one line.
- **The Quick Adjust grid is retired in the same change** (Chris, 2026-09-16).
  `EffectsSettings.tsx` loses the `PRESETS` array, `applyPreset`, the grid JSX
  and two now-unused imports — 62 lines, 347 → 285 — leaving Adjustments as
  sliders only. Presets live in one place, not two. This takes the disabled
  **4x Upscale** placeholder with it: it sat in that grid's empty fifth cell
  and existed nowhere else.

## Consequences

+ One look is one undo step, with five components where Quick Adjust had two,
  and one place in the app to find them — the grid went rather than staying
  beside it.
+ With one slot there is no second copy to restore, so neither tool can put its
  pixels back over the other's committed ones. Killing the `generation` check
  (mutation, re-run 2026-09-15 on a scratch copy) turns one test red per file
  — `a_stale_preview_is_dropped_never_written_back` in `tests/levels.rs` and
  `a_stale_preview_is_dropped_and_never_written_back` in `tests/presets.rs` —
  and nothing else: 17 of 17 green unmutated, 15 of 17 mutated.
- **Presets break the op log the moment one is applied**, on exactly ADR-052's
  terms: undo depth drops to snapshot depth for that document, silent but for
  the `useOplogHealth` warning. That is the deliberate consequence of adding no
  `Op` — alternative 1 says why it is currently the better-behaved path.
- wasm **829,481 → 832,962 B** (+3,481); SIMD opcodes **5563 → 5765** (+202).
  Twiggy on a names-preserving build attributes +2,572 B to
  `presets::apply_stack` alone: the optimiser inlines all five SIMD filter
  bodies into it, so the shipped binary now carries a second copy of code the
  Adjustments sliders already had.
- **The rename dates ADR-054's own text**, which names
  `levels_preview_begin/cancel` — functions that no longer exist. That ADR is
  the record of the decision as it was made and is not edited; this line is
  the pointer.
- **The disabled `4x Upscale` tile is gone from the editor**, and it was the
  only place the app said that feature is coming. Same call as #150 hiding
  Create AI Image until Generate works, but it is still an affordance a user
  could see yesterday and cannot today. Two comments now point at a tile that
  does not exist (`AISettings.tsx:5`, `toolConfig.ts:96` — both "moved to
  Effects"), and `marketing/src/pages/Pricing.tsx` + `marketing/src/seo.ts`
  still sell "4× upscale" as Pro with nothing in the editor behind it.
- Anyone who reached Enhance/Vivid/Fade/Dark from the Adjustments panel finds
  them one tile over. The presets reuse the grid's brightness and contrast on
  purpose, so the looks themselves do not move under them.
- One slot is coupling: a later change to `tonal_preview.rs` for Levels moves
  presets too, and the compiler will not say so.

## Alternatives rejected

1. **Record an `Op::Preset` so presets replay.** The end state, and wrong
   today: permanent op-log surface (a `Params` type, a format bump, a parity
   test, a recorder on the one-op-one-snapshot lockstep) bought with undo depth
   the running app cannot currently deliver — **undo of ANY recorded op falls
   back to snapshot undo and marks the log broken** (measured 2026-09-15;
   ADR-054's consequences, PARKING_LOT). Unrecorded lands on that same fallback
   without the surface. Worth re-opening once the flush path is fixed, for all
   six sliders at once (ADR-052 part 3), not for presets alone.
2. **Normalise the five components onto one scale inside the engine.** Makes a
   preset new math rather than "its filters, in order", which breaks the parity
   property that pins it — a reordered or dropped component would stop failing
   a test. The trap stays; the table in `presets.rs` documents it instead.
3. **A preview slot per tool.** Two could be open at once and whichever closed
   second would restore ITS copy, erasing what the other had committed.
4. **A thumbnail per preset** (Lightroom, Google Photos). N remaps at panel
   open, which is the case that wants a dirty-rect path this engine does not
   have. One preview at a time on the real canvas is one remap per hover.
5. **`#[inline(never)]` on the five `filters::adjust_*` delegators, now.**
   Measured this session: reclaims **2,351 B** and returns SIMD opcodes to
   *exactly* the 5563 baseline. Not taken, because it edits five functions the
   six Adjustments sliders also call and the only bench here is criterion on
   the host, where `target_feature = "simd128"` is false — it would measure the
   scalar mirror while the change affects the wasm SIMD build, which is the
   vacuous-check pattern. Parked with its numbers, ready to take behind a
   wasm-level bench.

## Pre-mortem

It is six months later and this was a mistake. Most likely reason: "a preset is
just its filters, in order" held right up until the first preset that wanted
something the filters do not have — a warmth or a tint that is not saturation,
a per-channel curve — and rather than reopen this ADR somebody put the math in
`apply_stack`. The parity test still passes, because it was updated alongside;
the property it existed to protect is gone, and presets are quietly a second
adjustment engine with no op, no record and no replay. Close behind: presets
and Levels are the first two callers of a slot built for one, and the third
arrives after the comment explaining why there is only one has been skimmed
once too often.

Early warning sign: a diff that adds a line to `apply_stack` which is not a
call to `crate::filters::*`, or a new `*_preview_begin` export next to
`tonal_preview_begin`.
