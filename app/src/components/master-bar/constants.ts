// Master-bar dimensions — kept in a tiny static module so AppShell can read
// them synchronously (for the canvas push) without pulling in the lazy-loaded
// MasterBar component bundle.

/**
 * Chrome-strip height (px) — the docked content panel sits flush below this.
 *
 * ⚠️ THIS NUMBER IS MIRRORED in MASTER_BAR_CONTENT_BOX's `top-[58px]` below —
 * the bar's `top-2` gutter (8) plus this height. A class string cannot read
 * this value, so change both together, or the panel detaches from the bar.
 *
 * 48 -> 50 on 2026-08-20: the cog and user icon moved into a `p-1` group
 * container to match the desktop top bar. That container is 38px tall (30px
 * buttons + `p-1`), and 38 + the bar's own `p-1.5` is 50.
 */
export const MASTER_BAR_CHROME_H = 50;
/** Master-bar width (px) — the amount the canvas clears on the left. */
export const MASTER_BAR_WIDTH = 252;

/**
 * The content box the active tab (Tools / Gallery / Review) renders in, flush
 * below the chrome strip. ToolsSidebar, ReviewPanel and GalleryBar each used to
 * spell this out, which made `top-[58px]` a three-place edit — and Review's
 * copy had lost the panel shadow the other two carried inline. `top-[58px]`
 * stays a literal because Tailwind only emits classes it can read in source.
 */
export const MASTER_BAR_CONTENT_BOX =
  "fixed left-2 top-[58px] bottom-[var(--panel-bottom)] z-[var(--z-panel)] flex w-[252px] flex-col overflow-hidden rounded-b-xl border border-t-0 border-border bg-bg-secondary shadow-panel";
