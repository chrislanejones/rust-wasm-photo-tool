// Draggable image guides — non-destructive overlay lines (Photoshop-style).
//
// Guides carry no pixels: each is just an axis + an image-space position, drawn
// over the canvas by ImageGuidesOverlay and projected to screen the same way the
// grid/ruler overlay is. This is a sibling UI slice (kept out of useUIStore so the
// per-photo reset + the monotonic id counter stay self-contained).
//
// IDs use a monotonic counter rather than Math.random()/Date.now() — those are
// unavailable in some execution contexts here (see the engine workers).
//
// TODO(persistence): guides reset whenever the active photo changes (AppShell
// clears them on activePhotoId change). Persisting per-photo guide sets is a
// follow-up; deliberately NOT wired through the idb persist middleware yet.
import { create } from "zustand";
import { DEFAULT_GUIDE_COLOR } from "@/lib/colors";

export type GuideAxis = "h" | "v";

// The guide color is a PREFERENCE, not per-photo state: it survives
// clearGuides/photo switches and persists across sessions. It lives here (with
// its own localStorage key) rather than in lib/preferences.ts so this slice
// stays self-contained and no prefs plumbing runs through AppShell. Guarded:
// vitest runs in a node environment with no localStorage.
const COLOR_LS_KEY = "image-horse-guide-color";

function loadGuideColor(): string {
  try {
    if (typeof localStorage === "undefined") return DEFAULT_GUIDE_COLOR;
    const raw = localStorage.getItem(COLOR_LS_KEY);
    return raw && /^#([0-9a-fA-F]{3,8})$/.test(raw) ? raw : DEFAULT_GUIDE_COLOR;
  } catch {
    return DEFAULT_GUIDE_COLOR;
  }
}

function saveGuideColor(color: string): void {
  try {
    localStorage.setItem(COLOR_LS_KEY, color);
  } catch {
    // localStorage may be unavailable (private mode / quota); ignore.
  }
}

export interface Guide {
  id: string;
  /** 'h' = horizontal line (spans the canvas width); 'v' = vertical line. */
  axis: GuideAxis;
  /** Position in IMAGE pixels along the axis's perpendicular dimension
   *  (h-guide → y in [0,imgH]; v-guide → x in [0,imgW]). */
  pos: number;
}

interface GuidesState {
  guides: Guide[];
  guidesLocked: boolean;
  selectedGuideId: string | null;
  /** Stroke color for ALL guides (selection is signalled by width, not hue). */
  guideColor: string;
  /** Monotonic id source (no Math.random / Date.now). */
  _counter: number;

  /** Append one guide of `axis`, then redistribute ALL guides of that axis to
   *  equal "space-between" gaps across the canvas dimension (k/(N+1)·size for
   *  k=1..N — none on the edges). Needs the live canvas size to place them. */
  addGuide: (axis: GuideAxis, imgW: number, imgH: number) => void;
  removeGuide: (id: string) => void;
  clearGuides: () => void;
  moveGuide: (id: string, pos: number) => void;
  selectGuide: (id: string | null) => void;
  toggleGuidesLock: () => void;
  setGuideColor: (color: string) => void;
}

export const useGuidesStore = create<GuidesState>()((set) => ({
  guides: [],
  guidesLocked: false,
  selectedGuideId: null,
  guideColor: loadGuideColor(),
  _counter: 0,

  addGuide: (axis, imgW, imgH) =>
    set((s) => {
      const id = `g${s._counter}`;
      const size = axis === "h" ? imgH : imgW;
      const appended = [...s.guides, { id, axis, pos: 0 }];
      // Redistribute every guide of THIS axis to equal gaps. Other-axis guides
      // keep their positions (per spec: redistribute only on add, only the
      // added axis). k counts 1..N over the same-axis guides in array order.
      const n = appended.filter((g) => g.axis === axis).length;
      let k = 0;
      const guides = appended.map((g) => {
        if (g.axis !== axis) return g;
        k += 1;
        return { ...g, pos: (k / (n + 1)) * size };
      });
      return { guides, _counter: s._counter + 1, selectedGuideId: id };
    }),

  removeGuide: (id) =>
    set((s) => ({
      guides: s.guides.filter((g) => g.id !== id),
      selectedGuideId: s.selectedGuideId === id ? null : s.selectedGuideId,
    })),

  clearGuides: () => set({ guides: [], selectedGuideId: null }),

  moveGuide: (id, pos) =>
    set((s) => ({
      guides: s.guides.map((g) => (g.id === id ? { ...g, pos } : g)),
    })),

  selectGuide: (id) => set({ selectedGuideId: id }),

  toggleGuidesLock: () => set((s) => ({ guidesLocked: !s.guidesLocked })),

  setGuideColor: (color) => {
    saveGuideColor(color);
    set({ guideColor: color });
  },
}));
