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
> check without going red on a sentence.

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
selection needs `aria-pressed`, `aria-checked` or a native radio. A row of
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
| Cards as a radio group | `ui/radio-cards` |
| On/off switch | `ui/switch` |
| Modal | `ui/dialog` |
| Confirm | `ui/confirm-dialog` |
| Toast | `ui/sonner` |
| Tooltip | `ui/tooltip`, or `ui/info-tooltip` for a lightbulb hint |
| Pane heading | `ui/pane-heading` · section: `ui/section-header` |
| Panel footer actions | `ui/panel-action-bar` |
| Numeric field | `ui/number-field` |
| Slider | `components/SizeSlider` — **not in `ui/`**, see Inventory Finding 5 |
| Keyboard chip | the global `kbd` rule — **no component**, see Inventory §7 |

`ui/dialog` is the modal survivor; `Modal` and `SmallDialog` are being
retired, which was already decided and is tracked in `PARKING_LOT.md`.

## 5. The two questions Night 1 had to answer

**Which segmented control survives?** `tool-button-group`. It has 15
importers, 29 call sites, the clearest contract of the family (SELECT / ACTION
/ TOGGLE, each written down) and the only `aria-pressed` in the group.
`tool-mode-toggle` wraps it and stays. `segmented-tabs` (`role="tab"`) and
`radio-cards` (native inputs) are different controls doing different jobs
correctly, and stay.

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
