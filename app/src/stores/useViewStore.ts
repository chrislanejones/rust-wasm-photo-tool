// The canvas view's pan (Night 10-24).
//
// Zoom lives in the engine (`set_zoom`/`adjust_zoom`, read back through
// syncState). The pan is the CSS translate CanvasArea puts on the canvas, in
// screen px. It was CanvasArea's own useState, so Alt+0 (`handleZoomReset` in
// useCanvasActions) reset the zoom but could not reach the pan, and a photo
// dragged aside with the hand stayed aside. Here CanvasArea's hooks and Alt+0
// both reach it, and AppShell carries nothing.
//
// Not persisted, and not per photo: it is the view of the canvas on screen, so
// it survives a photo switch (as it always did) and goes back to (0, 0) when
// the canvas unmounts (useCanvasPanDrag), as the useState it replaced did.
import { create } from "zustand";

export type Pan = { x: number; y: number };

const HOME: Pan = { x: 0, y: 0 };

interface ViewState {
  pan: Pan;
  setPan: (pan: Pan) => void;
  /** Back to (0, 0). A no-op when already there, so nothing re-renders. */
  resetPan: () => void;
}

export const useViewStore = create<ViewState>()((set) => ({
  pan: HOME,
  setPan: (pan) => set({ pan }),
  resetPan: () => set((s) => (s.pan.x === 0 && s.pan.y === 0 ? s : { pan: HOME })),
}));
