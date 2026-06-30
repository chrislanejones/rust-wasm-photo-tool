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
