# ADR-109: A stamp is a text with a box border, and the op log goes to v17
Date: 2026-11-23   Status: draft (`claude/eloquent-ramanujan-bim725`)   Relates to: ADR-050, ADR-099, ADR-104, ADR-088

## Context

Create › Stamps ("Red Stamps") burned a stamp into the pixels the moment you
clicked. A separate Rust renderer (`render_stamp_label` + `commit_red_stamp`)
drew the label at a fixed 48 px, bilinear-scaled it to `brushSize × 4` (soft
when large), tilted it −5° and pasted it. After that you could only undo it:
not move it, retype it, recolor it or resize it. There were five fixed labels
in four colors. The panel told the canvas what to stamp through a window
`CustomEvent` (`red-stamp-select`), which the AppShell refactor rules ban for
new code, and a pending stamp could take Clone Stamp's press
(`useEffectiveTool`), which `useStampTeardown` existed to prevent. The docs
and the marketing card said "JS renders the label to OffscreenCanvas", which
had stopped being true.

Text annotations already had nearly everything a stamp is: bold type, color,
a box with padding and corners, rotation, alignment, re-editing, undo, the op
log and the archive. What they did not have was a **border around the box**.

## Decision

1. **Engine: a box border.** `border: TextBorder` on `TextAnnotation`
   (`TextBorder` = `TextStroke`'s five numbers, clamp and canonical "off").
   `layer::box_border_ring` turns the box's own coverage mask (rect ∪ bubble
   tail, the mask the fill already uses) into the band of pixels within
   `width` of the mask's outside, using an exact Euclidean distance transform
   (Felzenszwalb–Huttenlocher, two separable passes, linear in the tile at
   any width). It is painted over the fill and under the text. The band is
   INSIDE the box edge, so the tile, its offset and the anchor→ink mapping
   are unchanged and the text never moves. No box (`background_kind == 0`)
   draws no border, but the value is kept. `set_text_border` follows the
   `set_text_stroke` contract: no-op with no step when nothing visible
   changes, otherwise a "Text Border" step. Every tile rebuild (edit, box,
   face, outline, align, rotation, perspective, resize, duplicate, restore)
   carries the text's own border, and a resize scales its width like the
   padding.
2. **Op log v16 → 17.** `TextParams::border` is `#[serde(skip)]` (wire layout
   pinned by `text_params_wire_layout_is_unchanged_by_the_border_field`).
   It travels as the appended `Op::TextBorder { id, width, rgba }`
   (index 27) and as a 15th `encode_annotations` element, read as a tail
   after v16's. An empty tail is a v16-or-older blob: no borders. Fixture
   `tests/fixtures/oplog/v17-text-border.*` (generator
   `capture-text-border.rs.txt`), tested in `tests/oplog_v17_text_border.rs`.
   The v16 fixtures still open and replay to the pixels the v16 engine drew.
   Re-encoding them now writes version byte 17 with identical payloads, and
   their test says so instead of comparing raw bytes. Copy look never carries
   a border (`look.rs`): it belongs to one text, not to the photo's look.
3. **Archive.** `annotations_to_json` writes `border_width` and
   `border_r/g/b/a`. `PersistedAnnotation` types them as optional; absent
   reads as 0. No Dexie bump. `restoreStoredText` passes them to
   `restore_text_annotation`'s five new last arguments.
4. **Text panel.** Background › **Border** (0–20 px), then Border Color and
   Border Opacity once it is on, only while there is a background. The commit
   sets it inside its one joined step. The textarea previews it with
   `TextBorderPreview`: its own layer, because the fill wrapper carries the
   fill's opacity and a stamp's fill is transparent. It erodes the same
   rect ∪ tail with an SVG `feMorphology` filter and keeps the eroded band.
5. **A stamp is a text.** Create › Stamps keeps its id and URL
   (`#/create/stamps`) and becomes the Text tool's **Stamps** mode (`tool:
   "text", mode: "stamps"`), as OCR already is. The panel (`StampsSettings`)
   is built from the toolbar's shared pieces, not the dashed, tinted tiles
   Red Stamps drew: the **Color** palette first (ADR-107), the five presets
   as a `ToolButtonGroup` named **Stamp** (Approved, Rejected, Draft,
   Confidential, Under Review), a **Word** field for any word, and **Size**.
   The presets take the shared palette's green, red, orange and blue, so the
   swatches show which one is picked. They are a little brighter than the
   old stamps' darker ink. The
   pick lives in `ToolSettings` (`stampLabel`, `stampColor`, `stampSize`),
   which the Text tool's click reads, so no event is needed. A click on
   empty canvas places (`lib/stamps.placeStamp`) the word in capitals: bold,
   the stamp's color, in a box (kind 1) of the same color at alpha 0, padding
   0.3 em, corners 0.12 em, border max(2, 0.08 em), centered alignment,
   rotation −5°, with its anchor solved so the tilted box is centered on the
   click (the engine pivots on the anchor, ADR-050). Add, align and border
   are ONE undo step (`joinedSetters`). A click on an existing stamp (or
   text) opens it in the Text tool's editor: retype it, drag it, turn it.
6. **Re-editing keeps a text's look.** ADR-104 recorded that "re-editing a
   text applies the panel's current" values. For a stamp that meant
   retyping it with Background on None stripped its box. Opening an existing
   text now also holds its **look** in the panel for the edit: background,
   shadow, outline and border (`lib/textLook`, `holdTextLookForEdit`). Every
   way the editor closes calls `releaseTextEditHold`, which puts back both
   the Text in Box preference and the panel's own look. The face is NOT held,
   because a face may not be registered yet (`engineFonts`).
7. **Retired.** `commit_red_stamp`, `render_stamp_label`,
   `fonts::embedded_bold`, `useRedStampTool`, the `red-stamp-select` event,
   the Stamp tool's `red` sub-mode (a stored `"red"` falls back to Clone
   through the validator), and the red-stamp branch in `useEffectiveTool`
   and `useStampTeardown`. `#/tool/stamps/red` still opens Stamps
   (`routes.ts`).

## Consequences
+ A stamp can be moved, rotated, retyped, recolored and resized at any
  time. It is sharp at any size, any word works, and it undoes, reloads,
  syncs and exports like a text.
+ The border is a general Text feature: an outlined plate, or a comic
  bubble with a black border, tail included.
+ Re-editing any text keeps its look, which closes ADR-104's listed cost
  for everything except the face.
+ Less code: one renderer and one event path fewer; Clone Stamp's press is
  its own again.
- Stamps placed before v17 are pixels and stay pixels. Nothing converts.
- `TextParams` has seven skipped fields now. Each new text property still
  costs a version bump, a variant and a tuple tail behind all the others.
- The preview's erode kernel is square where the engine's distance is
  round, so on a rounded corner the border's inner edge can differ by a
  pixel in the preview (the outside edge cannot).
- A stamp is now a text, so a click on one with the Stamps tool opens it for
  editing rather than placing a second stamp on top. Clicking empty canvas
  places one.
- The Stamp tool's mode row has two tiles (Clone, Emoji), and the Text
  tool's has four (Text, Background, OCR, Stamps).
- wasm 1,122,267 → 1,128,479 B (+6,212). Both built with
  `scripts/build-wasm.sh` in this session, base from `HEAD` `3f56626`. It
  covers the border and the op, less the old stamp renderer.
- Another branch that takes v17 or index 27 will collide. None did on
  2026-11-23 (every remote branch checked: the highest was 16).

## Alternatives rejected
- **A stamp as a text plus a rectangle shape, grouped.** Retyping would not
  resize the rectangle, the two could be pulled apart, and the shape does not
  turn with the text's pivot.
- **A border as a second, larger box behind a smaller one.** That needs an
  opaque fill. A rubber stamp's box is transparent.
- **Eroding by a square or a disc splat.** A square thins rounded corners on
  the diagonal. A splat costs the square of the width (ADR-099's pre-mortem).
  The distance transform is exact and linear.
- **A separate stamp annotation type.** A second hit-test, editor, op family
  and archive path for something Text already does.
- **Converting old stamps.** They are pixels. There is no label to recover.

## Pre-mortem
It is six months later and this was a mistake. Most likely reason: the look
hold surprised someone. Re-editing an old caption now keeps its own
background where it used to take the panel's, and a person who used re-edit
as the way to restyle a text in one click now has to open it and change the
panel. Early warning sign to watch for: a report that "the Text panel
changes when I click a text", or a restyle that does not stick after
closing the editor.
