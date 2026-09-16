# ADR-056: A panel's bottom actions are one primitive, and the two-up bar pushes them apart
Date: 2026-09-16   Status: draft

## Context

"The action(s) at the bottom of a settings panel" is one job, and **six panels
were doing it four different ways**: `Button size="large" w-full` (Crop, Color
Picker), a `flex gap-2` of two `Button … flex-1` halves (Canvas Size, Levels),
a segmented Off/On `ToolButtonGroup` (Rulers & Grid), and a bare
`ToolButton className="w-full"` (Remove Object). Chris named the Edit › Crop
"Apply Crop" button as the one he wants, and asked for it to become the shared
vocabulary.

The `Button` primitive was never the drift. `button.tsx`'s own doc comment
already lists **"Apply Crop"** among the canonical `size="large"` uses, and
says width is the caller's business (*"pass `flex-1` for side-by-side, `w-full`
for stacked"*) — which is exactly the axis that fanned out. So the thing that
was missing was a **layout** owner, not a button.

Two further facts were found by measuring, not by looking:

- **The destructive label fails WCAG AA.** "Remove canvas" was
  `text-destructive` on `bg-destructive/15`, which resolves to **3.66:1 light /
  3.98:1 dark** against the 4.5:1 of WCAG 1.4.3 for 12px semibold.
  `lib/styles.ts` already documents the same 3.99:1 dark shortfall for the
  confirm-dialog button that this tint was copied from.
- **The two-up pair does not fit Canvas Size** — see Consequences. That one is
  not settled.

## Decision

A new shared primitive, `app/src/components/ui/panel-action-bar.tsx`:
`PanelActionBar` (the row) + `PanelAction` (the button).

| Choice | What | Why |
|---|---|---|
| Wrapping, not replacing | `PanelAction` renders `Button size="large"`; `button.tsx` is **untouched** | the drift was layout; the button was already right |
| `layout="full"` | one-column `grid` | a grid item stretches to its track, so the action is full-width without carrying `w-full` that `split` would then have to un-set |
| `layout="split"` | `justify-between`, secondary first in source order, each button at its own label width | Chris, 09-16, over two `flex-1` halves |
| Overflow | `flex-wrap` + `[&>*:last-child]:ml-auto` on the row, `whitespace-nowrap shrink-0` on the button | wraps the BUTTON, not the button's text, and the wrapped primary still hugs the right edge |
| Placement | **inline** — last child of panel content, scrolls with it | a sticky footer costs more vertical room than it buys in a 226px sidebar, and needs a second scroll container |
| Icons | **dropped** from Crop, Color Picker, Remove Object; `children` still takes a glyph | three of six carried an icon and three did not; "Apply Crop" does not need a picture of a crop |
| `tone="destructive"` | tint + `text-destructive-strong` | the inline six-class string CanvasResize copied, made a variant |
| `pressed` | lit treatment lifted verbatim from the eyedropper + `aria-pressed` | omitted entirely when unset — `aria-pressed="false"` on a non-toggle is a lie |

Two changes ride with it:

**`ToolButtonOption.active`** in `tool-button-group.tsx` —
`active={opt.active ?? value === opt.id}` and `aria-pressed={opt.active}`, so
the attribute exists only on tiles that opt in. This is what lets an
independent toggle live in a grid that was single-select-only, and it serves
both Guides' **Lock** (three actions + one on/off) and Rulers & Grid.

**`--destructive-strong`** in `styles.css` — `#b91c1c` light (red-700 to
`--destructive`'s red-600), `#ef6a4a` dark (the same hue lifted, because the
tint is the dark thing there). Used for the destructive **label only**; the
tint is unchanged. Both themes now clear at **≈4.9:1** — the CSS comment and
the session's re-measure differ in the second decimal on dark (4.95 vs 4.91),
and both clear 4.5.

## Consequences

+ One vocabulary for a panel commit, and five of six panels adopt it. The sixth,
  Rulers & Grid, deliberately took the tile vocabulary instead: those are two
  on/off **settings**, not commits, and commit weight on "is the grid showing"
  would be the same mismatch pointing the other way.
+ Two accessibility holes close that nobody filed: the eyedropper button's name
  changed under a screen-reader user with nothing saying it was on, and the
  destructive label was under AA in both themes.
+ Guides and Wand › Selection are now the same primitive, so the app's two 2×2
  tile grids stop being one hand-rolled grid and one component.
- **The pushed-apart layout does not fit Canvas Size, and this is open.**
  Measured at the real 226px column: secondary **124** + gap **8** + primary
  **114** = **246px**, over by 20 *before* the dynamic `→ 1920×1080` suffix
  appears (which takes it to **325px**). It degrades by wrapping rather than
  overflowing, so it lands as a two-row staircase: **54px → 84px** idle. Still
  better than the `flex-1` pair it replaces (109×**70**, labels broken over
  three lines) but it is ragged. Three options are on the table — leave it, add
  a stacked full-width `layout` for that panel, or drop the redundant dimension
  suffix — and **Chris picks, this ADR does not**.
- **Rulers & Grid changes behaviour**, not just looks: 4 buttons (two segmented
  Off/On groups) become 2 toggles, and `onChange` fires unconditionally, so
  **clicking a lit toggle now turns it OFF**. The old "On" was idempotent.
- **Tab order flipped in Canvas Size** — Remove now precedes Resize. That is a
  direct, unavoidable consequence of secondary-left; source order *is* the
  layout in a `justify-between` row.
- Guides ships `columns={4}` (51×71 tiles, one row, 71px) rather than
  `columns={3}`, which reproduces the Wand grid's tile size **exactly** (70×71)
  and strands Lock alone on a row with two dead cells. Tile-size consistency
  lost to row count; a future Guides action makes that the wrong trade.
- A second destructive token now exists. `--destructive` and
  `--destructive-strong` differing only in lightness is the kind of pair that
  gets picked by coin-flip six months out if nothing says which is for ink.

## Alternatives rejected

1. **Change the `Button` primitive** — add a `panelFooter` size or fix width
   there. `size="large"` is already correct and used outside panels (Export,
   Delete All); the fan-out was in how callers arranged it.
2. **Two equal `flex-1` halves** (the pre-existing shape). Canvas Size's primary
   label grows, and under `flex-1` it wrapped to three lines and dragged its
   sibling to the same height — **54px → 70px for both buttons** the moment the
   dimensions changed.
3. **A sticky/pinned footer.** Needs a scroll container the sidebar does not
   have, and takes permanent vertical space from short panels.
4. **Canonize the failing tint as a shared `destructive` variant.** It would
   have made **3.66:1** the app-wide standard for destructive panel text. The
   opposite of the point of a shared primitive.
5. **A solid destructive fill**, like `CONFIRM_DESTRUCTIVE`. That is a dialog's
   final "yes, delete it"; this is a panel control you can hit by accident, and
   it should not carry the same weight.

## Pre-mortem

It is six months later and this was a mistake. Most likely reason: **the Canvas
Size raggedness was never resolved**, because it looks tolerable and nothing
fails on it. A shared primitive that one of its five callers has to live around
stops being a vocabulary and becomes a suggestion — the next panel with a wide
pair quietly reaches for `flex-1` again with a comment saying "doesn't fit the
bar", and the four constructs start growing back one exception at a time.
**The warning sign is a `className` on a `PanelAction` that changes its width**
(`flex-1`, `w-full`, `min-w-*`) — that is the drift this file exists to end,
re-entering through the escape hatch.

Second most likely: `ToolButtonOption.active` is used as a general-purpose
override rather than for genuine toggles, giving a plain action a lit state and
an `aria-pressed` it has no business carrying. The warning sign is `active:`
set on an option whose handler does not flip a boolean.

## Pre-existing findings this work surfaced but did not cause

- **A lit `ToolButton`'s label measures 2.24:1 on the light theme.** That is
  every lit tile in the app, not anything introduced here. `lib/styles.ts`
  logs the **2.67:1** *non-text* version of this shortfall as "KNOWN,
  ACCEPTED" and traces it to `--accent` itself; the worse **text** shortfall
  appears nowhere in that note. Same root cause, same fix (a darker light-mode
  accent, applied once at the source), and it is not this ADR's to make.
