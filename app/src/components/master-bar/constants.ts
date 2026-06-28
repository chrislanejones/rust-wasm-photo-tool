// Master-bar dimensions — kept in a tiny static module so AppShell can read
// them synchronously (for the canvas push) without pulling in the lazy-loaded
// MasterBar component bundle.

/** Chrome-strip height (px) — the docked content panel sits flush below this. */
export const MASTER_BAR_CHROME_H = 48;
/** Master-bar width (px) — the amount the canvas clears on the left. */
export const MASTER_BAR_WIDTH = 252;
