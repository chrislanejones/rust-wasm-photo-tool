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
