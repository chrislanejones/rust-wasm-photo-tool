// Shared editor layout dimensions — one source of truth.
//
// Both side panels (the Toolbar on the left, the Review panel on the right) are
// SIDE_PANEL_WIDTH wide and sit 12px from the window edge. When a panel is open,
// the canvas (`main-content`), the top bar, and the gallery clear it by
// PANEL_OPEN_GUTTER — the panel width plus the 12px edge offset plus a 12px
// breathing gap. Keeping this in one place means a panel-width change updates
// every consumer at once; previously the value was hard-coded in three spots, so
// shrinking the toolbar (296→260px) left a stale 320 behind in two of them.
export const SIDE_PANEL_WIDTH = 260;
export const PANEL_OPEN_GUTTER = SIDE_PANEL_WIDTH + 24; // 260 + 12 + 12 = 284
