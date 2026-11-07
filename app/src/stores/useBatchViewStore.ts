// How Batch lays its photos out (11-07-2026): the Grid (the open photo big,
// eleven tiles around it, paged — as it always was) or Masonry (every photo at
// its own shape, stacked in columns like a scrapbook, the open photo the same
// size as the rest and only marked Selected). The toggle sits at the left of
// the bar under the photos (batch-grid-bar).
//
// Zoom: in the Grid, Alt + = / − and the top bar's zoom buttons zoom the open
// photo, as everywhere else. In Masonry they size EVERY photo — the column
// count here (AppShell routes them, features/canvas/batchLayout useBatchZoom).
// Fewer columns = bigger photos.
//
// A preference, so it persists — in its own localStorage key, like the guide
// colour (useGuidesStore), so nothing joins the UI store's synced slice.
// Guarded: vitest runs in node with no localStorage.
import { create } from "zustand";

export type BatchLayout = "grid" | "masonry";

/** Masonry: columns across; it scrolls, so there is no row count. */
const MASONRY_COLS = { min: 2, max: 10, initial: 4 } as const;

const LS_KEY = "image-horse-batch-view";

interface Saved {
  layout: BatchLayout;
  masonryCols: number;
}

const clampCols = (v: unknown, fallback: number) =>
  typeof v === "number" && Number.isFinite(v)
    ? Math.min(MASONRY_COLS.max, Math.max(MASONRY_COLS.min, Math.round(v)))
    : fallback;

function load(): Saved {
  const fallback: Saved = { layout: "grid", masonryCols: MASONRY_COLS.initial };
  try {
    if (typeof localStorage === "undefined") return fallback;
    const raw = JSON.parse(localStorage.getItem(LS_KEY) ?? "null") as Partial<Saved> | null;
    if (!raw || typeof raw !== "object") return fallback;
    return {
      layout: raw.layout === "masonry" ? "masonry" : "grid",
      masonryCols: clampCols(raw.masonryCols, fallback.masonryCols),
    };
  } catch {
    return fallback;
  }
}

function save(s: Saved): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(s));
  } catch {
    // Unavailable (private mode / quota): the choice lasts this session only.
  }
}

interface BatchViewState extends Saved {
  setLayout: (layout: BatchLayout) => void;
  /** Masonry: bigger photos, one column fewer. */
  zoomIn: () => void;
  /** Masonry: smaller photos, one column more. */
  zoomOut: () => void;
  /** Masonry: back to the default size (Alt + 0). */
  zoomReset: () => void;
}

export const useBatchViewStore = create<BatchViewState>()((set, get) => {
  const commit = (patch: Partial<Saved>) => {
    set(patch);
    const { layout, masonryCols } = get();
    save({ layout, masonryCols });
  };
  const step = (delta: number) => {
    const cols = get().masonryCols;
    commit({ masonryCols: clampCols(cols + delta, cols) });
  };
  return {
    ...load(),
    setLayout: (layout) => commit({ layout }),
    zoomIn: () => step(-1),
    zoomOut: () => step(1),
    zoomReset: () => commit({ masonryCols: MASONRY_COLS.initial }),
  };
});

/** The top bar's zoom % in Masonry: photo size against the default, so 100%
 *  is where Alt + 0 goes back to. */
export function masonryZoomFactor(masonryCols: number): number {
  return MASONRY_COLS.initial / masonryCols;
}
