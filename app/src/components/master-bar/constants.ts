// Master-bar dimensions — kept in a tiny static module so AppShell can read
// them synchronously (for the canvas push) without pulling in the lazy-loaded
// MasterBar component bundle.

/**
 * Chrome-strip height (px) — the docked content panel sits flush below this.
 *
 * ⚠️ THIS NUMBER IS MIRRORED, and not through this constant. The docked panel
 * in ToolsSidebar, ReviewPanel and GalleryBar is positioned with a literal
 * Tailwind `top-[58px]` — the bar's `top-2` gutter (8) plus this height. They
 * are class strings, so they cannot read this value. If you change it, grep
 * `top-[58px]` and change all three, or the panel detaches from the bar.
 *
 * 48 -> 50 on 2026-08-20: the cog and user icon moved into a `p-1` group
 * container to match the desktop top bar. That container is 38px tall (30px
 * buttons + `p-1`), and 38 + the bar's own `p-1.5` is 50.
 */
export const MASTER_BAR_CHROME_H = 50;
/** Master-bar width (px) — the amount the canvas clears on the left. */
export const MASTER_BAR_WIDTH = 252;
