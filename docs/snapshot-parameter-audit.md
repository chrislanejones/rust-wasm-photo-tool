# Phase 1 — non-pixel parameters on the Snapshot: the job is 3 setters, not a redesign

**Verdict: Phase 2 is unnecessary. The Snapshot already carries every non-pixel
document parameter except export quality — and export quality should probably
not go on it at all.**

Measured 2026-08-05 against `v7.67`. Reproduce:

```bash
node scripts/snapshot-parameter-audit.mjs .
```

---

## 1. What the Snapshot already holds

```rust
pub struct Snapshot {
    pub label: String,
    pub layers: Vec<Layer>,   // ← the whole stack
    pub active: usize,
    pub width: u32,
    pub height: u32,
    pub selection: Option<Vec<bool>>,
    pub selection_only: bool,
}

pub struct Layer {
    pub id, pub name, pub kind,
    pub visible: bool,          // ← non-pixel
    pub opacity: f64,           // ← non-pixel
    pub buf: ImageBuffer,
    pub mask: Option<Vec<u8>>,  // ← non-pixel
    pub text_annotations, pub shape_annotations,
}
```

And `restore_snapshot` puts all of it back — `self.layers`, `self.active`,
`self.width`, `self.height`, `self.selection`.

So layer opacity, visibility, name, mask, annotations, canvas dimensions, the
active layer and the selection mask are **already captured and already
restored**. The premise that these need adding to the Snapshot is false. The
struct was built right; what's missing is that three setters never push a step.

## 2. The audit, and its false-positive rate

108 exported mutators (`&mut self`, present in the `.d.ts`):

| bucket | count | meaning |
| --- | ---: | --- |
| A — snaps, writes pixels | 23 | normal |
| B — snaps, writes no pixels | 17 | candidate "undo that does not undo" |
| C — no snap, no pixel write | 56 | candidate "not undoable at all" |
| C′ — writes pixels, no snap | 12 | expected: stroke interiors |

**Bucket B is 16 false positives out of 17** — a 94% miss rate, worse than the
syncState audit's 75%, and for the same structural reason: a static scan cannot
see that the *restore* handles the state even when the *operation* writes no
pixels.

| B hit | verdict |
| --- | --- |
| `begin_draw_stroke`, `begin_blur_stroke`, `begin_pixelate_stroke`, `begin_redact_stroke` | Correct by design — snap at stroke START so the whole stroke is one step; pixels arrive in the `_move` calls |
| `remove_shape_annotation`, `remove_text_annotation` | Annotations live on `Layer`, which the Snapshot captures. Undo restores them |
| `add_layer`, `duplicate_layer`, `remove_layer`, `move_layer`, `add_layer_mask` | Layer stack is on the Snapshot |
| `crop` | `width`/`height` are on the Snapshot (the regex just missed the re-blit) |
| `select_all`, `clear_selection`, `selection_union`, `selection_subtract` | `selection` is on the Snapshot |
| **`push_compress_marker`** | **The only genuine one.** See §4 |

## 3. The actual work: three setters that never snap

From bucket C, after discarding the legitimately transient (previews, editing
state, cursors, brush settings):

| setter | field | on the Snapshot? | undoable today? |
| --- | --- | --- | --- |
| `set_layer_opacity` (layer.rs:829) | `Layer.opacity` | **yes** | no — no step is pushed |
| `set_layer_visible` (layer.rs:820) | `Layer.visible` | **yes** | no |
| `rename_layer` (layer.rs:838) | `Layer.name` | **yes** | no |

That is the entire fix. Each needs to snap; the value is already carried and
already restored. **No struct change, no serialization change, no ADR.**

Chris's report that opacity "works" is consistent: it applies correctly and
composites correctly. It simply produces no undo step, so undo skips past it to
the previous pixel edit.

Correctly excluded, for the record:

- `set_active_layer` — selecting a layer is navigation, not an edit
- `set_opacity` (lib.rs, stamp.rs) — brush opacity, a tool setting
- `set_move_preview` / `cancel_*` / `mask_paint_move` / `set_editing_*` — transient
- **Blend mode is not an engine concept.** There is no blend field on `Layer`;
  the only "blend" in layer.rs is `blend_over`, the source-over compositor. The
  Convex `layers` table has a `blendMode` column, but that table has 0 rows and
  0 client references. Out of scope, and not a gap.
- **Guides** live in `useGuidesStore` (React), never in the engine. Out of scope.

## 4. Export quality is a different kind of thing — STOP HERE

`push_compress_marker` snaps and changes nothing. Undo consumes a step, restores
identical pixels, and leaves the quality slider where it was. That is the
confirmed bug.

But quality is **not engine state**. The engine does not encode the export — the
codec worker and the JS export path do. `quality` lives in React and is passed
to the encoder. Putting it on the Snapshot means the engine owning and
serializing a value it never reads.

And it is a **persisted-format change**. The archive (`encodeArchive`, VERSION 5)
writes each undo snapshot as label + PNG + annotations. A Snapshot field that
must survive reload needs a v6 format. Per the brief's own stop condition, that
is an ADR, not a code change.

Three options, and the choice is a design decision:

1. **Quality onto the Snapshot** — engine owns an export parameter; archive v6;
   the undo genuinely reverses. Most work, most correct-feeling to a user.
2. **Remove the "Compress" marker** — stop offering an undo that does nothing.
   Smallest change, and arguably the most honest: a quality-only apply changed
   no document state, so it should not occupy a history step.
3. **Leave it.** Documented, not fixed.

I did not choose. Option 2 is defensible enough that picking 1 by default would
be building the larger thing without the argument being made.

## 5. Granularity, if the three setters get done

`set_layer_opacity` is driven by a slider. Snapping per input event would make
one drag into dozens of undo steps. The model to copy is already in the repo:
`EffectsSettings` latches brightness/contrast/saturation to the slider's
**released** position and applies one delta, so one drag is one step. The
opacity slider needs the same commit-on-release treatment at the UI layer — so
this is not literally "add `self.snap()` and done", and that UI half is the
larger part of the work.

## 6. Recommendation

- **Do §3** — three setters plus commit-on-release for the opacity slider. No
  format change, no ADR, pins cleanly with engine tests.
- **Do not do §4 without a decision.** Bring option 2 to the table before
  assuming option 1.
- **Skip Phase 2 entirely.** The Snapshot needs nothing added for §3.
