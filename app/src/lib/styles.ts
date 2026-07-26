// Shared Tailwind class-string constants — a single source of truth for styles
// reused across multiple components (so a tweak is one edit, not a sweep).

/**
 * Warm-accent ("brown") ring on hover. The ONE definition behind every
 * interactive tile/card: the shared `ToolButton` (and `ActionTile` through it),
 * `RadioCards`, and the main tool-rail tiles. Pair with `transition` so it
 * fades. (`theme-sidebar` === `bg-secondary` per styles.css, so the offset
 * matches both the side panels and the dialogs.)
 */
export const HOVER_RING =
  "hover:ring-2 hover:ring-theme-primary/60 hover:ring-offset-2 hover:ring-offset-theme-sidebar";

/* ─────────────────────────────────────────────────────────────────────────────
   TOOL-TILE SELECTION — the ToolGrid rail tile and the SubtoolRow tile.

   THREE affordances land on these same two elements, so each one gets its own
   CSS channel and they never fight:

     · SELECTED → `border-color`  — ink, hugs the tile edge, 0px outward
     · HOVER    → `box-shadow`    — HOVER_RING above, accent, 2–4px outward
     · FOCUS    → `outline`       — accent, 2–4px outward (styles.css
                                    `button:focus-visible`, unlayered)

   Why selection is NOT a ring, despite being the obvious reach: every Tailwind
   `ring-*` utility writes into the SAME single box-shadow, so `hover:ring-*`
   REPLACES a base ring instead of stacking with it. A hovered selected tile
   would lose its selected marker, and a hovered idle tile would grow one — the
   two states would be indistinguishable. Border / shadow / outline are three
   independent properties, so all three can be lit at once and still be read
   apart. Measured: the tile grid is `gap-2` (8px) and a ring at
   `ring-offset-2` extends 4px, so a PERMANENT accent halo would also eat half
   the gutter and butt straight into a hovered neighbour's halo.

   Why ink and not the accent: persistent state is neutral (`border-foreground`
   — #2a2622 on light, #eeeeee on dark, ≥11:1 against either tile fill), and
   the warm accent is reserved for the transient pointer/keyboard states. That
   way "selected" can never be mistaken for "hovered".

   Both branches carry the same border WIDTH (transparent when idle) so the
   border box never changes size — the header's exact one-tile height step as
   the sub-row appears/disappears depends on it.

   Rail vs sub-row: identical vocabulary, graded by weight — 2px + a lift
   (`shadow-sm`) up top, a finer 1px line below, on top of the radius step
   (`rounded-2xl` / `rounded-xl`) the two rows already had. Parent reads
   heavier than child; the pair of lit ink tiles under one hairline is what
   ties the sub-row to the rail now that the per-tool gradients are gone.
   ───────────────────────────────────────────────────────────────────────────*/

/** Tool-rail tile — the active tool. */
export const TILE_SELECTED =
  "border-2 border-foreground bg-bg-elevated text-text-primary shadow-sm";

/** Tool-rail tile — every other tool. */
export const TILE_IDLE =
  "border-2 border-transparent bg-bg-tertiary text-text-muted hover:bg-bg-elevated hover:text-text-primary active:scale-[0.94]";

/** Sub-tool tile — the active sub-mode. One step lighter than TILE_SELECTED. */
export const SUBTILE_SELECTED =
  "border border-foreground bg-bg-elevated text-text-primary";

/** Sub-tool tile — every other sub-mode. */
export const SUBTILE_IDLE =
  "border border-transparent bg-bg-tertiary/60 text-text-muted hover:bg-bg-elevated hover:text-text-primary active:scale-[0.94]";

/* Disabled — no image to act on. Tier-specific only so each keeps its own
   border WIDTH: a disabled tile sits in the same grid as enabled ones, and a
   0px border there would give it a 4px-wider content box (and a bigger icon)
   than its neighbours. Every constant above carries its width for the same
   reason — that invariant is what keeps the two rows dimensionally identical
   in all three states. */
export const TILE_DISABLED =
  "cursor-not-allowed border-2 border-transparent bg-bg-tertiary/40 opacity-40 grayscale";
export const SUBTILE_DISABLED =
  "cursor-not-allowed border border-transparent bg-bg-tertiary/40 opacity-40 grayscale";

/**
 * Base class-string for every Skeleton placeholder — the ONE definition site
 * behind the `Skeleton` / `SkeletonText` / `SkeletonCircle` primitives
 * (components/ui/skeleton.tsx). `bg-muted` is the semantic token base colour
 * (Refactor-Playbook §2 — no raw colours); the `.skeleton` class (styles.css)
 * layers the shimmer sweep on top and degrades to this static muted block under
 * `prefers-reduced-motion` / Reduce Motion (§3). Keep the token here so the
 * shimmer's colour isn't hard-coded inside the component.
 */
export const SKELETON_BASE = "skeleton block bg-muted";
