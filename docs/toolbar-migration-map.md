# Toolbar migration map — 11 tools → 5 groups

Written during the five-group toolbar restructure (night job, 2026-07-26).
This is the mapping table the registry is built from, plus the two things the
standing rules say I must not decide alone: **ORPHAN** (exists today, has no
home in the spec) and **AMBIGUOUS** (the spec admits more than one reading).

Nothing in the ORPHAN list has been deleted or made unreachable. Everything
still works exactly as it did before the restructure.

---

## The five groups

| # | Group | id | Icon | Digit | Sub-tools |
|---|-------|----|------|-------|-----------|
| 1 | Enhance | `enhance` | `zap` | `1` | 4 |
| 2 | Select | `select` | `square-mouse-pointer` | `2` | 6 |
| 3 | Create | `create` | `palette` | `3` | 13 |
| 4 | Edit | `edit` | `square-pen` | `4` | 7 |
| 5 | Batch | `batch` | `package-open` | `5` | 3 |

Total: **33 sub-tools**. The count is the confirmation that `AI` is a single
sub-tool and not three — 4+6+13+7+3 = 33 exactly, which is the number the brief
gives. Had Background Removal / Object Removal / 4× Upscale each been their own
sub-tool the total would be 35.

---

## Enhance [zap]

| Sub-tool | Icon | tool id | mode | Panel today |
|----------|------|---------|------|-------------|
| Compress | `file-archive` | `compress` | `compress` | `ResizeSettings` |
| Resize | `scaling` | `compress` | `resize` | `ResizeSettings` |
| Adjustments | `sun-dim` | `effects` | — | `EffectsSettings` |
| AI | `bot` | `ai` | `rembg` | `AISettings` (rembg/inpaint half) |

**Adjustments** = "everything currently in Effects: brightness, contrast, etc."
The spec moves the 4× Upscale card out of Effects and into AI, so Adjustments is
EffectsSettings *minus* that one card. That is a spec-sanctioned structural
change, not behaviour drift.

**AI** is one sub-tool spanning **two** existing eraser modes (`rembg` =
Background Removal, `inpaint` = Object Removal). Entry mode is `rembg`;
`AISettings`' own mode toggle still reaches `inpaint`, exactly as today. See
AMBIGUOUS-3.

---

## Select [square-mouse-pointer]

The existing six, unchanged — these already are one exclusive set
(`SelectionKind`, collapsed into one axis in v7.47 / ADR-022).

| Sub-tool | Icon | tool id | mode |
|----------|------|---------|------|
| Magic Wand | `wand-2` | `select` | `wand` |
| Edge-aware | `scan` | `select` | `edge` |
| Magnetic Lasso | `lasso` | `select` | `lasso` |
| Color Range | `swatch-book` | `select` | `colorRange` |
| Rectangle | `square-dashed` | `select` | `rect` |
| Ellipse | `circle-dashed` | `select` | `ellipse` |

Zero risk group: it is a straight re-parent of a set that already existed.

---

## Create [palette]

| Sub-tool | Icon | tool id | mode | Panel today |
|----------|------|---------|------|-------------|
| Brush | `brush` | `brush` | `paint` | `PaintSettings` |
| Pen | `pen-tool` | `brush` | `pen` | `PaintSettings` |
| Clone Stamp | `copy` | `stamp` | `clone` | `StampSettings` |
| Blur Brush | `droplets` | `brush` | `blur` | `PaintSettings` |
| Eraser | `eraser` | `ai` | `brush` | `AISettings` |
| Magic Eraser | `wand-2` | `ai` | `magic` | `AISettings` |
| Text | `type` | `text` | `text` | `TextSettings` |
| Shapes | `shapes` | `shapes` | `shapes` | `ShapeSettings` |
| Pins | `pin` | `shapes` | `pens` | `ShapeSettings` |
| Arrow | `arrow-up-right` | `shapes` | `arrows` | `ShapeSettings` |
| Line | `minus` | `shapes` | `shapes` + kind `line` | `ShapeSettings` |
| Emoji | `smile` | `stamp` | `emojis` | `StampSettings` |
| Stamps | `stamp` | `stamp` | `red` | `StampSettings` |

**Pins** resolves cleanly despite the label: `shapesMode: "pens"` is labelled
"Pens" in `toolModes.ts` but carries a `MapPin` icon and drives `PIN_LABELS`
(Numbers / Letters) in `ShapeSettings`. It is the pin-drop feature, not the
Bézier pen. The Bézier pen is `brushMode: "pen"`, which is Create's **Pen**.
Two different features that had nearly the same name; the spec separates them
correctly.

---

## Edit [square-pen]

Every one of these is an **existing section card** in an existing panel. The
spec is describing structure the app already has, which is why this group maps
without inventing anything.

| Sub-tool | Icon | tool id | mode | Section today |
|----------|------|---------|------|---------------|
| Crop | `crop` | `crop` | — | `TransformCropSettings` § "Crop" |
| Transform | `flip-horizontal` | `crop` | — | § "Transform" |
| Perspective | `scan` | — | — | **Coming Soon** — does not exist |
| Color Picker | `pipette` | `crop` | — (+ `colorPickerActive`) | § "Color Picker" |
| Resize Layer | `move` | `arrow` | — | `LayerSettings` § "Move or Resize Layer" |
| Canvas Size | `frame` | `arrow` | — | § "Background Canvas Size" |
| Guides (H/V) | `ruler` | `arrow` | — | § "Horizontal and Vertical Guides" |

Three sub-tools share `tool: "crop"` and three share `tool: "arrow"`, because
`crop` and `arrow` are single-mode tools whose panels hold several features.
The sub-tool identity therefore cannot be derived from `(tool, mode)` alone for
this group — see **Design note** below.

**Color Picker** maps to `crop` *plus* setting `colorPickerActive: true`. That
is precisely what clicking the existing Color Picker toggle does today, so it is
behaviour-preserving rather than a new activation path.

---

## Batch [package-open]

| Sub-tool | Icon | tool id | mode |
|----------|------|---------|------|
| Logo | `image-plus` | `emoji` | `logo` |
| Text | `type` | `emoji` | `text` |
| Rename | `file-edit` | `emoji` | `rename` |

`emoji` is the legacy id for the Batch tool. Retained — load-bearing for
persistence and the `#/tool/batch` route.

---

## ORPHANS — exist today, no home in the spec

Standing rule: these stay reachable **exactly as they are today**. None has been
deleted, hidden, or unwired. Listed for Chris to decide on.

| # | What | Where it lives | Status today |
|---|------|----------------|--------------|
| O-1 | `brushMode: "erase"` | `BRUSH_MODES` + `useEffectiveTool` | **Already unreachable before this job.** It is in the store union and has a live dispatch branch, but it is absent from `PAINT_MODES`, which is what feeds SubtoolRow, the palette and the router. So no tile, no palette entry, and `setModeOf` refuses it. Pre-existing dead path — not caused by the restructure. |
| O-2 | `textMode: "background"` | `TextSettings` toggle | Spec gives Create one "Text" sub-tool. Still reachable via the Text panel's own mode toggle, unchanged. |
| O-3 | `textMode: "ocr"` | `TextSettings` toggle | As O-2. Reads text out of the image. |
| O-4 | Shape kinds `rect`, `circle`, `handCircle` | `ShapeSettings` SHAPES row | Panel-internal kinds. Only `line` was promoted to a sub-tool by the spec; the other three stay as in-panel buttons. |
| O-5 | `eraserMode: "inpaint"` | `AISettings` toggle | Folded into the single **AI** sub-tool with `rembg`. Reachable via the panel's own toggle. |
| O-6 | "Remove canvas" action | `LayerSettings` | Panel-internal, sits under Canvas Size. |
| O-7 | Effects' 4× Upscale card | `EffectsSettings` | Spec relocates it to Enhance → AI. Already a disabled "Coming Soon" placeholder; no behaviour to preserve beyond rendering it in its new home. |

---

## AMBIGUOUS — the spec admits more than one reading

Standing rule says not to resolve these by picking one. Each is implemented in
the **most conservative** way available (nothing deleted, nothing newly
unreachable) and flagged here for a decision.

### AMBIGUOUS-1 — "Eraser" in Create

Two live features are called Eraser:

- `brushMode: "erase"` — scrubs the active layer's alpha (Paint tool). **Already
  unreachable**, see O-1.
- `eraserMode: "brush"` — labelled exactly "Eraser" in `AISettings`, sits
  directly beside "Magic Eraser".

Implemented as `ai` / `brush`, because the spec lists **Eraser** and **Magic
Eraser** adjacently and those two are adjacent modes of the same panel. The
Paint eraser stays as-is (still unreachable, still not deleted).

**Decision needed:** is Paint's `erase` mode meant to come back, be deleted, or
stay dormant?

### AMBIGUOUS-2 — "Line" in Create

There is no `line` sub-mode. `line` is a **shape kind** inside the Shapes panel,
a sibling of Rectangle / Circle / Hand-drawn — one level below the sub-tool axis.
The spec lists **Shapes** and **Line** as separate sub-tools, so the two need
distinct homes but only one exists.

Implemented as: both route to the Shapes panel; **Line** additionally preselects
shape kind `line`, which is exactly what clicking the Line button does today.
This mirrors the Color Picker precedent (a sub-tool that is a tool plus a
preselected control) and adds no new state.

**Decision needed:** should Rectangle / Circle / Hand-drawn also become
sub-tools (making Create 16 wide), or should Line drop back to being a kind
inside Shapes?

### AMBIGUOUS-3 — "AI" spans two modes

**AI** is one sub-tool but Background Removal (`rembg`) and Object Removal
(`inpaint`) are two existing modes. Entry is `rembg`; the panel's own toggle
reaches `inpaint`.

Side effect worth knowing: `AISettings` has a single 4-way mode toggle
(`brush`, `magic`, `rembg`, `inpaint`) and the spec splits it across **two
groups** — `brush`/`magic` to Create, `rembg`/`inpaint` to Enhance. So using
that in-panel toggle can move you to a mode belonging to the other group, and
the lit group tile will follow. Coherent and behaviour-preserving, but it is the
one place where a panel control crosses a group boundary.

**Decision needed:** split `AISettings` into two panels along the group line, or
accept the cross-group toggle?

---

## Design note — why sub-tool identity is its own field

For 27 of 33 sub-tools, identity is `(tool, mode)` and could be derived. For the
six Edit sub-tools that share `crop` / `arrow`, it cannot: three tiles would all
resolve to the same pair and light up together.

So the registry carries a unique `subToolId` per sub-tool and the store gains an
`activeSubTool` field.

**This is deliberately NOT persisted.** `useToolStore`'s `partialize` is an
explicit allowlist and `activeSubTool` is kept out of it, so no IndexedDB schema
changes, no version bump, and the `dexie-migration` skill is not triggered. On
reload the active sub-tool is re-derived from the persisted `(activeTool, mode)`
pair, which is the same information the toolbar restored before this job.

---

## Stale premise in the brief

> "ShortcutModal must derive from the registry — it's a hand-maintained fourth
> copy that silently lost Select for three releases; kill that pattern tonight."

Already done, before this job. `ShortcutModal.tsx:11-22` builds its Tools group
from `toolConfig.ts` with a comment naming that exact Select regression. The
work here is only to keep it derived from the **new** group registry rather than
the old flat `TOOLS` array — not to fix the drift bug, which is already fixed.
