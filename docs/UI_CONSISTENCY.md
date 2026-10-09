# UI Consistency

> Part of the [Image Horse](../README.md) docs. See also:
> [UI Inventory](UI_INVENTORY.md) · [UI Exceptions](UI_EXCEPTIONS.md) ·
> [ADR-065](adr/065-the-ui-vocabulary-is-measured-before-it-is-decided.md).
>
> **Status:** written **09-23-2026**, Night 1 of 7. Every value in the tables
> below was chosen from a count in [UI_INVENTORY.md](UI_INVENTORY.md), not
> from taste. Where the count disagreed with what was proposed, the count won
> — §2 says where that happened.
>
> **This is a constitution, not a gate.** Nothing here blocks CI tonight.
> Turning a rule into a ratchet is Night 7, and only for rules a grep can
> check without going red on a sentence. **Done 09-29-2026 — see §6: R1, R3 and
> raw `<button>` are ratchets, counted from the syntax tree, not by grep.**

## 1. The ten rules

**R1 — Spacing comes off the scale.** Eight steps, in Tailwind units:
`0.5 · 1 · 1.5 · 2 · 3 · 4 · 6 · 8` (2, 4, 6, 8, 12, 16, 24, 32 px), plus `0`
where a utility exists to remove spacing. They already carry **656 of 713**
uses, 660 counting the four `-0`s. Anything else needs a line in
[UI_EXCEPTIONS.md](UI_EXCEPTIONS.md).

**R2 — Type is finished. Do not extend it.** `text-2xs` · `text-xs` ·
`text-sm` for interface text; `text-lg` and up for headings only. Eight sizes
exist and three carry 95% of the app. No `text-[13px]` — `guardrails.sh`
already watches for it.

**R3 — Radius comes from a token class.** `rounded-sm` (4px) ·
`rounded-md` (6px) · `rounded-lg` (10px) · `rounded-full` (pills only).
**Never bare `rounded`, never `rounded-xl`** — see §2, they are Tailwind
defaults that route around the house tokens.

**R4 — Color is a token. Every time.** No hex, no `rgb()`, no Tailwind gray
scale in `app/src`. A color class that names a token which does not exist
emits **no CSS and no warning** — build, then run
`node scripts/inert-class-audit.mjs`.

**R5 — One primitive per pattern.** If `components/ui/` has it, import it. A
hand-rolled copy of something that already exists is the defect, even when it
looks right — `SubscriptionButton` has its own confirm dialog while five other
files use `ui/confirm-dialog`.

**R6 — A control that expresses a choice must say which choice.** Exclusive
selection is a radio group: `role="radio"` + `aria-checked` inside a named
`role="radiogroup"`, or a native radio. `aria-pressed` is for independent
toggles only; on an exclusive set it announces N unrelated pressed/unpressed
buttons and never says they are a set (corrected on Night 2, see §7). A row of
buttons with no state announces itself to a screen reader as a row of
unrelated buttons. Today **exactly 2 of the app's 43 segmented-control
call sites expose selection state**; 3 more are action rows where silence is
right, and **38 are silent and should not be**. There are 12 real
`aria-pressed` attributes in the whole tree.

**R7 — No new z-index literal.** `z-[var(--z-*)]`. There are 15 z-uses in the
whole app and ten of them are hidden behind guardrails exclusions; this is a
small problem that stays small only if nobody adds to it.

**R8 — Keyboard reach and a visible focus ring, on every interactive thing.**
No `outline-none` without a replacement — `HOVER_RING` in `lib/styles.ts` is
the house ring, 7 consumers. WCAG 2.1 AA is a project invariant, not a nice-to-
have.

**R9 — the native `title` attribute is not a tooltip.** Use `ui/tooltip`, or
`ui/info-tooltip` when it is a hint behind a lightbulb. `title` does not appear
on touch, which is most of the phone surface, and it cannot be styled or
positioned. About **47** of these exist today (see Inventory §6 for how that
number was arrived at, because the obvious count is wrong): a backlog to work
down, not a precedent to copy.

**R10 — Every exception is registered.** Prefer a same-line `// allow: …`
annotation over a file exclusion in `guardrails.sh`, and add the row to
[UI_EXCEPTIONS.md](UI_EXCEPTIONS.md) in the same commit. **Never raise a
baseline.**

## 2. Where the measurement overruled the proposal

Night 1 was proposed with a spacing scale of `4 6 8 12 16 20 24 32`. Two of
those are wrong for this codebase, and one thing it omitted is in heavy use:

| Step | px | Uses | Proposed? | In R1? | Why |
| --- | ---: | ---: | --- | --- | --- |
| 0 | 0 | 4 | ✗ | ✅ | `gap-0`, `p-0`, `py-0`, `space-y-0` — removing spacing, not choosing an amount. |
| 0.5 | 2 | 24 | ✗ | ✅ | Omitted, but more used than 20px. |
| 1 | 4 | 103 | ✅ | ✅ | |
| 1.5 | 6 | 75 | ✅ | ✅ | |
| 2 | 8 | **185** | ✅ | ✅ | The most used value in the app. |
| 2.5 | 10 | 27 | ✗ | ✗ | Real, but retire it — `py-2.5` ×13 is the bulk. |
| 3 | 12 | 149 | ✅ | ✅ | |
| 4 | 16 | 86 | ✅ | ✅ | |
| 5 | 20 | 19 | ✅ | ✗ | Proposed, but thinner than 2px. Retire. |
| 6 | 24 | 26 | ✅ | ✅ | |
| 8 | 32 | 8 | ✅ | ✅ | Kept — it is the outermost step and has no rival. |
| 10 | 40 | 4 | ✗ | ✗ | Exception. |
| 3.5 / 12 / 24 | 14 / 48 / 96 | 1 each | ✗ | ✗ | Delete on sight. |

Radius is the sharper correction. The proposal treated `rounded` and
`rounded-lg` as a choice of house style. They are not the same kind of thing
at all:

| Class | Uses | Resolves to | Where that comes from |
| --- | ---: | --- | --- |
| `rounded` | 60 | `0.25rem` | **Tailwind default, hardcoded.** No token. |
| `rounded-lg` | 59 | `var(--radius-lg)` → 10px | House token, `styles.css:25`. |
| `rounded-md` | 37 | `var(--radius)` → 6px | House token, `styles.css:24`. |
| `rounded-full` | 35 | pill | Tailwind default, and correct. |
| `rounded-xl` | 18 | `var(--radius-xl)` → `.75rem` | **Tailwind's own theme**, not ours. |
| `rounded-sm` | 4 | `calc(var(--radius) - 2px)` → 4px | House token. |

Two things fall out of that table:

- **`rounded` and `rounded-sm` produce the identical 4px** by two different
  routes — 64 uses split across two spellings of one number, and the
  64-use-strong one is the one that ignores the tokens.
- **78 of 221 radius uses bypass the house token system entirely**
  (`rounded` + `rounded-xl`), which no check currently notices, because
  `guardrails.sh` greps for *raw colors*, not for utilities that quietly
  resolve to a framework default.

R3 therefore reads the way it does: the fix is not "pick `rounded` or
`rounded-lg`", it is "stop using the two that are not ours".

There is a third route as well. `styles.css:1598` styles the bare `kbd`
element with `border-radius: 3px` — a literal, off-scale, invisible to any
class-based audit. One more for Night 3.

## 3. The canonical vocabulary

| Axis | Canonical | Notes |
| --- | --- | --- |
| Spacing | `0.5 1 1.5 2 3 4 6 8` (+ `0`) | R1. **92%** coverage today. |
| Text | `text-2xs` `text-xs` `text-sm`, headings `text-lg`+ | R2. Already a system. |
| Radius | `rounded-sm` `rounded-md` `rounded-lg` `rounded-full` | R3. Not `rounded`, not `rounded-xl`. |
| Icon | `h-4 w-4` default (62 uses), `h-3 w-3` dense (14), `h-5 w-5` large (7) | Prefer `size-4` going forward — one class, same result. |
| Touch target | `min-h-11` (44px) | 4 uses. WCAG. Every phone control. |
| Icon button | 30px with an 18px glyph | `ui/icon-button`, and the reference the rest was matched to. |
| Color | token classes only | R4. |
| Z | `z-[var(--z-*)]` | R7. |

## 4. The primitive of record, per pattern

Import these. Do not re-implement them.

| Pattern | Primitive |
| --- | --- |
| Button | `ui/button` |
| Icon button (30px) | `ui/icon-button` |
| Segmented / single-select | `ui/tool-button-group` |
| Independent toggles | `ui/toggle-button-group` |
| Tool mode switch | `ui/tool-mode-toggle` (wraps `tool-button-group`) |
| Overlay tabs | `ui/segmented-tabs` |
| Cards as a radio group | none — `ui/radio-cards` lost its last caller and was deleted 10-05-2026 (fallow: unused file) |
| On/off switch | `ui/switch` |
| Modal | `ui/dialog` |
| Confirm | `ui/confirm-dialog` |
| Toast | `ui/sonner` |
| Tooltip | `ui/tooltip`, or `ui/info-tooltip` for a lightbulb hint |
| Pane heading | `ui/pane-heading` · section: `ui/section-header` |
| Panel footer actions | `ui/panel-action-bar` |
| Numeric field | `ui/number-field` |
| Slider | `ui/size-slider` (moved into `ui/` on Night 3, 15 importers) |
| Preset row (25 / 50 / 75 / 100) | `ui/preset-row` — a named radio group; `SizeSlider` renders it |
| One control: label, value, control, reason | `ui/control-row` |
| A tool panel's body rhythm | `ui/tool-panel` |
| Settings most strokes do not need | `ui/advanced-section` |
| "Why is this off" line | `ReasonNote` in `ui/status-note` (both `reason` slots use it) |
| Keyboard chip | `ui/kbd`. Every `<kbd>` in app/src uses it; the bare element rule was deleted 10-06-2026 (UI Night 8). The shortcuts dialog adds `.shortcut-kbd` for its keycaps |

`ui/dialog` is the modal survivor; `Modal` and `SmallDialog` are being
retired, which was already decided and is tracked in `PARKING_LOT.md`.

## 5. The two questions Night 1 had to answer

**Which segmented control survives?** `tool-button-group`. It has 15
importers, 29 call sites, the clearest contract of the family (SELECT / ACTION
/ TOGGLE, each written down) and the only `aria-pressed` in the group.
`tool-mode-toggle` wraps it and stays. `segmented-tabs` (`role="tab"`) is a
different control doing a different job correctly, and stays. (`radio-cards`
stayed too, until its one caller went; it was deleted 10-05-2026.)

Surviving is not the same as being right. `tool-button-group` emits
`aria-pressed` for TOGGLE tiles **and deliberately for no others**, so that a
plain action is never announced as "not pressed" — good reasoning, and its own
doc comment says so. The side effect is that its SELECT mode, which is 24 of
its 29 call sites, announces nothing either. The winner needs the fix too.

`toggle-button-group` also stays, but its contract is wrong. It documents
itself as independent toggles — "multiple may be on at once" — and **12 of its
14 call sites use it for an exclusive choice**, including the Sync switch from
v8.85 and the privacy switch from v8.89. `PARKING_LOT.md` already carries that
as an API smell ("9 of 11 callers", measured before those panes existed). What
is new is that the component carries **no `aria-pressed` and no
`aria-checked`**, which makes it a WCAG 2.1 AA defect rather than a tidiness
one. Highest-value item the survey turned up; a Night 2 change, not a Night 1
one.

**One tooltip or two?** Two, because there is only one implementation.
`ui/info-tooltip` imports `Tooltip`, `TooltipContent` and `TooltipTrigger`
from `ui/tooltip` — it is the lightbulb composition, a layer rather than a
rival. Both keep their names.

## 6. What a rule is allowed to become

A rule graduates to a `guardrails.sh` ratchet only when a grep can check it
**without reading prose as code**. That disqualifies more than it sounds:
`rounded-square` and `z-1` both appeared in this survey's counts and both were
words in comments. The repo has already turned CI red twice on a sentence —
once on `role="button"` inside an explanation of the role="button" rule, once
on the English phrase "as any other dependency".

The best example is from this survey, and it took three passes.
`aria-pressed` counted **21**, then **13**, then **12**. Eight of the first 21
were comments and JSDoc — two inside `tool-button-group.tsx`, explaining when
`aria-pressed` gets emitted. The thirteenth was a JSX comment in `MasterBar`
quoting the attribute to say why `IconButton` omits it, and only a human
reading the line caught that one. The caveat directly above was written an hour
before the count that ignored it. A ratchet built on any of the first two
numbers would have gone green on documentation.

So R1, R3 and R7 are ratchet candidates for Night 7. R5, R6 and R9 need a real
parser or a human. R10 needs neither — it needs this file to be kept.

**Night 7 (09-29-2026): what became a gate.** Not a grep, for the reason
above. `scripts/ui-ratchet-counts.mjs` reads the TypeScript syntax tree, where
comments are not nodes and so cannot count, and it reads a string only when it
is a class list. It self-tests on a planted snippet before it touches the repo.

| Ratchet | Rule | Baseline |
| --- | --- | ---: |
| `ui-spacing` | R1 — padding/gap/space off the scale | **53** |
| `ui-radius` | R3 — bare `rounded`, `rounded-xl`/`2xl`, arbitrary | **52** |
| `ui-raw-button` | a raw `<button>` outside `components/ui/` | **37** |

Every baseline was reconciled against the text inventory line by line: each
hit the text finds and the parser does not is a comment, a test, a JS
identifier (`rounded: 16`) or a directional house radius the text regex cuts
short (`rounded-r-full` read as `rounded-r`). Proven both ways: a real
`<button className="rounded p-5">` turns all three red; the same text in a
comment, or as a sentence, moves none of them.

**Night 8 (10-06-2026): paid down.** `ui-spacing` 51 → **42**, `ui-radius` 50
→ **22**, `ui-raw-button` 32 → **14**. The 18 bare `rounded` were renamed to
`rounded-sm` (same 4px, proven 0 px element by element); six more hits were
not radius at all but the Text tool's corner-preset VALUES, which the counter
now reads as values. The 14 raw buttons left are each registered in
[UI_EXCEPTIONS.md](UI_EXCEPTIONS.md) §5, and `unregistered-raw-button`
(baseline 0) fails on one that is not.

R7 was already a ratchet (`z-index`). Its GalleryBar exclusion was reviewed and
kept — see UI_EXCEPTIONS.md. The raw-button count had grown 34 → 37 since
Night 3, all in Night 6, while nothing was watching it; that is the argument
for the gate in one number.

## 7. The semantic contract: four modes (Night 2, 09-24-2026)

Every row-of-buttons control is in exactly one of these modes. Nights 3 to 6
build on this table. It is the reason R6 reads the way it does.

| Mode | Means | Semantics | Keyboard |
| --- | --- | --- | --- |
| **ACTION** | a button that does something | none: a plain `<button>` | one Tab stop per button |
| **TOGGLE** | independent on/off, several may be on | `aria-pressed` on each | one Tab stop per button |
| **SELECT** | exactly one of N | `role="radiogroup"` with an accessible name on the container; `role="radio"` + `aria-checked` on each option | **one** Tab stop for the group (the checked option); arrows move and select; Home/End |
| **SWITCH** | one binary control with no visible pair | `ui/switch`, or `role="switch"` + `aria-checked` | one Tab stop |

**How each primitive picks its mode.**

| Primitive | ACTION | TOGGLE | SELECT |
| --- | --- | --- | --- |
| `ui/tool-button-group` | no `value` prop | an option carries its own `active` (per tile; a group can mix ACTION and TOGGLE tiles, as Guides does) | a `value` prop is passed, even `undefined` |
| `ui/toggle-button-group` | not used today | the default: every item carries `active` | `mode="select"` |

`tool-button-group` derives its mode from props it already had, so none of
its 29 call sites needed a new prop to be correct. `toggle-button-group`
cannot do that. Every item carries `active` whether the set is exclusive or
not, and "exactly one is on right now" does not prove "only one can be on".
So exclusivity is declared, not inferred. That costs one prop at 12 call
sites, and it was the honest price.

**The name.** A radio group must have an accessible name. It comes from, in
order: an explicit `aria-labelledby` pointing at the rendered heading (the
Settings panes pass the `PaneHeading` id); the group's own `label` prop
(`tool-button-group` wires it up with `aria-labelledby` automatically); or an
explicit `aria-label` that repeats the visible heading text (tool panels,
where the heading is a `SectionHeader` or a bare `<label>`).

**What SELECT does not change.** How it looks. The lit tile, the pill and the
spacing are the same classes as before. The only visible difference is that
the focus ring moves with the arrow keys.

## 8. The tool-panel grammar (Night 3, 09-25-2026)

One panel = these parts, top to bottom. Every name was checked against the
Night 1 inventory first; where a part already existed it was reused, not
renamed.

| Part | Primitive | New? | Notes |
| --- | --- | --- | --- |
| Frame | `ToolPanel` | new | `space-y-4`, nothing else. Needed: Crop was at 12px with a `-mt-2` while Paint and Eraser were at 16px |
| Header | `SectionHeader` | reused | No `ToolHeader`; that would have been a second name for this |
| Primary control | whatever the tool's main choice is | — | Crop's Ratio grid, Blur's mode row |
| Control rows | `ControlRow` (and `SizeSlider` on it) | new | `data-slot` label / value / control / reason. Header to control is 8px everywhere |
| Presets | `PresetRow` | new | Radio group named "<label> presets" |
| Advanced | `AdvancedSection` | new | Collapsed by default, last before the actions; closed summary names the state inside |
| Actions | `PanelActionBar` | reused | Gained `reason` |

**Measured (1280px, DOM probe, same fixture):**

| Panel | Header offset | Row gap | Label to control |
| --- | --- | --- | --- |
| Paint | 0 → 0 | 16 → 16 | 6 (sliders), 4 (Color, Stabilizer) → **8** |
| Eraser | 0 → 0 | 16 → 16 | 6 / 4 → **8** |
| Crop | **−8 → 0** | **12 → 16** | 8 → 8 |

**Where Paint and Crop disagreed, and what changed in the primitive:**

| Disagreement | Paint | Crop | Resolution |
| --- | --- | --- | --- |
| Panel rhythm | 16px via ToolModeToggle | 12px + `-mt-2` | `ToolPanel` owns the number; ToolModeToggle renders it too |
| Label → control | 6px (`SizeSlider`) | 8px (`ToolButtonGroup` label) | `ControlRow` is 8px; the slider moved, not the 15 tile-group importers |
| How a group is named | `StabilizerRow`: bare `<label>` + `aria-label` repeating it | `ToolButtonGroup label="Ratio"` | `ControlRow` hands the control its label id: `aria-labelledby` the words on screen |
| Disabled with no reason | none disabled | Apply Crop greyed, silent | `reason` slot on both `ControlRow` and `PanelActionBar`, one `ReasonNote` |
| Value slot | sliders show one | tile grids do not | `value` is optional; a lit tile already says its state |

**Semantics added on the way (R6):** preset rows and the color swatches were
exclusive choices that announced nothing. Both are named radio groups now,
one Tab stop each. The swatch group sits on a `display: contents` element so
the swatches and the "+" still wrap as one row; Chromium keeps the role
(checked in the accessibility tree, and pinned by `e2e/ui-night3-panels.spec.ts`).

**Focus (R8):** a range input's only keyboard focus cue was a 15%-alpha thumb
halo, 1.14:1 on the light panel and 1.47:1 on the dark. Ranges now get the
house dashed ring on `:focus-visible` (styles.css).

**Night 8 (10-06-2026): the remaining panels.** Same probe, 1280, both
themes, identical in each. "First row" is the frame's first row against the
body's top; rows are the frame's own gaps; label → control is every
ControlRow (and the SectionHeader → next row where a section starts).

| Panel | Before | After |
| --- | --- | --- |
| Adjustments | no frame · −8 · 12 · 8 | frame · 0 · 16 · 8 |
| Levels | no frame · −8 · 12 · 8 | frame · 0 · 16 · 8 (+ the Curve row, §9 dot) |
| Presets | no frame · −8 · 12 | frame · 0 · 16 |
| Resize & Compress | content at +2 (−8 then +10) | content at 0; 32px between its three groups kept on purpose |
| Layers / Canvas Size / Guides | no frame · −8 · Canvas 12 to its control, Layer label 4 | frame · 0 · 8 everywhere |
| Select, Perspective, Stamp | already on it | unchanged (bare `<kbd>` → `Kbd`) |
| Text | no frame · 0 · 20 · Font Family 16 | frame · 0 · 16 · 8 |
| Batch (5 tools) | 12 / 20 / 24 per tool, `pt-1` nudges | one 16 |
| Shapes | −8 · Fill label 4 | 0 · 8 |

Pinned by `e2e/ui-night8-finish.spec.ts` on 14 panels (in CI).
`ToolButtonGroup` has no `label` any more: ControlRow's slot is the one place
a control's words go.

**390px has no tool panels.** Phone width is the "Mobile version" (upload and
download only). The panel's small-window surface is 960px dock mode, which the
Night 3 screenshots add.

## 9. Whose value is it? Per-photo, per-tool, app (09-30-2026)

"When I switch photos I can't tell whether the numbers belong to this photo or
are left over from the last one." Every panel control is one of these kinds,
and the kind decides what a photo switch does to it. The panels that are
per-photo render inside `features/tools/PerPhotoRegion`, which names the photo
("3 of 12 · IMG_2041"), re-highlights on every switch, and locks (with in-place
skeletons past 300 ms) while the new photo loads. Per-tool panels get no name.

| Kind | On a switch | Examples |
| --- | --- | --- |
| **Per-photo** | Loads from the new photo; locked until it has | Resize W/H, export quality, Levels, crop box, Canvas Size W/H, Perspective quad, layer list, selection, object-removal strokes, OCR result, Batch › Crop framing |
| **One-shot** | Nothing to keep; a delta or an action | Adjustments sliders (latch and reset — but the panel still LOCKS through a switch, because its latches and edited dots describe the photo on screen), Presets, Flip/Rotate, Apply buttons |
| **Per-tool** | Stays. Your brush doesn't change because the photo did | Brush size/hardness/opacity, stabilizer, crop RATIO, select tolerance/combine/refine, text and shape styles for NEW objects, stamp/emoji, Batch Logo/Text/Rename settings |
| **App** | Stays | Rulers & grid preferences, theme |

Per-photo panels (`PER_PHOTO_TOOLS` in ToolsSidebar): Resize & Compress, Crop &
Transform, Perspective, Adjustments / Levels / Presets, Layers / Canvas Size /
Guides. Select is per-tool at the panel level; its per-photo part (the
selection) is cleared on a switch by `usePhotoSwitchReset`.

Known exception: export quality is seeded from the previous photo until edit
archives carry it (AppShell quality seed). Guides are cleared rather than
reloaded until they are persisted per photo (`useGuidesStore` TODO).

**Night 13 audit (10-09-2026, master 315e857f):** still true. `SavedEdit`
and the version-1 `CapturedState` omit export quality; changing only the seed
would replace a preference with an engine default, not recover saved quality.
ADR-031's persisted-format work is separate (also proposed in draft #329).
Guide positions likewise have no saved field; clearing them prevents coordinates
from one photo appearing on another. Guide color remains an app preference.
The gallery caption names the collection (`12 photos · 12 max`); the Tools
footer names the active photo (`3 of 12 · filename`).

## 10. One async grammar (Plan C §3, 10-05-2026)

Every flow that waits — AI result, background removal, export, Download All,
.ora import, a large decode, a Batch pass, sync, backup — is in exactly one of
five states. It does not invent its own spinner or toast.

| State | Means | Shows |
| --- | --- | --- |
| **Ready** | nothing pending | nothing extra |
| **Loading** | fetching something that exists | skeletons in place of what it will fill |
| **Processing** | computing something new | the source stays visible and inert; progress when the length is known, ↻ when it isn't |
| **Saved** | a result landed somewhere durable | ✓, briefly |
| **Error** | it didn't work | replaces the skeleton or progress, says what failed in words, and offers an action |

The rules, and what enforces each:

1. **A picture is either a skeleton or the real thing — never a gray or
   half-loaded one.** (`useThumbImage`, `PendingImportTile`; guardrail
   `no-gray-photos`.)
2. **Nothing spins forever.** Every run has a timeout that ends in Error.
   (`hooks/useAsyncTask.ts`; `useAIJob` 60 s upload / 3 min job.)
3. **An Error is never only a message.** It carries an action — usually Try
   again. (`components/ui/async-status.tsx` takes `action`.)
4. **A superseded request is dropped, not rejected.** A photo switch replaces
   the engine document under requests still in flight; they resolve as
   "dropped", paint no error and never surface as an unhandled rejection.
   (`lib/engine/superseded.ts`, installed at boot; e2e `async-dropped`.)
5. **A pass that skips some items says how many.** "Zipped 11 of 12 — 1
   couldn't be read", "Logo applied to 10 of 12 — 2 couldn't be processed".
   (`useZipExport`, `lib/batchOutcome.ts`.)
6. **Read document state through the loaded-document accessor.** Mid-switch,
   the engine mirror still describes the outgoing photo. Components use
   `hooks/useLoadedDocument`, which is null until the requested photo is in.
   (Guardrail `direct-document-reads`, baseline 8, may only go down.)
7. **Where the surface closes, the toast is the surface.** Download and
   Download All run after their dialog has closed, so their Processing /
   Saved / Error states are a toast with the same words and the same action.

Where each flow stands (10-05-2026):

| Flow | Grammar |
| --- | --- |
| Gallery thumbnails, import | skeleton-or-photo; pending import tiles; the CARD loads like Tools (UI Night 8): past 300 ms with a tile in view empty or an import in flight, the chrome goes skeleton in place and inert, one status, 15 s cap (`GalleryLoadingRegion`, `useGalleryLoading`) |
| Photo switch | footer + canvas "Loading", panel skeletons; Error toast with Try again; superseded dropped |
| AI result / background removal | timeouts → Error with Try again |
| Download (single) | Error toast with Try again |
| Download All / ZIP | `useAsyncTask`: progress toast, skips counted, timeout, Try again |
| .ora import | `useAsyncTask` + `AsyncStatus` inline |
| Batch passes | failures counted in the end toast |
| Settings sync | already the reference (`lib/sync/status.ts`): own states, retry, timeouts |
| Edit backup | a failed cloud upload holds "Not backed up — saved on this device" in the status bar until the next upload lands |
