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
| `app/AppShell.tsx` | **3** | unknown — inherited | Expected — AppShell is the stacking root, and it is being dismantled anyway. |

10 hidden against a visible baseline of 4. Of every UI check, this is the one
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
