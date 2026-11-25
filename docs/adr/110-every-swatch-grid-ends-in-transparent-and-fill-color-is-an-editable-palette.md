# ADR-110: Every swatch grid ends in transparent, and Fill Color is an editable palette
Date: 2026-11-24   Status: draft (`land/v977`, PR #517)   Relates to: ADR-107, ADR-026

## Context

ADR-107 made a Shapes-tab shape fill first and listed the cost: outline-only
could no longer be chosen for a new rect, circle, oval, diamond, star or
triangle, and "the smallest repair is a 'no fill' swatch". Nothing in the
grids could say "no color", and the engine could not read it either:
`parse_hex_color("transparent")` read as `#transp…`, which is opaque black.
The Fill Color row was also a fixed list. A person could add colors to the
global palette, but could not replace or remove a site color.

## Decision

1. **Every `ColorSwatchGrid` reads presets → saved colors → a checkerboard
   swatch → "+".** The swatch emits the CSS keyword `transparent`
   (`TRANSPARENT`, `isTransparent()` in `lib/colors.ts`), not a hex. Grids
   whose color is ink opt out with `transparent={false}`: text, text border,
   outline and shadow, strokes, brush and pen, guides, grid, redaction,
   overlay, stamps, Batch text.
2. **Both engine parsers read `transparent` as alpha 0**: `parse_hex_color`
   (`src/drawing.rs`, `transparent_tests`) and `parse_color` (`src/lib.rs`,
   `tests/transparent_color.rs`). No op-log change: colors were already
   strings. Engine 979,674 → 980,281 B (+607).
3. **Fill Color is an editable palette** (`paletteKey="fill"`, `FILL_COLORS`,
   shared by the Shapes and Arrows tabs): replace (pencil), remove (×), add,
   Reset. `hooks/useEditablePalette.ts` keeps it in localStorage at
   `image-horse-palette:<key>`, capped at 32 like `useUserColors`. It is
   written only once edited, and an edit that lands back on the defaults
   clears it, so an untouched palette is `null` and new site colors arrive
   without a migration. Same-tab sync is a module-level listener set feeding
   `useSyncExternalStore` (ADR-026). Cross-tab sync is the browser `storage`
   event. The PR synced through a window event, `image-horse-palette-change`.
   That was replaced at landing because new window CustomEvents are banned
   (CLAUDE.md, Stage 3).
4. **No invisible shapes.** An outline-only shape lights the checkerboard.
   Picking it on a fill-first shape sets `shapeFillMode: "none"`, and a
   strokeless one gets the 2 px stroke (`ShapeSettings.tsx`).

## Consequences
+ Closes ADR-107's listed cost: a new hollow rectangle is one click again.
+ "No color" has one spelling from the grid to the engine. The New panel's
  Transparent switch and its checkerboard swatch are one state.
+ A person's Fill Color edits follow them across tabs, and a site palette
  change still reaches everyone who never edited theirs.
- **Anything new that reads a swatch color must handle `transparent`.** A
  hex-only parser drops it or, like the old engine, draws black.
  `canvasBgToRgba` (`lib/preferences.ts`) already did; the next one may not.
- The Fill palette lives in localStorage only. It does not sync across
  devices when signed in, and clearing site data loses it.
- A grid that should opt out but forgets shows a swatch that makes its ink
  invisible. The default is on, so the mistake is silent.

## Alternatives rejected
- **A `null` / `"none"` sentinel:** every color field and both engine
  parsers would need a second type. The CSS keyword is already a valid color
  string, and `canvasBgColor` already used it.
- **Store palettes in Dexie:** a palette is a preference, not image data, and
  localStorage is what the signed-out global palette (`useUserColors`)
  already uses. No schema bump for a list of strings.
- **A window event for same-tab sync:** banned for new code (Stage 3).

## Amendment 11-25-2026 — the palette is edited in the dialog

Chris: no pencil or × on the panel; they belong "on the swatch selector".
The row is plain circles now, and the pencil (replace) is gone. Its job is a
× and a "+". The "+" dialog takes the row's palette as a `palette` prop and
lists it under **Fill Color palette (N/32)**: the twelve site colors until
changed, each with a × that is always shown (the last color has none), a "+"
that adds the color being picked, and Reset once it differs. Those edits are
a DRAFT: OK saves the whole list (`useEditablePalette.set`) and uses the
color, Cancel drops them; the hook's `replace`, `add`, `remove` and `reset`
are gone. Saved colors (`useUserColors`) are listed below it when there are
any, with their own × (those still save at once, as before). The confirm
button reads OK instead of "Use color", and a transparent value opens the
dialog on the row's last solid color rather than black at 0%. Point 3 above is otherwise unchanged:
same storage, same key, same sync.
