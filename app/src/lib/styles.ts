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
     · FOCUS    → `outline`       — NEUTRAL INK, DASHED, 2–4px outward
                                    (styles.css `button:focus-visible`, unlayered)

   FOCUS STOPPED BEING THE ACCENT on 2026-07-28. Three channels were never
   enough on their own: selected and focus were both `--accent` at 2px, so a
   tile clicked with the mouse and then abandoned by a keyboard shortcut kept an
   accent ring while the newly-active tile grew one too — two tiles claiming to
   be live. Channel-and-shape did not save it, because the stale ring was the
   OUTSIDE one and sat on the tile that was no longer active. Colour is what
   separates "the keyboard is here" from "this is the current tool"; the full
   measurement is in the styles.css `:focus-visible` comment.

   Why selection is NOT a ring, despite being the obvious reach: every Tailwind
   `ring-*` utility writes into the SAME single box-shadow, so `hover:ring-*`
   REPLACES a base ring instead of stacking with it. A hovered selected tile
   would lose its selected marker, and a hovered idle tile would grow one — the
   two states would be indistinguishable. Border / shadow / outline are three
   independent properties, so all three can be lit at once and still be read
   apart. Measured: the tile grid is `gap-2` (8px) and a ring at
   `ring-offset-2` extends 4px, so a PERMANENT accent halo would also eat half
   the gutter and butt straight into a hovered neighbour's halo.

   Colour: BOTH selected and hover are the warm accent (`theme-primary` —
   #c98f3f on light, #fcdfc2 on dark). An earlier pass made selected a neutral
   ink instead, on the theory that a separate hue keeps it from being mistaken
   for hover; Chris asked for the accent in both, and the states stay legible
   without the hue split because they were never relying on it — they differ by
   CHANNEL and SHAPE: selected is a solid border hugging the tile edge at 0px
   outward, hover is a 60%-opacity halo sitting 2–4px OUTSIDE it. Solid-and-
   inside vs soft-and-outside reads even in one colour.

   KNOWN, ACCEPTED: at #c98f3f on the light sidebar this is 2.67:1, under the
   3:1 WCAG 1.4.11 asks of a non-text indicator. The hover ring and the global
   focus outline already had exactly this shortfall — it comes from `--accent`
   itself, so fixing it means recolouring the light theme, not patching here.
   Selected now shares it. If it needs solving, the fix is a darker light-mode
   accent token, applied once at the source.

   Both branches carry the same border WIDTH (transparent when idle) so the
   border box never changes size — the header's exact one-tile height step as
   the sub-row appears/disappears depends on it.

   Rail vs sub-row: identical vocabulary AND identical border width (2px in
   both rows — a 1px sub-row line read as an inconsistency rather than as a
   grading, and barely registered at all). The parent/child step is carried by
   the radius (`rounded-2xl` / `rounded-xl`) plus the rail's extra `shadow-sm`
   lift; the pair of lit accent tiles under one hairline is what ties the
   sub-row to the rail now that the per-tool gradients are gone.
   ───────────────────────────────────────────────────────────────────────────*/

/** Tool-rail tile — the active tool. */
export const TILE_SELECTED =
  "border-2 border-theme-primary bg-bg-elevated text-text-primary shadow-sm";

/** Tool-rail tile — every other tool. */
export const TILE_IDLE =
  "border-2 border-transparent bg-bg-tertiary text-text-muted hover:bg-bg-elevated hover:text-text-primary active:scale-[0.94]";

/** Sub-tool tile — the active sub-tool.
 *
 *  Border WIDTH matches the rail exactly (`border-2`). It used to be a finer
 *  1px line, on the theory that a lighter weight would read as child-to-parent;
 *  in practice the two lit tiles just looked like a rendering inconsistency,
 *  and at 1px the accent barely registered against the tile fill. The
 *  parent/child grading now rides entirely on the radius step (`rounded-2xl`
 *  vs `rounded-xl`) and the rail's extra `shadow-sm` lift, which are the two
 *  channels that were doing the real work anyway. */
export const SUBTILE_SELECTED =
  "border-2 border-theme-primary bg-bg-elevated text-text-primary";

/** Sub-tool tile — every other sub-tool. Carries the same 2px width in
 *  transparent, so the content box never changes size between states. */
export const SUBTILE_IDLE =
  "border-2 border-transparent bg-bg-tertiary/60 text-text-muted hover:bg-bg-elevated hover:text-text-primary active:scale-[0.94]";

/* Disabled — no image to act on. Tier-specific only so each keeps its own
   border WIDTH: a disabled tile sits in the same grid as enabled ones, and a
   0px border there would give it a 4px-wider content box (and a bigger icon)
   than its neighbours. Every constant above carries its width for the same
   reason — that invariant is what keeps the two rows dimensionally identical
   in all three states. */
export const TILE_DISABLED =
  "cursor-not-allowed border-2 border-transparent bg-bg-tertiary/40 opacity-40 grayscale";
export const SUBTILE_DISABLED =
  "cursor-not-allowed border-2 border-transparent bg-bg-tertiary/40 opacity-40 grayscale";

/* ─────────────────────────────────────────────────────────────────────────────
   CONFIRM-DIALOG BUTTONS — the "yes, do it" button in a Dialog footer.

   Both carry a WHITE label on a SOLID fill (Chris, 2026-07-28). White needs a
   dark enough fill to be legible, which is why neither of these is a tint:
   the delete button used to be `text-destructive` on `bg-destructive/15`, and
   that measured 3.99:1 on the dark theme — under the 4.5:1 WCAG 1.4.3 asks of
   body text. On the LIGHT theme the same tint blends to a pale pink (#fadede),
   where a white label would have been 1.09:1 — invisible. A solid fill is what
   makes "white text" a legible instruction rather than a broken one.
   ───────────────────────────────────────────────────────────────────────────*/

/** Destructive confirm — delete. Fill is `--confirm-danger`, NOT `--destructive`:
 *  the first attempt used `bg-destructive`, and white on the dark theme's
 *  #e55032 measured **3.80:1** in the browser — worse than the 3.99:1 of the
 *  red-on-red-tint it replaced. Caught by measuring after the change rather
 *  than shipping the tempting one-liner. `--confirm-danger` pins #dc2626 for
 *  both themes, where white is 4.83:1. */
export const CONFIRM_DESTRUCTIVE =
  "border-confirm-danger bg-confirm-danger text-confirm-foreground hover:border-confirm-danger hover:brightness-110";

/** Affirmative confirm — update, apply, proceed. White on `--confirm`, the deep
 *  warm ink, at 12.7:1 in both themes. */
export const CONFIRM_AFFIRMATIVE =
  "border-confirm bg-confirm text-confirm-foreground hover:border-confirm hover:brightness-125";

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
