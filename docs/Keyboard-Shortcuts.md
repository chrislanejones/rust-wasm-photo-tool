# Keyboard Shortcuts

> Part of the [Image Horse](../README.md) docs. See also: [Architecture](Architecture.md) · [File Map](File-Map.md) · [Change Summary](Change-summary.md).
>
> **The in-app modal is the source of truth — press `Alt + /`.** Its tool-digit
> rows are generated from the five-group registry
> (`features/tools/toolGroups.ts`), so that half cannot drift; the rest mirrors
> the real bindings in `app/src/app/useKeyboardShortcuts.ts`. This file mirrors
> the modal.
>
> Corrected 2026-07-30: this table had gone a month without a pass and four rows
> were wrong — it still described the pre-restructure ten-tool digit row, and
> `Alt + U`, `Alt + [` / `Alt + ]` and `Alt + S` had all moved or gone.
>
> Corrected 2026-08-04: the Batch row still read "Logo · Text · Rename" — **AI
> Rename** shipped with it in v7.61 and was never added here. Checked against
> `TOOL_GROUPS` rather than against the modal, because the modal generates only
> the digit rows from the registry; every sub-tool list in this file is still
> hand-written and can drift exactly like this one did.

## Tools

| Shortcut  | Action |
| --------- | ------ |
| `1`       | Enhance group (Compress · Resize · Adjustments · AI) |
| `2`       | Select group (Marquee · Magic Wand · Lasso · …) |
| `3`       | Create group (Brush · Pen · Clone Stamp · Text · Shapes · …) |
| `4`       | Edit group (Crop · Transform · Colour Picker · …) |
| `5`       | Batch group (Logo · Text · Rename · AI Rename) |

The digits select a **tool group**, not an individual tool — that changed when
the toolbar became five groups. Sub-tools are reachable by click or through the
command palette (`Alt + ,`); they have no bare-key bindings, because 34 of them
would exhaust the number row several times over.

**`6`, `7`, `8`, `9` and `0` are not bound to anything.** (`Alt + 0` is still
Reset Zoom — that is a different chord.)

## Panels

| Shortcut       | Action |
| -------------- | ------ |
| `Alt + ,`      | Command palette |
| `Alt + N`      | Toggle New |
| `Alt + T`      | Toggle Tools |
| `Alt + G`      | Toggle Gallery |
| `Alt + R`      | Toggle Review |
| `Alt + /`      | Toggle this shortcut modal |
| `Alt + S`      | Open Settings |

## Edit

| Shortcut           | Action |
| ------------------ | ------ |
| `Ctrl + Z`         | Undo |
| `Ctrl + Shift + Z` | Redo |
| `Ctrl + C`         | Copy selection / canvas |
| `Ctrl + Shift + C` | Copy to clipboard |
| `Ctrl + V`         | Paste image into the active layer |
| `Alt + D`          | Delete all images |

## Layers

| Shortcut               | Action |
| ---------------------- | ------ |
| `Ctrl + M`             | Toggle Move-layer mode |
| `Ctrl + J`             | New layer via copy (keeps the original) |
| `Ctrl + Shift + J`     | New layer via cut (clears the source) |
| `Ctrl + Shift + ]`     | Send the active layer to the front |
| `Ctrl + Shift + [`     | Send the active layer to the back |

The two reorder chords match Photoshop. "Back" means as far down as the stack
allows — the engine keeps every layer above the canvas layer, and refuses to
move the canvas layer itself, so neither chord can put the document in a state
the Layers panel could not. Both are undoable.

## Transform

| Shortcut  | Action |
| --------- | ------ |
| `Alt + F` | Flip horizontal |
| `Alt + V` | Flip vertical |

## Dragging a resize handle

Not keyboard shortcuts, but the only place `Shift` changes what a *drag* does.
**Which way it works depends on what the box means**, and the two are opposites
on purpose:

| Surface | Plain corner drag | `Shift` + corner drag |
| ------- | ----------------- | --------------------- |
| Selected image / layer ("Resize Layer"), and the paste-placement box | **keeps the aspect ratio** | frees it — a deliberate skew |
| Crop | free — any rectangle | **keeps the aspect ratio** |

Scaling a photo out of proportion is the rare intent and the one that visibly
damages the picture, so on raster surfaces it is the one that costs a modifier.
Crop is choosing a region rather than scaling a picture, so an arbitrary
rectangle stays the no-modifier case.

**Edge handles (`n` `e` `s` `w`) are always free on both surfaces** — a
single-axis drag has no second axis to reconcile, which is how Figma,
Illustrator and Photoshop behave too. The rule above is about *corner* handles.

Two other drag modifiers, unchanged:

| Gesture | `Shift` does |
| ------- | ------------ |
| Dragging a box body (move, not resize) | constrains to the dominant axis |
| Dragging a line/arrow endpoint | snaps the angle to the nearest 90° |

The policy lives in one function — `aspectLocked` in `app/src/lib/aspectLock.ts`
— so the surfaces cannot drift apart; `aspectLock.test.ts` pins the table above.

## Brush / Clone Stamp

| Shortcut      | Action |
| ------------- | ------ |
| `Alt + Click` | Set clone source point |
| `Ctrl + [`    | Decrease brush size |
| `Ctrl + ]`    | Increase brush size |

⚠️ **Unshifted only.** Until 2026-08-21 the handler did not read `shiftKey`, so
`Ctrl + Shift + [` and `Ctrl + Shift + ]` also changed brush size — undocumented
and unintended. This table listed two of the four bracket chords, so checking it
for a collision would have said the shifted pair was free. It was not. The
shifted pair is now the layer reorder above.

## View

| Shortcut               | Action |
| ---------------------- | ------ |
| `Space` (hold)         | Pan mode (grab to drag the canvas) |
| `Alt + Scroll`         | Zoom in / out |
| `Alt + =` / `Alt + -`  | Zoom in / out |
| `Alt + 0`              | Reset zoom (100%) |
| `PgUp` / `PgDn`        | Previous / next photo |

## Export

| Shortcut          | Action |
| ----------------- | ------ |
| `Alt + E`         | Export current image |
| `Alt + Shift + E` | Export all images (ZIP) |

## Dev tools

| Shortcut       | Action |
| -------------- | ------ |
| `Alt + Delete` | Toggle the Diagnostics Window |
| `Ctrl + \`     | Shipping celebration (was an undocumented easter egg) |
