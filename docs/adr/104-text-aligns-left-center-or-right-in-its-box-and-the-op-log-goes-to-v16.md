# ADR-104: Text aligns left, center or right in its box, and the op log goes to v16
Date: 2026-11-09   Status: draft (`night/1109-text-align`, Night 11-09 PR 2)   Relates to: ADR-060, ADR-099, ADR-088

## Context

A text can have a box (wrap width since v8.40, height since v8.41), and it
survives every way back since Night 11-09 PR 1 (33a). Every line was still
drawn from the left edge. Labels, callouts and titles want centered text.
Like every text property since v2, a new one can't go into the `TextAdd` /
`TextEdit` payloads: postcard writes fields by position, so a real field
would shift every byte already in users' IndexedDB.

## Decision

1. **Engine.** `align: u8` on `TextAnnotation`: 0 left, 1 center, 2 right
   (`canonical_text_align`: any other value is left). `render_text_aligned`
   places each line at `inset = 0`, `(content − line) / 2` or
   `content − line`, rounded to whole pixels. `content` is the box's content
   width (`wrap_width` less `side_padding` each side, the width the lines were
   broken to) when the text has a box and is not left; otherwise the widest
   line, so a multi-line label with no box still centers. **Left lays out
   exactly as before**, box or not, so every existing text draws byte-identically
   (`left_is_exactly_the_old_layout_box_or_not`). No justify: greedy wrapping
   at small widths makes it look bad.
2. **Setter.** `set_text_align(id, align)`: the `set_text_stroke` contract, a
   no-op with no history step when unchanged, a "Text Align" step otherwise.
   Every tile rebuild passes the text's own `align`, so edits, the box, the
   face, the shadow, the outline, Perspective, rotation, resize and duplicate
   keep it.
3. **Op log v15 → 16.** `TextParams::align` is `#[serde(skip)]` (wire layout
   pinned by a test). It travels as the appended `Op::TextAlign { id, align }`
   (index 26) and as a 14th `encode_annotations` element, read as a tail after
   v15's. An empty tail is a v15-or-older blob: all left. Fixtures:
   `tests/fixtures/oplog/v15-text-wrap.*` (written by master's v15 engine) and
   `v16-text-align.*`, tested in `tests/oplog_v16_text_align.rs`.
4. **Archive.** `annotations_to_json` writes `align`; `PersistedAnnotation`
   types it optional; absent reads as 0. No Dexie bump. `restoreStoredText`
   passes it to `restore_text_annotation`'s new last argument, so the layers,
   the undo/redo snapshots and the export all carry it (PR 1's one path).
5. **App.** Text panel › **Align**: Left · Center · Right, beside the font
   controls, default Left (`ToolSettings.textAlign`). `commitText` sets it in
   the commit's one joined step (`lib/commitSteps`). The textarea previews it
   with CSS `text-align` (`textPreviewCss`), against the box it already sizes
   to. A callout's label takes the panel's Align, in the callout's one step.
   Copy look never carries it: it is per text, not a tonal step (`look.rs`).

## Consequences
+ Old logs, keyframes and archives open unchanged, every text left-aligned.
+ Centered and right text in a box line up against the box the user dragged,
  and with no box against the widest line.
- `TextParams` now has six skipped fields; each new text property still costs
  a version bump, a variant and a tuple tail behind all the previous tails.
- Re-editing a text applies the panel's current Align on commit, the same as
  its face and outline today; the panel does not load the text's own values.
- wasm 956,874 → 960,077 B (+3,203), from `pkg/` built after the last `.rs`
  edit: the aligned layout, the setter, the op and its tail.
- Another branch that takes v16 or index 26 will collide. None did on
  2026-11-09 (every remote branch checked).

## Alternatives rejected
- A real `align` field in `TextParams` serde: shifts the positional layout
  and mis-decodes every stored `TextAdd` / `TextEdit`.
- Baking the alignment into the text with spaces: breaks reflow and the
  Text tool's own editing.
- Justify: see 1.
- Aligning against the tile instead of the box: with a box wider than the
  text the tile is only as wide as the widest line, so "center" would center
  nothing.

## Pre-mortem
It is six months later and this was a mistake. Most likely reason: the box
and the ink disagree somewhere the tests don't look. Centering uses the
advance width of each line, the textarea uses the browser's, and the outline
(ADR-099) grows the tile outward, so a thick outline on centered text in a
narrow box may sit a few pixels off the preview. Early warning sign to watch
for: a centered, outlined text that jumps sideways on commit.

## Addendum 2026-11-10 — a 3×3 grid, and the choice is kept

Chris asked for the vertical placement too, and for the choice to stick.
Since v16 was not merged yet, it is folded into the same byte instead of
taking v17:

- **`align` = `row * 3 + column`** on a 3×3 grid: column 0/1/2 left/center/
  right (as above), row 0/1/2 top/middle/bottom. 0 is still top-left, so
  every value already written keeps its meaning (1 and 2 were top-center and
  top-right all along). `canonical_text_align` takes 0..=8.
- **The row** places the text block in a box taller than the text:
  `text::grow_to_box_height_aligned` puts the surplus below (top, the old
  layout), half above (middle) or above (bottom), in whole pixel rows.
  The box itself and the stored `x`, `y` don't move, so the editor's anchor
  mapping is unchanged.
- **Panel:** the Left/Center/Right row is replaced by a **Text in Box**
  section right above Placement: the same 3×3 `PlacementGrid`, with
  text-align icons per column (`icons="text"`). The textarea previews the
  row by moving the box's spare height into its top padding (border-box, so
  the box stays the same height).
- **Kept:** `textAlign` is a preference (`lib/preferences`, appended last),
  prefs sync format **2 → 3**, so it survives a reload and follows a signed-in
  user to their other devices. The tool settings follow the preference at
  start and on every change.

Engine 960,077 → 960,152 B (+75). Tests: rows 0/1/2 move the ink by exactly 0,
spare/2 and spare (`text.rs`); replay parity for cells 4, 6 and 8;
e2e Bottom center drops by exactly the spare height, preview included, and
the choice is still checked after a reload.

### Addendum, 11-12-2026: re-editing a text doesn't move the saved choice (11-10 Q2)

Opening an existing text still shows its own cell, but a grid change during
that edit now belongs to that text alone; only a pick made with no existing
text open is saved as the preference (`holdTextAlignForEdit` /
`isTextAlignHeldForEdit` in `stores/useToolStore`). Re-aligning an old caption
no longer changes where the next new text starts. No format change.

### Addendum, 11-12-2026: a new callout label starts centered (11-10 Q3)

A callout label used to take the Text panel's remembered cell. A NEW label
now starts at Center (cell 4, middle center) whatever that cell is
(`NEW_LABEL_ALIGN` in `hooks/usePinSteps`): a label is a caption on a pin,
and a two-line one reads best centered. It can be set to anything afterwards
with the Text tool; callouts placed before this keep the cell they were saved
with. Still one undo step with the pin. No format change.
