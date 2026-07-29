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

## Tools

| Shortcut  | Action |
| --------- | ------ |
| `1`       | Enhance group (Compress · Resize · Adjustments · AI) |
| `2`       | Select group (Marquee · Magic Wand · Lasso · …) |
| `3`       | Create group (Brush · Pen · Clone Stamp · Text · Shapes · …) |
| `4`       | Edit group (Crop · Transform · Colour Picker · …) |
| `5`       | Batch group (Logo · Text · Rename) |

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

## Transform

| Shortcut  | Action |
| --------- | ------ |
| `Alt + F` | Flip horizontal |
| `Alt + V` | Flip vertical |

## Brush / Clone Stamp

| Shortcut      | Action |
| ------------- | ------ |
| `Alt + Click` | Set clone source point |
| `Ctrl + [`    | Decrease brush size |
| `Ctrl + ]`    | Increase brush size |

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
