# ADR-054: Levels is one curve, previewed live from a layer copy that a history generation guards
Date: 2026-09-15   Status: draft

## Context

`Op::Levels` had an apply, serialization and tests but no producer (ADR-052):
the log could replay a Levels edit that nothing in the engine could make. #87
asks for a Levels tool with the photo updating as the sliders move. A live
preview writes into the layer on every move without taking an undo step, so it
must keep the untouched pixels and know when they stop describing the document.

## Decision

- `src/levels.rs`: black point, white point, gamma as **one curve for R, G and
  B** (alpha and fully transparent pixels untouched). Chris chose one curve over
  per-channel on 2026-09-15.
- `levels_preview_begin` copies the active layer once. `levels_preview_set`
  recomputes from the copy through a 256-entry LUT on the stack, so moves never
  compound or allocate. `levels_preview_cancel` restores the copy.
  `levels_apply` restores, snaps once, remaps, records one `Op::Levels`. A
  preview is never an undo step.
- `levels_lut` is the only copy of the math. `ops.rs` `build_levels_lut`
  delegates to it, so the live tool and replay cannot drift.
- New `History::generation: u64`, bumped on push, push_stroke, undo, redo,
  delete_entry, clear, both `inject_*_snapshot`, and at clone-stamp
  `begin_stroke` (which pushes its snapshot only at stroke end). Every preview
  write checks it first; a stale preview is dropped without writing.
- UI: Enhance › Levels tile on the `effects` tool id, told apart from
  Adjustments by a non-persisted `effectsMode`, with rows in `toolModes.ts`
  `MODE_ACCESS` + `LEGACY_SUBMODES` (`setModeOf` refuses unlisted modes and
  the tile did nothing without them) and a case in `routeState.ts`. AppShell
  gains one line, `levels={stamp.levels}`: sidebar panels have no other route
  to the engine.

## Consequences

+ `Op::Levels` has a producer, and `levels_replay_matches_live_levels_apply`
  pins live apply against replay pixel for pixel.
+ An open preview cannot write stale pixels over an undo or a newer edit.
- **Recording Levels buys no undo depth in the running app yet.** Engine-only
  runs and the Rust parity tests replay Levels undo correctly, but in the app,
  undoing ANY recorded op (a plain UI paint stroke too) falls back to snapshot
  undo and marks the log broken. Reproduced 2026-09-15: cursor stays 1,
  status "broken — snapshot undo has taken over". Pixels restore; depth is
  ADR-052's snapshot depth. The cause is in the app flush path, predates
  Levels, and is parked in `docs/PARKING_LOT.md`.
- An open panel holds one RGBA copy of the layer (48 MB at 4000×3000), and
  wasm memory does not shrink after it is freed.
- `generation` only sees writes that go through `History`. Clone stamp already
  needed a hand-placed bump; the next path that forgets one is silent.
- wasm 823,714 → 829,481 B (+5,767); SIMD instructions 5,219 → 5,563.

## Alternatives rejected

1. **Per-channel Levels** (deferred, not rejected): `LevelsParams` holds one
   black/white/gamma, so per-channel needs a new op variant and
   `OP_FORMAT_VERSION` 5 → 6.
2. **Apply button only, no live preview**: no copy, no staleness check. Chris
   chose live preview.
3. **Validity by undo depth**: undo then a new edit lands on the same depth with
   different pixels. Swapping `generation` for `undo_stack.len()` fails exactly
   `a_stale_preview_is_dropped_never_written_back` (7 of 8 in `tests/levels.rs`
   still pass; re-run 2026-09-15).
4. **Record the Adjustments sliders as `Op::Levels`**: rejected in ADR-052
   (alternative 3). The LUT cannot express them.

## Pre-mortem

It is six months later and this was a mistake. Most likely reason: Levels got
described as "the adjustment that keeps op-log undo", because the parity test
and the code comments say it keeps the log healthy, while the app flush bug
stayed parked. The one benefit that justified recording it was never delivered,
and more adjustments got recorded on the same assumption. Close behind: a new
history path skips `generation`, and a preview writes stale pixels over an edit.
The only staleness test drives a single path (undo, then Brightness).

Early warning sign: a release note or ADR saying Levels preserves undo depth
while the PARKING_LOT entry "undo of ANY recorded edit breaks the op log" is
still OPEN, or a PR that touches `undo_stack`/`redo_stack` without touching
`generation`.
