# ADR-025: Keyboard focus is its own visual channel, not the accent
Date: 2026-07-30   Status: draft   Records: v7.58 (shipped)

Written after the fact, recording a call already made and shipped. ADR-024 is
reserved for the engine-in-a-worker draft on `spike/engine-worker`; this takes
025 rather than colliding with it.

## Context

Three affordances land on the same tile: **selected**, **hover**, and **keyboard
focus**. `lib/styles.ts` had already given each its own CSS property so they
could all be lit at once and still be told apart — selection on `border-color`,
hover on `box-shadow`, focus on `outline`. All three used `--accent`.

Three channels turned out not to be enough, because they were one colour.
Measured in a real browser: click the Enhance tile, press `3`. Enhance goes
`aria-pressed=false` — it is not the active group — and still paints
`solid 2px rgb(252,223,194) off:2px`, because it matches `:focus-visible`.
Create, the group that IS active, paints the same colour as `border-color`. Two
tiles claiming to be current, in one hue at one width.

The gallery was worse: `.photo-thumb.selected` declared
`outline: 2px solid var(--accent); outline-offset: 2px` — byte-identical to the
global focus rule. A focused thumbnail was not merely confusable with a
multi-selected one; it was indistinguishable.

The obvious remedy — "switch to the `focus-visible:` variant so pointer clicks
don't leave a ring" — **was already implemented and does not fix this.** A mouse
click measures `:focus-visible` **false**. Chrome re-evaluates the heuristic when
keyboard input arrives, so the very shortcut that moves the active state to
another tile is what lights a focus ring on the one being left.

## Decision

**Focus gets its own colour and its own stroke: `2px dashed var(--focus-ring)`,
a neutral ink token** (`#2a2622` light / `#eeeeee` dark), defined once and used
by the global `:focus-visible` rule.

The vocabulary is now three channels in two colours:

| affordance | property | colour |
| --- | --- | --- |
| selected | `border-color` / `box-shadow` | warm accent |
| hover | `box-shadow` halo | warm accent @ 60% |
| focus | `outline`, **dashed** | **neutral ink** |

Dashed as well as neutral because on the dark theme the accent is a light cream
(`#fcdfc2`) and the ink is near-white (`#eeeeee`) — distinguishable, but not at a
glance. The stroke pattern carries it where the values sit close.

Components do not override this. `components/ui/tool-button.tsx` had its own
`focus-visible:ring-theme-ring`, which lost twice: `--ring` IS the accent, and a
`ring-*` focus ring writes the same `box-shadow` as the shared `HOVER_RING`, so
on a hovered button the two silently replaced each other. It was removed and now
takes the global outline.

## Consequences

- **Contrast went up, not down.** The focus indicator went from 2.67:1 to
  **14.3:1** on light and 15.3:1 on dark. Removing the ring was the tempting fix
  and would have been an accessibility regression; this is the opposite.
- `--accent`'s own 2.67:1 shortfall on light surfaces is untouched and still
  applies to the *selection* border. That is a token-level problem needing a
  darker light-mode accent, recorded in `lib/styles.ts`, not patched here.
- Selection markers had to stop occupying `outline` where focus needs it.
  `.photo-thumb.selected` now also marks its `border-color`, so selection
  survives when focus takes the outline over. Doing that surfaced two stale
  `border-color: transparent` resets that were no-ops until selection started
  using the channel — hover at (0,3,0) was silently erasing it.
- Form controls (inputs, selects) inherit the dashed ink ring too. Deliberate:
  one focus treatment across the app is learnable; per-widget focus styling is
  how this drifted in the first place.

## Alternatives rejected

- **Delete the focus ring.** An accessibility regression, and the reported
  problem is ambiguity, not presence.
- **Move to `focus-visible:`.** Already done. Measured `false` on mouse click —
  it cannot fix a ring that appears only once the keyboard is used.
- **A cool "system blue" focus colour.** Maximally distinct, but it imports a hue
  the palette does not have; the header of `styles.css` commits to the warm
  accent in both themes. Neutral ink is already in the palette.
- **Move DOM focus to the newly-active tile on a keyboard shortcut.** Would make
  the two rings coincide, but steals focus from wherever the user actually put it
  (a text field, the canvas) and is a behaviour change to fix a paint problem.
