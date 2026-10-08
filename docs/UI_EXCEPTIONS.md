# UI Exceptions

> Part of the [Image Horse](../README.md) docs. See also:
> [UI Consistency](UI_CONSISTENCY.md) · [UI Inventory](UI_INVENTORY.md).
>
> **Status:** opened **09-23-2026** (Night 1 of 7), seeded from the exclusions
> already living in `scripts/guardrails.sh`. Measured against `master` at
> `9e48f992`. Nothing here was invented; every row was already in force, just
> undocumented.

Every UI rule in this repo is enforced by a grep, and every grep in this repo
has an escape hatch. Until tonight those hatches lived as `-g '!**/File.tsx'`
flags inside `scripts/guardrails.sh`, where nobody reads them, with no reason
attached and no expiry. An exclusion with no reason is indistinguishable from
a bug that was quieted.

This file is the registry. **An exception is allowed. An undocumented one is
not.**

UI State v4 audit (10-08-2026): no new visual exception and no raised lint or
guardrail baseline. The eight remaining `direct-document-reads` are in
`features/canvas/CanvasArea.tsx` and describe the outgoing canvas geometry while it
remains visible under the transition veil. Document actions are locked and sidebar
readouts use the loaded-document accessor. Retain this measured floor until that
geometry can safely be moved; do not hide additional readouts behind this exception.
Diagnostics image metadata now uses the same accessor, including late hash isolation.

## 1. The two kinds

| Kind | How it looks | Scope |
| --- | --- | --- |
| **Annotation** | `// allow: raw-color` on the same line | One line |
| **File exclusion** | `-g '!**/Name.tsx'` in `guardrails.sh` | The whole file, forever |

Prefer the annotation. It is one line, it sits next to the thing it excuses,
and it dies with the line. A file exclusion covers code that has not been
written yet.

⚠️ The annotation must be on the **same line** as the violation. `rg -v` drops
the matching line, so a comment on the line above filters nothing and the count
does not move. This is already written in `guardrails.sh`; it cost twenty
minutes once.

**Annotations in use today: `allow: raw-color` — 0 files in `app/src`.**
The hatch has existed since the check was written and has never been taken.
Every raw color currently tolerated is tolerated by *file exclusion* instead,
which is the blunter of the two instruments.

## 2. Standing file exclusions

### `raw-colors` — baseline 22

| File | Hits it hides | Reason | Verdict |
| --- | ---: | --- | --- |
| `features/gallery/GalleryBar.tsx` | **7** | **on-photo ink** — white text and icons drawn over a thumbnail | **Legitimate** (Night 7). See below. |
| `features/canvas/CompareSlider.tsx` | **2** | **on-photo ink** — the divider and its label, over the photo | **Legitimate** (Night 7). |
| `components/MagnifierOverlay.tsx` | **1** | **on-photo ink** — the readout on a black scrim | **Legitimate** (Night 7). |
| ~~`features/canvas/CanvasArea.tsx`~~ | 0 | — | **Dropped Night 7.** |
| ~~`features/canvas/PenOverlay.tsx`~~ | 0 | — | **Dropped Night 7.** |
| ~~`lib/colors.ts`~~ | 0 | — | **Dropped Night 7.** |

Measured 09-23-2026, and the arithmetic closes exactly, which is what makes it
trustworthy:

```
raw-colors with all six exclusions   22   (the baseline, green)
GalleryBar + CompareSlider + Magnifier   +10
                                     ────
same check with NO exclusions        32   ← measured, matches
```

All six files exist on disk (checked — a missing file would also produce a
zero, and that zero would mean the opposite thing). So three of the six
exclusions can be deleted today without moving the count by one. They are not
protecting anything; they are only removing three files from the reach of a
check that will otherwise catch the next raw color someone puts in them.

**Done Night 7 (09-29-2026).** The three dead globs are gone from
`guardrails.sh`, and `raw-colors` still reads **22** — the prediction held.

**Why the other three stay, and what would retire them.** All ten hits are the
same thing: white drawn on top of a PHOTO — a count over a thumbnail, a check
mark, the compare divider, a magnifier readout. That ink must be white in both
themes, because the photo under it does not change with the theme; a theme
token such as `text-theme-primary` would turn it dark in light mode and it
would vanish. So they are not drift. What is missing is a token that SAYS
"on a photo": e.g. `--color-on-photo: #fff` in both themes and `text-on-photo`
/ `bg-on-photo`. Swapping to it is pixel-identical (white stays white) and would
let all three exclusions go. **Not done:** naming a new token is a design
decision, so it is a proposal for Chris, not a night's change.

### `z-index` — baseline 4

| File | Hits it hides | Reason | Verdict |
| --- | ---: | --- | --- |
| `features/gallery/GalleryBar.tsx` | **7** | **local stacking inside one thumbnail**: scrim `z-10`, label `z-20`, the two corner buttons `z-30` | **Legitimate** (Night 7). The `--z-*` tokens name APP layers (dialog, sticky nav); these never leave the tile's own stacking context, and naming them as app layers would be wrong. |
| ~~`app/AppShell.tsx`~~ | 0 | Read on 10-06-2026 (UI Night 8). The three were the narrow-window drawer scrim (`z-[20]`), the Batch grid's "No photos loaded" overlay (`z-10`) and its "Selected" pill (`z-20`). | **Retired 10-06-2026.** All three are tokens now with the same values: `--z-scrim` (new, 20), `--z-canvas-overlay` (10) and `--z-compare` (20, "NEW pill" — the Selected pill is the same kind of thing). The glob is gone from `guardrails.sh` and `z-index` still reads 4. |

Measured 09-23-2026: 10 hidden against a visible baseline of 4. Since
10-06-2026 it is 7, all in the one thumbnail. Of every UI check, this is the one
whose real number is furthest from its reported one: the inventory found 15
`z-` uses across 6 files, and two thirds of them sit behind these two globs.

### `as-any` — baseline 0

| Exclusion | Reason | Verdict |
| --- | --- | --- |
| `*.d.ts` | Generated declarations, not hand-written app code. | Correct, keep. |
| Lines starting `//`, `/*` or `*` | `\bas any\b` matches **English**, and did — a comment reading "…corrected itself as soon as any other dependency moved" turned the gate red. | Correct, keep, and it is documented in the script. |

This is the model the rest should follow: the exclusion is narrow, the reason
is written where the exclusion is, and it was verified by planting a real cast
and watching the count go to 1.

### `type-scale` — baseline 8

**No exclusions.** The only UI check with none.

### `rust-panics` — baseline 47

Annotation-only (`// allow: rust-panic`, 98 sites in `src/`). Not a UI rule;
listed so this registry is the whole picture rather than most of it.

## 3. Open, as measured 09-23-2026

Two ratchets on `master` are currently reporting **IMPROVED** — the code got
better and the baseline was never lowered to lock it in:

| Check | Baseline | Actual |
| --- | ---: | ---: |
| `rust-panics` | 47 | **46** |
| `librs-lines` | 4808 | **4763** |

Neither came from this branch (Night 1 touched no Rust and no component). They
are free tightenings sitting on the floor. Not taken here, because a docs
branch that quietly edits the blocking CI gate is the wrong shape — but they
should be taken, and they belong to whoever next opens `guardrails.sh`.

## 4. Adding an exception

1. Try the annotation first: `// allow: raw-color` on the offending line, with
   a few words saying why on the same line or just above.
2. If it truly has to be a file exclusion, add a row here **in the same
   commit** as the `-g '!**/…'` flag: what it hides, why, and when it gets
   reviewed.
3. Never raise a baseline. That is the one move `guardrails.sh` exists to
   prevent, and the script says so itself.
4. A comment that merely *mentions* a forbidden pattern is not an exception —
   it is a false positive. Reword the comment. (`role="button"` in prose turned
   the job red once; `\bas any\b` in prose turned it red again.)

## 5. Raw `<button>` outside `components/ui/` — the registered floor

**Opened 10-06-2026 (UI Night 8).** `ui-raw-button` went from **32 to 14**:
18 were converted (to `ui/button`, `ui/info-tooltip` or `ui/switch`). These
14 are what is left, and each one is here on purpose. `guardrails.sh` checks
that every file with a raw `<button>` has a row in this table
(`unregistered-raw-button`, baseline 0), so the ratchet's floor is a list of
reasons, not a number.

| File | Buttons | Kind | Why not a primitive | Registered |
| --- | ---: | --- | --- | --- |
| `components/ColorPickerDialog.tsx` | 1 | swatch "+" circle | "Save to palette": a 28px dashed circle that sits in the swatch row as one of the swatches. No primitive is round. | 10-06-2026 |
| `components/ColorSwatchGrid.tsx` | 1 | swatch "+" circle | "Pick a custom color": the same circle, same reason. | 10-06-2026 |
| `components/DimensionFields.tsx` | 1 | aspect lock | A 34×34 toggle sized to the two `NumberField`s beside it. `ToggleButtonGroup` is a 38px pill and `Button` has no square toggle size; adding one is a primitive change for one caller. | 10-06-2026 |
| `components/SubscriptionButton.tsx` | 1 | the Settings rail | The Settings modal's vertical tab list. `segmented-tabs` is horizontal. It wants its own primitive (`role="tablist"`, arrow keys), which is a separate change. | 10-06-2026 |
| `features/canvas/GridThumbnails.tsx` | 1 | thumbnail overlay | The Batch grid tile: the whole photo is the hit area. | 10-06-2026 |
| `features/canvas/HistogramView.tsx` | 1 | HistogramView | The RGB / Luma pair is styled by the component's inline `CSSProperties`, like the rest of the histogram. Moving it means moving the whole view to classes. | 10-06-2026 |
| `features/canvas/ShapeActionsOverlay.tsx` | 1 | canvas overlay | Connector ports, positioned on the shape in canvas coordinates. | 10-06-2026 |
| `features/gallery/GalleryThumbMark.tsx` | 2 | thumbnail overlay | The sync mark pill on a thumbnail, and its conflict menu items (`role="menuitem"`). | 10-06-2026 |
| `features/gallery/Thumb.tsx` | 2 | thumbnail overlay | Remove and Select, the corner chips drawn over the photo in on-photo ink. | 10-06-2026 |
| `features/mobile/MobileShell.tsx` | 1 | thumbnail | The phone grid tile is itself the button. | 10-06-2026 |
| `features/tools/settings/StampSettings.tsx` | 1 | StampSettings | Each stamp preset is drawn in its own stamp color (inline style per preset): a preview of the stamp, not a button style. | 10-06-2026 |
| `features/upload/CreateAIImagePanel.tsx` | 1 | thumbnail overlay | The "×" on a reference image tile. | 10-06-2026 |
