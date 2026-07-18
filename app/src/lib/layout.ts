// Shared editor layout dimensions — one source of truth.
//
// Both side panels (the Toolbar on the left, the Review panel on the right) are
// SIDE_PANEL_WIDTH wide and sit 12px from the window edge. When a panel is open,
// the canvas (`main-content`), the top bar, and the gallery clear it by
// PANEL_OPEN_GUTTER — the panel width plus the 12px edge offset plus a 12px
// breathing gap. Keeping this in one place means a panel-width change updates
// every consumer at once; previously the value was hard-coded in three spots, so
// shrinking the toolbar (296→260px) left a stale 320 behind in two of them.
const SIDE_PANEL_WIDTH = 260;
export const PANEL_OPEN_GUTTER = SIDE_PANEL_WIDTH + 24; // 260 + 12 + 12 = 284

// ── Responsive breakpoints (window width, px) ────────────────────────────────
// One source of truth for the top bar's collapse logic. Below BP_COMPACT the bar
// goes icon-only and drops Undo/Redo (still reachable in the Review panel + via
// Ctrl+Z); BP_TIGHT additionally collapses when both side panels are open and
// eating the horizontal room.
export const BP_COMPACT = 1000;
export const BP_TIGHT = 1200;
// Below BP_NARROW the side panels stop pushing the canvas and float as overlay
// drawers (one open at a time, behind a scrim) so a snapped half-screen window
// keeps a usable canvas. Below BP_MIN the window is too small to edit
// comfortably and <SmallWindowNotice/> appears.
export const BP_NARROW = 900;
export const BP_MIN = 600;
