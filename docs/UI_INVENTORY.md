# UI Inventory

> Part of the [Image Horse](../README.md) docs. See also:
> [UI Consistency](UI_CONSISTENCY.md) · [UI Exceptions](UI_EXCEPTIONS.md) ·
> [ADR index](adr/INDEX.md).
>
> **Status:** measured on **09-23-2026** against `master` at `9e48f992`
> (v8.90 plus two blog commits), in the worktree `~/ai-repo/ui-night1`.
> Every number here came out of
> `node scripts/ui-inventory.mjs` or a grep printed in this document — none of
> it is estimated, and none of it is inherited from an earlier plan.
>
> **Night 1 of 7 changed no component.** This is the survey. What it found
> that is worth acting on is listed at the bottom as **Findings**, and the
> rules drawn from it live in [UI_CONSISTENCY.md](UI_CONSISTENCY.md).

## 1. How this was measured

`scripts/ui-inventory.mjs` greps `app/src` and prints a histogram per family of
visual value. It is read-only. It refuses to report at all if ripgrep is
missing, and every family carries a **probe** — a literal known to be in the
tree — so a family that matches nothing prints `VACUOUS` and exits 1 rather
than printing a reassuring zero.

That matters here more than usual. This repo has shipped a guardrails script
that could not see anything and reported every check green, and thirteen inert
Tailwind classes that produced no CSS and no warning. A zero from a broken
regex looks exactly like a zero from clean code.

What the script **cannot** do: it reads text, so it cannot tell a class from a
comment about a class. Two values in the first run were prose —
`rounded-square` in `GalleryBar.tsx:266` and `z-1` in `PenOverlay.tsx:612`,
both describing a shape in a sentence. Neither emits CSS. Counts of 1 are worth
opening before they are worth believing.

Cross-check, run against the production build in this worktree:

```
node scripts/inert-class-audit.mjs
  scanned 425 source files
  colour-utility candidates: 158 · allowlisted: 5
  No inert color utilities. TOTAL: 0
```

## 2. The vocabulary, as used

| Family | Uses | Distinct | Files | Most common |
| --- | ---: | ---: | ---: | --- |
| Control heights | 217 | 25 | 58 | `h-4` ×64, `h-3.5` ×52, `h-3` ×16 |
| Padding and gaps | 713 | **82** | 91 | `gap-2` ×93, `px-3` ×55, `space-y-3` ×37 |
| Radii | 221 | 11 | 75 | `rounded` ×60, `rounded-lg` ×59, `rounded-md` ×37 |
| Icon sizes | 136 | 26 | 52 | `h-4 w-4` ×62, `h-3 w-3` ×14, `h-5 w-5` ×7 |
| Text sizes | 282 | **8** | 74 | `text-2xs` ×135, `text-xs` ×92, `text-sm` ×40 |
| Z-layers | 15 | 5 | 6 | `z-10` ×6, `z-20` ×4, `z-30` ×3 |
| Raw colors (outside token files) | 229 | 66 | 48 | `rgba(` ×64, `#000000` ×12, `#ffffff` ×11 |
| Arbitrary px | 32 | 13 | 14 | `[18px]` ×7, `[58px]` ×5, `[60px]` ×4 |

**81 values are used exactly once**, across every family. A value used three
times is a candidate token. A value used once is an exception or a deletion.

### What the shape of it says

**Type is already a system.** Eight distinct sizes across 282 uses, and three
of them carry 95% of the traffic. `text-2xs` is a real token
(`--text-2xs: 0.625rem` in `styles.css:358`), not a stray. There is nothing to
fix here; there is something to write down.

**Spacing is not.** 82 distinct values across 713 uses is the worst ratio in
the table, and 27 of those values appear once. This is where a canonical scale
earns its keep.

**Radii look like a 60/59 split and are not.** `rounded` (60) and `rounded-lg`
(59) read as two habits that never met, but they are not even the same kind of
thing: `rounded` is a hardcoded Tailwind default and `rounded-lg` resolves to a
house token. The full resolution table is in
[UI_CONSISTENCY.md §2](UI_CONSISTENCY.md#2-where-the-measurement-overruled-the-proposal),
and it changes the fix from "pick one" to "stop using the two that are not
ours".

**Z-layers are genuinely small.** 15 uses, 5 values, 6 files — and two of the
busiest files (`GalleryBar`, `AppShell`) are excluded from the guardrails
z-index check, which hides 10 more. See [UI_EXCEPTIONS.md](UI_EXCEPTIONS.md).

### Control heights — the full top of the list

| Count | Value | | Count | Value |
| ---: | --- | --- | ---: | --- |
| 64 | `h-4` | | 7 | `h-7` |
| 52 | `h-3.5` | | 4 | `h-16` |
| 16 | `h-3` | | 4 | `h-30` |
| 12 | `min-h-0` | | 4 | `min-h-11` |
| 10 | `h-6` | | 3 | `h-11` |
| 8 | `h-5` | | 3 | `h-14` |
| 7 | `h-2` | | 3 | `h-8` |

`h-4` and `h-3.5` dominate because they are mostly **icons**, not controls —
the two families overlap and the script counts both. The real control heights
are the small tail: `min-h-11` (4, the touch target), `h-11`, `h-8`, `h-7`.

### Padding and gaps — the long tail is the story

| Count | Value | | Count | Value |
| ---: | --- | --- | ---: | --- |
| 93 | `gap-2` | | 26 | `space-y-2` |
| 55 | `px-3` | | 25 | `px-4` |
| 37 | `space-y-3` | | 25 | `py-2` |
| 32 | `py-1.5` | | 23 | `gap-1.5` |
| 30 | `space-y-4` | | 15 | `space-y-1` |
| 28 | `px-2` | | 14 | `p-1` |
| 27 | `gap-1` | | 13 | `py-2.5` |
| 27 | `gap-3` | | 11 | `py-0.5` |
| 27 | `py-1` | | 10 | `gap-4` |

Plus **64 more values, 195 uses, 27 of them used exactly once.**

## 3. The primitives

31 components in `app/src/components/ui/`, by how many files import them.

| Component | Importers | Lines | Verdict |
| --- | ---: | ---: | --- |
| `button` | 25 | 72 | **KEEP** — the base. |
| `sonner` | 17 | 63 | **KEEP** — toasts, one owner. |
| `section-header` | 16 | 26 | **KEEP** |
| `tool-button-group` | 15 | 123 | **KEEP — canonical segmented control.** `aria-pressed` in TOGGLE mode only; see Finding 1. |
| `tooltip` | 11 | 70 | **KEEP** — the primitive. |
| `pane-heading` | 11 | 35 | **KEEP** |
| `dialog` | 11 | 233 | **KEEP** — the modal survivor (already decided, PARKING_LOT). |
| `spinner` | 10 | 87 | **KEEP** |
| `toggle-button-group` | 9 | 173 | **EXPAND** — see Finding 1. |
| `tool-mode-toggle` | 8 | 124 | **KEEP** — wraps `tool-button-group`, layered not duplicate. |
| `tool-button` | 8 | 99 | **KEEP** |
| `info-tooltip` | 7 | 38 | **KEEP** — *imports* `tooltip`, layered not duplicate. |
| `action-tile` | 7 | 26 | **KEEP** |
| `icon-button` | 6 | 159 | **KEEP** — 30px, the sizing reference. |
| `select-field` | 5 | 27 | **KEEP** |
| `confirm-dialog` | 5 | 93 | **KEEP** — see Finding 3. |
| `status-note` | 4 | 24 | **KEEP** |
| `panel-action-bar` | 4 | 138 | **KEEP** |
| `number-field` | 4 | 38 | **KEEP** |
| `reselect-bar` | 3 | 225 | **KEEP** |
| `panel-close-button` | 3 | 114 | **KEEP** |
| `field-label` | 3 | 24 | **KEEP** |
| `tiny-number-box` | 2 | 28 | **REVIEW Night 3** — overlaps `number-field` (4). |
| `swatch` | 2 | 80 | **KEEP** |
| `skeleton` | 2 | 119 | **KEEP** |
| `segmented-tabs` | 2 | 70 | **KEEP** — `role="tab"`, a different job. |
| `row-actions` | 2 | 85 | **KEEP** |
| `context-menu` | 2 | 80 | **KEEP** |
| `switch` | 1 | 46 | **REVIEW Night 2** — see Finding 2. |
| `radio-cards` | 1 | 95 | **KEEP** — native radio inputs, semantics for free. |
| `command` | 1 | 122 | **KEEP** — one palette, one consumer, correct. |

**Nothing is marked DEPRECATE.** A single importer is not evidence of a
duplicate: `command`, `radio-cards` and `switch` each have one consumer and
each is the only thing in the tree doing its job. What a low count *does* buy
is a cheap change later — `switch` can be reconsidered for the price of one
call site.

### The two families the plan asked about

**Segmented controls — the survivor is `tool-button-group`.** There are five
candidates and only two of them are actually the same thing:

| Component | What it is | Semantics |
| --- | --- | --- |
| `tool-button-group` | Single-select grid, tool panels | `aria-pressed` on TOGGLE tiles ⚠️ |
| `toggle-button-group` | Documented as independent toggles | none ❌ |
| `tool-mode-toggle` | Wrapper over `tool-button-group` | inherits the same gap ⚠️ |
| `segmented-tabs` | Overlay tabs | `role="tab"` ✅ |
| `radio-cards` | Cards over native `<input type=radio>` | native ✅ |

`tool-mode-toggle` is a layer, not a rival. `segmented-tabs` and `radio-cards`
are different controls with correct semantics. That leaves `tool-button-group`
and `toggle-button-group`, and the difference between them is the finding
below.

**Tooltips — both stay.** `info-tooltip.tsx:7` imports
`Tooltip, TooltipContent, TooltipTrigger` from `ui/tooltip`. It is the
lightbulb-with-a-hint composition, not a second implementation. Keep both.

## 4. Style constants

`app/src/lib/styles.ts` holds 17 exported class strings. By consumer files
(excluding the definition):

| Constant | Files | | Constant | Files |
| --- | ---: | --- | --- | ---: |
| `HOVER_RING` | 7 | | `CONFIRM_DESTRUCTIVE` | 2 |
| `PANEL_SECTION` | 6 | | `CONFIRM_AFFIRMATIVE` | 2 |
| `WINDOW_TITLE` | 3 | | `TILE_IDLE` | 1 |
| `FIELD_NUMERIC` | 3 | | `SUBTILE_SELECTED` | 1 |
| `DIALOG_OVERLAY` | 3 | | `SUBTILE_IDLE` | 1 |
| `BUTTON_PILL` | 3 | | `SKELETON_BASE` | 1 |
| `TILE_SELECTED` | 2 | | `FIELD_TEXTAREA` | 1 |
| `TILE_DISABLED` | 2 | | `FIELD_SELECT` | 1 |
| `PANEL_DIVIDER` | 2 | | | |

Six constants have exactly one consumer. That is not automatically waste — a
constant with one consumer still documents intent and still gives the next
caller somewhere to land — but `SUBTILE_SELECTED` / `SUBTILE_IDLE` as a pair
with one consumer each is the shape of an abstraction that was built for a
second caller who never arrived. Night 3.

## 5. Tokens

**136 distinct CSS custom properties** are defined across the stylesheets (185
declarations, so 49 are redefinitions — light/dark pairs, which is correct).
The inert-class audit above confirms every color utility referenced in
`app/src` resolves to a rule that actually ships.

## 6. What bypasses the primitives

| Bypass | Count | Note |
| --- | ---: | --- |
| Raw `<button>` outside `ui/` | **39** in 27 files | 47 including `ui/` itself, where it is correct. |
| `title="` as a native tooltip | **~47** of 107 | The raw count is misleading — see below. |
| `aria-pressed=` as a real attribute | **12** in 12 files | Against 43 segmented-control call sites (`<ToolButtonGroup` ×29, `<ToggleButtonGroup` ×14). |

Worst offenders for raw `<button>`: `GalleryBar.tsx` (4),
`SubscriptionButton.tsx` (3), then a flat tail of 2s and 1s across 25 files.
There is no single place to fix; it is a Night 4 sweep.

### `title=` — the count that looked obvious and was not

`rg -o 'title="'` returns **107**, and reading that as "107 native tooltips"
is wrong: `title` is also an ordinary prop name on half a dozen components in
this repo. Resolving each occurrence to its enclosing JSX tag:

| Enclosing tag | Count | Is it a native tooltip? |
| --- | ---: | --- |
| `SectionHeader` | 25 | ❌ heading text |
| `PaneHeading` | 17 | ❌ heading text |
| `Button` | 15 | ✅ spreads `...props` onto the DOM button |
| `ActionTile` | 11 | ✅ via `ToolButton` |
| `IconButton` | 6 | ✅ spreads `...props` |
| `ConfirmDialog` | 6 | ❌ dialog title |
| `<button>` | 6 | ✅ direct |
| `<span>` | 4 | ✅ direct |
| `ToolButton` · `BarButton` | 2 · 2 | ✅ both render `title` on a real `<button>` |
| `SelectField` · `FieldLabel` · `ReselectBar` · `ParkedScreen` · `HashBox` | 2 each | ❌ label / heading props |
| `MediaTile` · `<a>` · unresolved | 1 each | ❌ · ✅ · ? |

**11 sit directly on a DOM element, 36 more reach one through a primitive that
spreads its props — about 47. The other 60 are not tooltips at all.** Each
forwarding primitive was opened and checked rather than assumed;
`PerspectiveActionBar`'s `BarButton` is the one that gets it right, pairing
`title={title}` with `aria-label={title}`.

There are also 48 dynamic `title={…}` occurrences, not counted here, and
`toggle-button-group` sets `title={tooltip ? undefined : label}` internally on
every button it renders — so the true number of native tooltips on screen is
higher than 47, and only a runtime count would settle it.

### `aria-pressed` — the same shape, twice more

**21 → 13 → 12.** `rg -c aria-pressed` counts *lines containing the string*,
and eight of the first 21 were comments and JSDoc — two of them inside
`tool-button-group.tsx`, explaining when `aria-pressed` gets emitted. The
caveat in §1 was written an hour before the count that ignored it.

Narrowing to `aria-pressed={` gave 13, and that was still wrong: `MasterBar.tsx:93`
is a JSX comment quoting `aria-pressed={active ?? false}` to explain why
`IconButton` deliberately omits the attribute for actions. **12 real attributes
in 12 files.** Found on review, not by the grep.

Both corrections point the same way, and it is worth stating plainly: **every
number in this document that came from a bare `rg -c` should be treated as an
upper bound until someone has resolved it to real syntax.** The three in §6
have been. The histograms in §2 have not — which is exactly why §9 says none
of this is a gate yet.

## 7. Screenshots

17 captures in `.playwright-mcp/n1-*.png` — 1280px dark (8), 1280px light (6),
390px dark (3): paint tool, layers, gallery, export, and the Appearance,
Security and Sync settings panes in both themes, plus the phone Settings sheet.

**The question the plan asked — can I name the component that owns every
pattern in these shots?** Yes, but two of the owners are not where the rule
"use the primitive in `ui/`" would send you looking:

| Pattern seen | Owner | Named? |
| --- | --- | --- |
| Tool sidebar icon grid | `tool-button` in `tool-button-group` | ✅ |
| Brush size / opacity presets (`25 50 75 100`) | `tool-button-group` | ✅ |
| Stroke Stabilizer 2×2 (`Off / Low / Med / High`) | `tool-button-group` | ✅ |
| Tools / Gallery / Review in the top bar | `toggle-button-group` | ✅ |
| Compress · Delete All · Export row | `panel-action-bar` | ✅ |
| Color swatch row | `swatch` | ✅ |
| Sync on / Sync off | `toggle-button-group` | ✅ but see Finding 1 |
| The slider under every preset row | `components/SizeSlider` | ⚠️ owned, but not in `ui/` |
| Keyboard chips (`Ctrl+Z`, `Alt+/`) | a global `kbd` rule, `styles.css:1598` | ⚠️ owned by CSS, overridden 3× |

Both of those are worth writing down:

- **`SizeSlider` has 14 importers and lives in `components/`, not
  `components/ui/`.** Counted against the table in §3 it would rank fifth,
  one behind `tool-button-group` and ahead of `tooltip` and `dialog`.
  There are 5 raw `<input type="range">` in the tree and **2 of them are inside
  `SizeSlider.tsx` itself**, so only 3 sliders bypass it
  (`ColorPickerDialog`, `ReviewPanel`, `LayerSettings`). The control is
  genuinely centralized — the folder is just lying about what is a primitive.
- **`<kbd>` is styled by a bare element rule**, not a component: 8 files use
  it, and 3 of them override the global with a local class (`font-mono` in
  `AISettings`, `shortcut-kbd` in `ShortcutModal`, `font-normal
  text-muted-foreground` in `ToolGrid`). The global rule also sets
  `border-radius: 3px` — an off-scale radius no class-based inventory can
  see, because it is raw CSS.

Neither is a Night 1 change.

## 8. Findings

**Finding 1 — `toggle-button-group` has an a11y gap, on top of the API problem
already parked.** The shape of this was found before tonight:
`PARKING_LOT.md` already carries "ToggleButtonGroup: 9 of 11 callers are
single-select and compute `active` by hand", framed as an API change. The
survey confirms it and moves the number — v8.85 through v8.90 added three more
panes, so it is now **12 of 14 call sites across 9 files**:

| File | Sites | Use |
| --- | ---: | --- |
| `SecurityPane` | 3 | three exclusive pairs |
| `AppearancePane` | 2 | `value === v`, plus a reduce-motion pair |
| `GeneralPane` | 2 | `idleTimeoutMin === min`, plus a pair |
| `LayersCanvasPane` | 2 | two exclusive pairs |
| `SyncPane` | 1 | `active: shown` / `active: !shown` |
| `BetaPane` | 1 | `on` / `!on` |
| `SuperUserPane` | 1 | `mode === m` |
| `TopBar` | 1 | **genuinely independent** — Tools / Gallery / History |
| `ReviewPanel` | 1 | **genuinely independent** — `open[key]` |

**The accessibility half was noted too** — ADR-064 lists "`ToggleButtonGroup`
has no `aria-pressed`" among its costs, written the day before this survey. Two
things about it are new, and they are the ones that matter: **the scale**, and **that the obvious fix is not available**.
`toggle-button-group` emits no `aria-pressed` and no `aria-checked` at all.
`tool-button-group` does emit `aria-pressed`, but only
`aria-pressed={opt.active}` — deliberately, and the reasoning in its own
doc comment is sound: *"emitted for tiles that carry this and for no others, so
a plain action is never announced as 'not pressed'"*. The consequence is that
**SELECT mode emits nothing**, because a SELECT tile is lit from the group's
`value` and never sets its own `active`. 24 of its 29 call sites are in that mode.

Put the two together:

| Primitive / mode | Call sites | State exposed | Correct? |
| --- | ---: | --- | --- |
| `tool-button-group`, TOGGLE (options carry `active`) | **2** | ✅ `aria-pressed` | ✅ |
| `tool-button-group`, ACTION (no `value`, no `active`) | **3** | ❌ none | ✅ — actions are not toggles |
| `tool-button-group`, SELECT (`value=`) | **24** | ❌ none | ❌ |
| `toggle-button-group`, exclusive | **12** | ❌ none | ❌ |
| `toggle-button-group`, independent | **2** | ❌ none | ❌ |

**Exactly 2 of 43 segmented-control call sites announce selection state** —
`RulersGridsPane` and `LayerSettings`. Three more are action rows where silence
is correct. **38 are silent and should not be.** `tool-mode-toggle` passes
`value={activeMode}` (line 101), so the wrapper inherits the silence rather
than the attribute. The two primitives that get it right — `radio-cards`
(native inputs) and `segmented-tabs` (`role="tab"`) — are the two least used in
the whole table, with one and two importers.

So the app's entire settings surface, including the Sync switch shipped in
v8.85 and the privacy switch shipped in v8.89, reads to a screen reader as rows
of unrelated stateless buttons. And there is no well-behaved sibling to copy
from: the natural plan — "move the settings panes onto `tool-button-group`" —
fixes nothing, because that component is silent in exactly the mode those panes
would use. Whoever takes Night 2 has to add the semantics, not relocate them.

`n1-390-dark-mobile-settings-sync.png` is the clearest single frame of it:
three exclusive choices stacked on one phone screen — System setting / Dark
mode / Light mode, Animations / Reduce motion, Sync on / Sync off — and not one
of the seven buttons tells assistive tech which is chosen.

**Finding 2 — `switch` being single-use is also already parked, and the
question it raises is not.** `PARKING_LOT.md` has "RadioCards and Switch are
single-use". True: `ui/switch` is a Radix switch with the house tokens,
imported only by `features/upload/NewActions.tsx`. What the parked row treats
as a de-duplication question is really a design one — **every settings pane
that reads as a switch is a two-button `toggle-button-group`**, not a switch.
That is defensible (the pairs are labeled; a bare switch is not) but it should
be a decision on the record rather than an accident, and it is upstream of
Finding 1: if the settings panes are meant to be switches, the a11y fix is a
different fix. Night 2.

**Finding 3 — two hand-built modals remain, and this is not news.**
`SubscriptionButton.tsx` portals its own restore confirm at lines 502–530
while `ui/confirm-dialog` has five consumers, and `UploadDialog.tsx:58` is the
other. Both are **already in `PARKING_LOT.md:96`** with the right note —
"moving to `ui/dialog` is an a11y fix with a visible radius/header change".
The survey re-derived a known item rather than finding a new one; recorded
here only so R5 in the constitution has its example.

**Finding 4 — three of the six `raw-colors` exclusions in `guardrails.sh` are
dead.** Measured, and the arithmetic closes: see
[UI_EXCEPTIONS.md](UI_EXCEPTIONS.md) §2.

**Finding 5 — `components/ui/` is not the whole primitive layer.** `SizeSlider`
would rank fifth by importers and is not in it; `<kbd>` is a bare element rule
in `styles.css`. Neither is a bug and neither is urgent, but any rule phrased
as "use the primitive in `ui/`" is false as written until this is settled.
Night 3, alongside the `repo-boundaries` work.

## 9. What Night 1 did not do

No component changed. No class changed. No baseline moved. The script is an
instrument tonight, not a gate — turning any of these counts into a ratchet is
Night 7, and it needs the prose problem in §1 solved first.
