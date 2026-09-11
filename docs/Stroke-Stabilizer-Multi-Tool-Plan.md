# Stroke Stabilizer across Pen, Blur, Eraser and Clone Stamp — plan

**Status:** proposed. No code written yet.
**Goal:** the Stroke Stabilizer ("lazy mouse") that today only reaches the Paint
brush becomes available on the Pen, the Blur brush, the Eraser and the Clone
Stamp, without growing a second, third and fourth copy of the leash math.

---

## 1. What exists today

The stabilizer is **not** a brush feature — it is a feature of *one* of the
three stroke engines, the paint engine in `src/paint.rs`:

| Piece | Where |
| --- | --- |
| Level → leash table (`low` 12px, `med` 22px, `high` 36px) | `src/paint.rs:530` `leash_for` (private) |
| Trailing-tip state | `src/lib.rs:528` `paint_stab_tip`, `:543` `paint_leash`, `:545` `paint_raw` |
| Anchor / advance / catch-up | `src/paint.rs:847` `paint_stab_begin`, `:853` `paint_stab_to`, `:888` `paint_stab_flush` |
| The branch that uses it | `src/paint.rs:777` `paint_move`, `:796` `paint_up` |
| UI (one control, one panel) | `app/src/features/tools/settings/PaintSettings.tsx:185-201` |
| Setting | `ToolSettings.paintStabilizer` (`app/src/lib/types.ts:41`), default `"off"` |

Because every paint-engine driver funnels through `paint_move` / `paint_up`,
**four** drivers already inherit the stabilizer for free — `paint_down`,
`erase_down`, `mask_paint_down`, `magic_eraser_brush_down` (`src/paint.rs:539,
588, 644, 722`), each taking a `stab: &str` argument.

The other two stroke engines have no stabilizer and no hook for one:

* **Effects/Blur** — `src/effects.rs:195` `effect_down` / `:257` `effect_move` /
  `:277` `effect_up`, with its own half-radius dab interpolation.
* **Clone stamp** — `src/stamp.rs:75/105/112` `begin_stroke` /
  `continue_stroke` / `end_stroke`, with its own spacing-based interpolation.

And the **Pen** is not a stroke engine at all: it is a Bézier annotation built
in JS (`app/src/features/canvas/PenOverlay.tsx`, `penPath.ts`) and handed to
`add_bezier_annotation` as control points.

### The four tools are three different jobs

| Tool | Engine support | UI | Work |
| --- | --- | --- | --- |
| **Eraser** (Brush Eraser, and Magic Eraser) | ✅ already wired — `erase_down`/`magic_eraser_brush_down` already receive `settings.paintStabilizer` (`usePaintTool.ts:98`, `useMagicEraserTool.ts:151`) | ❌ none — `AISettings.tsx` shows Size/Opacity/Hardness only | **UI only** |
| **Blur brush** | ❌ | ❌ | Rust + wiring + UI |
| **Clone stamp** | ❌ | ❌ | Rust + wiring + UI |
| **Pen** | n/a — vector, no dabs | ❌ | JS-only, and it means something different (§6) |

The eraser being one checkbox away is the single most valuable finding here: it
ships in an afternoon and it is currently a documented-but-invisible feature
(`types.ts:39` already says "Shared by the Paint brush and the Eraser").

---

## 2. Design decision: one shared setting, one shared core

Two rules, both taken from how this repo already fails when they are broken
(`toolGroups.ts`'s header on the fourth-copy problem):

1. **One setting, not four.** Rename `paintStabilizer` → `strokeStabilizer` and
   have every tool read it. A person who turns stabilization on because their
   hand shakes wants it on everywhere; four independent dials is four places to
   discover and four places to forget. `ToolSettings` is deliberately **not**
   persisted (`useToolStore` partialize, pinned by
   `stores/persistence.test.ts:70`), so the rename needs no storage migration —
   just a repo-wide identifier change and one line in `defaultToolSettings.ts`.
   *If we would rather not touch the name at all, keeping `paintStabilizer` and
   reading it from the other panels also works; the rename is cosmetic and
   cheap, and I'd take it now rather than after four call sites exist.*
2. **One leash implementation, not four.** Extract the trailing-tip math out of
   `paint.rs` into its own module so the blur and clone engines *use* it rather
   than re-derive it.

---

## 3. Phase 0 — extract the stabilizer core (Rust)

New `src/stabilizer.rs`:

```rust
/// Trailing-tip ("lazy mouse") filter. Owns no pixels: it turns a raw pointer
/// path into the shorter, smoother path the caller should actually draw.
pub struct Stabilizer {
    leash: f64,
    tip: Option<(f64, f64)>,
}

impl Stabilizer {
    pub fn for_level(level: &str) -> Self;      // the ONE leash table
    pub fn is_on(&self) -> bool;                // leash > 0
    pub fn begin(&mut self, x: f64, y: f64);
    /// Advance toward the cursor; `Some((from, to))` is the segment to draw.
    pub fn advance(&mut self, raw_x: f64, raw_y: f64) -> Option<((f64, f64), (f64, f64))>;
    /// Catch up to the true cursor and clear. `Some(segment)` if there was slack.
    pub fn flush(&mut self, raw_x: f64, raw_y: f64) -> Option<((f64, f64), (f64, f64))>;
}
```

The math is lifted verbatim from `paint_stab_to` / `paint_stab_flush` — the same
`k = 1 - leash/dist` step, the same 0.001 flush epsilon — so **paint output stays
byte-identical**. `paint_stab_*` become three-line wrappers that call it and hand
the returned segment to `paint_stroke_to`; `leash_for` is deleted and its table
moves into `Stabilizer::for_level`.

Also export the table to JS, for the pen (§6) and for any future preview overlay:

```rust
#[wasm_bindgen]
pub fn stabilizer_leash(level: &str) -> f64
```

This is the `gaussian_kernel` precedent (`stamp_tool.d.ts:8-14`): a constant that
two languages must agree on gets exported, never ported.

**Gate:** `cargo test` green, `tests/replay_parity.rs` and
`src/ops_engine_parity.rs` unchanged and passing — replay parity is the proof
that the extraction changed nothing.

---

## 4. Phase 1 — Eraser (UI only, no engine work)

1. Add a shared presentational component
   `app/src/features/tools/settings/StabilizerRow.tsx` — the label + the four
   `ToolButtonGroup` options currently inlined at `PaintSettings.tsx:185-201`,
   taking `value` / `onChange`. Four panels will render it; none of them should
   own a copy of `STABILIZER_LEVELS`.
2. `PaintSettings` renders `<StabilizerRow>` instead of its inline block (no
   behaviour change).
3. `AISettings.tsx` renders it in the **Brush Eraser** section (after Hardness,
   ~line 200) and in the **Magic Eraser** section (after Hardness, ~line 228).
   Both already forward the setting to the engine; nothing else changes.
4. Update the mode blurb in `AISettings` the way `PAINT_MODES` does
   (`PaintSettings.tsx:64`, "Stroke Stabilizer smooths shaky drags.").

**Ships independently of everything below.**

---

## 5. Phase 2 — Blur brush, Phase 3 — Clone stamp

Both are the same shape of change: the engine gains a `Stabilizer`, the `*_down`
call gains a `stab: &str` argument, the `*_move` call filters through it, and the
`*_up` call flushes the catch-up segment.

### 5.1 Blur (`src/effects.rs`)

* `effect_down(..., stab: &str)` → `self.effect_stab = Stabilizer::for_level(stab)`
  and `begin(x, y)` when on. First dab still lands at the press point (matching
  paint, which dabs at the down point before anchoring the tip).
* `effect_move` → when the stabilizer is on, ask `advance()`; `None` means the
  cursor is still inside the leash, so **return `false`** and stamp nothing.
  `Some((from, to))` feeds the existing half-radius interpolation loop with
  `from` in place of `effect_last`.
* `effect_up` → `flush()` and stamp the final segment before taking `rec_effect`.

**Op-log:** safe by construction. `Op::Blur.points` is documented as "the EXACT
dab centres in stamp order" (`src/ops.rs:396`) and `apply_effect_dab` pushes each
centre as it stamps — so a stabilized stroke records its *post*-stabilizer
centres, exactly as `Op::Stroke` already does for paint (`ops.rs:386`). Replay
needs no knowledge of the stabilizer at all.

**Free win:** `effect_move` already returns `bool` and the shared coalescer skips
the flush on `false` (`lib/strokeCoalescer.ts`), so a leashed move costs zero
recomposites.

### 5.2 Clone stamp (`src/stamp.rs` + `src/lib.rs:2186-2212`)

* `StampState` gains a `stab: Stabilizer` field; `begin_stroke(..., stab: &str)`
  builds it and anchors at the press point.
* `continue_stroke` filters `(dest_x, dest_y)` through `advance()` before
  `stroke_to`, and **returns `bool`** (today it returns `()`), so the coalescer
  can skip the flush on a leashed move like blur and paint do.
* `end_stroke` flushes the catch-up segment *before* pushing the pre-snapshot
  onto history, so the whole stroke lands inside one undo step.
* Clear the tip in the `stroke_active = false` paths and in
  `clearCloneSource`'s abort (`useCloneStamp.ts`), so no tip survives a
  tool switch mid-drag.

**The offset stays correct.** `offset = dest - source` is fixed at
`begin_stroke`, so a lagging tip samples a source that lags by the same vector —
the clone relationship is preserved; the stroke is just smoother. Worth an
explicit test (§7) because it is the one thing a reader will worry about.

**No op-log work:** the clone stamp is snapshot-based, it has no `Op` variant.

### 5.3 JS wiring for both

| File | Change |
| --- | --- |
| `app/src/hooks/stamp_tool.d.ts` | hand-written — add `stab` to `effect_down` (:658) and `begin_stroke` (:305); change `continue_stroke` (:306) to `boolean` |
| `app/src/app/AppShell.tsx:1421` | pass `toolSettings.strokeStabilizer` to `effect_down`, add it to the `blurDown` dep array |
| `app/src/hooks/useCloneStamp.ts` | pass it to `begin_stroke`; `return await t.continue_stroke(x, y)` so the coalescer sees the bool |
| `PaintSettings.tsx` (blur case, ~:285) and `StampSettings.tsx` (clone case, ~:110) | render `<StabilizerRow>` |

No worker/proxy work: `engineSurfaceOf` enumerates the engine prototype, so a
changed signature forwards automatically (`lib/engine/engineSurface.ts`).

---

## 6. Phase 4 — Pen (a different feature wearing the same name)

The pen has no dabs to lag, so "lazy mouse" cannot mean on the pen what it means
on a brush. Two honest readings; **I recommend (a)**, and (b) is a bigger
feature that should be its own decision:

**(a) Stabilize the drag — small, obviously right.** Every pen gesture that
tracks the pointer goes through *one* handler: the window `pointermove` at
`PenOverlay.tsx:240-265`, which serves anchor drags, `in`/`out` handle pulls, and
the click-drag that pulls handles out of a fresh anchor. Applying the leash to
`(ix, iy)` immediately after `mapImg` stabilizes all of them at once:

* a `stabTipRef` reset in `startDrag` (`:518`), in the create-drag arm (`:446`),
  and in `onUp` (`:266`);
* leash from `stabilizer_leash(strokeStabilizer)` (§3) — one WASM call per drag
  start, not per move, so no per-event cost;
* on `pointerup`, snap the anchor/handle to the true cursor (the `flush`
  equivalent) so the path ends where the user let go.

This makes handle-pulling markedly less twitchy on a mouse, which is the actual
complaint the stabilizer answers. ~40 lines, no Rust, no engine calls.

**(b) A stabilized freehand pen ("magnetic/pencil" mode)** — drag to draw, and
the stabilized polyline is fitted to Béziers and dropped in as anchors. That is
the "Bézier reconstruction" line item already in
`docs/Engine-Roadmap.md:63`, wants a curve-fitter in Rust, and is a week, not an
afternoon. **Out of scope here**; noted so the roadmap keeps it.

If we ship (a), the pen's panel gets the same `<StabilizerRow>` and its blurb
says what it does ("smooths anchor and handle dragging") rather than implying it
smooths a painted line.

---

## 7. Tests

Rust (`cargo test`):

* `stabilizer.rs` unit tests: inside the leash → no segment; a pull past it →
  a segment of exactly `dist - leash`; `flush` always lands on the true cursor.
* **Extraction parity:** existing `tests/replay_parity.rs` +
  `src/ops_engine_parity.rs` must pass untouched.
* `tests/blur_stabilized_replay.rs` (new): stabilized blur stroke → op log →
  replay is byte-identical to the live buffer, the same assertion shape
  `ops_engine_parity.rs:209` already makes for the unstabilized brush.
* `tests/clone_stabilized_offset.rs` (new): with a leash on, the pixels cloned at
  the *tip* equal the source pixels at `tip - offset` — the offset-preservation
  claim in §5.2, pinned.
* Clone stroke with a leash produces exactly **one** history entry.

TS (`vitest`):

* `StabilizerRow` value/onChange round-trip.
* A registry-style contract test — "every sub-tool whose engine call accepts a
  stabilizer level renders the control" — so the next brush cannot be added with
  engine support and no UI, which is precisely the state the Eraser is in today.

E2E (`e2e/`): one spec that sets the stabilizer to High, drags a deliberately
jittery path with each of the four tools, and asserts the result differs from the
same path with it Off (and that Off is unchanged from today's baseline).

---

## 8. Order and rough sizing

| # | Step | Ships alone? | Size |
| --- | --- | --- | --- |
| 1 | Phase 1 — Eraser UI + `StabilizerRow` | ✅ | S |
| 2 | Phase 0 — extract `Stabilizer`, export `stabilizer_leash` | ✅ (no visible change) | S–M |
| 3 | Phase 2 — Blur | ✅ | M |
| 4 | Phase 3 — Clone stamp | ✅ | M |
| 5 | Phase 4(a) — Pen drag | ✅ | S |
| 6 | Setting rename + contract test | ✅ | S |

Steps 3-5 are independent of each other once 2 lands.

---

## 9. Risks and non-goals

* **Regressing paint.** The one real risk, and the extraction in Phase 0 is
  gated on replay parity precisely to catch it. The math is moved, not rewritten.
* **Blur dab order.** Blur dabs read already-blurred pixels, so order matters
  (`ops.rs:396`). The stabilizer only *chooses* centres; it never reorders them.
* **Undo granularity on the clone stamp.** Flush before the history push, or a
  stabilized stroke's tail lands outside its own undo step. Covered by a test.
* **Not in scope:** the adaptive 6-level rewrite (velocity filtering, corner
  detection, spline fitting, Assisted mode) in `docs/Engine-Roadmap.md:25-120`.
  This plan is deliberately the flat-leash stabilizer everywhere first — and
  `Stabilizer` as its own module is the seam that rewrite will need anyway, since
  it can then change algorithm once for all five tools.
