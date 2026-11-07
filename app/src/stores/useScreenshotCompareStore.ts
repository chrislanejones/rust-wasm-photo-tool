// Screenshot comparison (Night 10-23): which photo the open one is being
// compared WITH, and how. Its own store so the gallery's right-click, the top
// bar's Compare ▾ and the Compare bar on the canvas can all reach it without
// a prop through AppShell. Not persisted: compare is a view, and a reload
// leaves it.
import { create } from "zustand";
import { DEFAULT_SENSITIVITY } from "@/lib/screenshotDiff";
import type { ToolType } from "@/lib/types";

/** Where "Compare with another photo…" goes back to once A is picked. */
export interface PickReturn {
  tool: ToolType;
  subTool: string;
}

export type CompareView = "overlay" | "side" | "blink" | "slider";

interface ScreenshotCompareState {
  /** Gallery id of photo A (the older one); B is always the open photo.
   *  null = not comparing. */
  otherId: string | null;
  /** "Compare with another photo…" is waiting for photo A to be picked in
   *  Batch (11-07-2026 — it was a dialog). Batch's tiles pick instead of open
   *  while this is on. */
  picking: boolean;
  /** The tool to go back to after the pick, or null when the pick began in
   *  Batch and stays there. */
  pickReturn: PickReturn | null;
  view: CompareView;
  /** 0..100; see `toleranceFor`. */
  sensitivity: number;
  /** The region the list last zoomed to, or null. */
  focused: number | null;
  start: (otherId: string) => void;
  stop: () => void;
  beginPick: (returnTo: PickReturn | null) => void;
  cancelPick: () => void;
  setView: (view: CompareView) => void;
  setSensitivity: (s: number) => void;
  setFocused: (i: number | null) => void;
}

export const useScreenshotCompareStore = create<ScreenshotCompareState>((set) => ({
  otherId: null,
  picking: false,
  pickReturn: null,
  view: "overlay",
  sensitivity: DEFAULT_SENSITIVITY,
  focused: null,
  start: (otherId) => set({ otherId, picking: false, pickReturn: null, view: "overlay", focused: null }),
  stop: () => set({ otherId: null, focused: null }),
  beginPick: (pickReturn) => set({ picking: true, pickReturn }),
  cancelPick: () => set({ picking: false, pickReturn: null }),
  setView: (view) => set({ view }),
  setSensitivity: (sensitivity) => set({ sensitivity, focused: null }),
  setFocused: (focused) => set({ focused }),
}));
