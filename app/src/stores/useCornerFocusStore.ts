// The one corner the Corner Radius row is editing, if any (Chris, 11-25-2026 —
// mock-up F): picked from the tiles that hold Alt over that row shows. The
// panel writes it, the shape's edit overlay lights that corner's dot so you
// can see which corner the slider moves. `null` = every corner.
import { create } from "zustand";

interface CornerFocusState {
  corner: number | null;
  setCorner: (corner: number | null) => void;
}

export const useCornerFocusStore = create<CornerFocusState>((set) => ({
  corner: null,
  setCorner: (corner) => set({ corner }),
}));
