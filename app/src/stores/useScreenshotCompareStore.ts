// Screenshot comparison (Night 10-23): which photo the open one is being
// compared WITH, and how. Its own store so the gallery's right-click, the top
// bar's Compare ▾ and the Compare bar on the canvas can all reach it without
// a prop through AppShell. Not persisted: compare is a view, and a reload
// leaves it.
import { create } from "zustand";
import { DEFAULT_SENSITIVITY } from "@/lib/screenshotDiff";

export type CompareView = "overlay" | "side" | "blink" | "slider";

interface ScreenshotCompareState {
  /** Gallery id of photo A (the older one); B is always the open photo.
   *  null = not comparing. */
  otherId: string | null;
  /** The "With another photo…" picker. */
  pickerOpen: boolean;
  view: CompareView;
  /** 0..100; see `toleranceFor`. */
  sensitivity: number;
  /** The region the list last zoomed to, or null. */
  focused: number | null;
  start: (otherId: string) => void;
  stop: () => void;
  setPickerOpen: (open: boolean) => void;
  setView: (view: CompareView) => void;
  setSensitivity: (s: number) => void;
  setFocused: (i: number | null) => void;
}

export const useScreenshotCompareStore = create<ScreenshotCompareState>((set) => ({
  otherId: null,
  pickerOpen: false,
  view: "overlay",
  sensitivity: DEFAULT_SENSITIVITY,
  focused: null,
  start: (otherId) => set({ otherId, pickerOpen: false, view: "overlay", focused: null }),
  stop: () => set({ otherId: null, focused: null }),
  setPickerOpen: (pickerOpen) => set({ pickerOpen }),
  setView: (view) => set({ view }),
  setSensitivity: (sensitivity) => set({ sensitivity, focused: null }),
  setFocused: (focused) => set({ focused }),
}));
