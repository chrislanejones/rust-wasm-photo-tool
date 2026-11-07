// Screenshot comparison (Night 10-23): which photo the open one is being
// compared WITH, and how. Its own store so the gallery's right-click, the top
// bar's Compare button and the Compare bar on the canvas can all reach it without
// a prop through AppShell. Not persisted: compare is a view, and a reload
// leaves it.
import { create } from "zustand";
import { DEFAULT_SENSITIVITY } from "@/lib/screenshotDiff";
export type CompareView = "overlay" | "side" | "blink" | "slider";

interface ScreenshotCompareState {
  /** Gallery id of photo A (the older one); B is always the open photo.
   *  null = not comparing. */
  otherId: string | null;
  /** Compare mode (11-07-2026 — it was a dialog): the top bar's button is on,
   *  the gallery is open and lit, and its checkboxes pick the two photos to
   *  compare. Stays on while the two are compared; the button again, Done or
   *  Esc turns it off. */
  picking: boolean;
  /** The ticked photos, in the order ticked — at most two. Their own list,
   *  not the gallery's selection: that one is Batch's Exceptions. */
  picks: string[];
  /** Two are picked and neither is open: the second is being opened, and A is
   *  compared with it once it is (comparePick.ts). */
  pending: { a: string; b: string } | null;
  view: CompareView;
  /** 0..100; see `toleranceFor`. */
  sensitivity: number;
  /** The region the list last zoomed to, or null. */
  focused: number | null;
  start: (otherId: string) => void;
  /** End the comparison AND compare mode. */
  stop: () => void;
  beginPick: () => void;
  /** Replace the picks; any comparison in progress ends (one was unticked). */
  setPicks: (picks: string[]) => void;
  setPending: (pending: { a: string; b: string } | null) => void;
  setView: (view: CompareView) => void;
  setSensitivity: (s: number) => void;
  setFocused: (i: number | null) => void;
}

export const useScreenshotCompareStore = create<ScreenshotCompareState>((set) => ({
  otherId: null,
  picking: false,
  picks: [],
  pending: null,
  view: "overlay",
  sensitivity: DEFAULT_SENSITIVITY,
  focused: null,
  start: (otherId) => set({ otherId, pending: null, view: "overlay", focused: null }),
  stop: () => set({ otherId: null, focused: null, picking: false, picks: [], pending: null }),
  beginPick: () => set({ otherId: null, focused: null, picking: true, picks: [], pending: null }),
  setPicks: (picks) => set({ picks, otherId: null, focused: null, pending: null }),
  setPending: (pending) => set({ pending }),
  setView: (view) => set({ view }),
  setSensitivity: (sensitivity) => set({ sensitivity, focused: null }),
  setFocused: (focused) => set({ focused }),
}));
