import { create } from "zustand";
import type { PlacementCell } from "@/components/PlacementGrid";
import type { BatchCropRatioId, CropFraming } from "@/lib/batchCrop";

// Batch › Crop's settings, plus each photo's hand-set framing.
//
// WHY A STORE: same reason as usePerspectiveStore. The crop frame is edited in
// two places, the panel (features/tools/settings) and the draggable frame on
// the preview (features/canvas), and their only common ancestor is AppShell.
//
// NOT PERSISTED. Everything here was useState/useRef in CropBatchPanel before
// the preview frame existed and lives for the session, same as before. There
// is no IndexedDB change, so the dexie-migration gate is not triggered.

export type BatchCropWidthId = "keep" | "1080" | "1440";

interface BatchCropState {
  ratioId: BatchCropRatioId;
  anchor: PlacementCell;
  widthId: BatchCropWidthId;
  /** Per-photo framing dragged on the preview. A photo with no entry uses the
   *  anchor. Measured against the photo's ORIGINAL framing (see baselines). */
  framing: Record<string, CropFraming>;
  /** photo id → the originalKey it had before its first batch crop. Every
   *  Apply crops from here, so a second Apply re-frames the whole photo. */
  baselines: Record<string, string>;
  /** Active photo only: the undo count our last live crop left behind and how
   *  many steps it pushed. If the count still matches, re-apply rewinds them. */
  activeCrop: Record<string, { undoCount: number; steps: number }>;

  setRatioId: (id: BatchCropRatioId) => void;
  /** Picking an anchor is "put every frame HERE" — it clears hand framings. */
  setAnchor: (a: PlacementCell) => void;
  setWidthId: (id: BatchCropWidthId) => void;
  setFraming: (photoId: string, f: CropFraming) => void;
  clearFraming: (photoId: string) => void;
  setBaseline: (photoId: string, key: string) => void;
  setActiveCrop: (photoId: string, v: { undoCount: number; steps: number }) => void;
}

export const useBatchCropStore = create<BatchCropState>((set) => ({
  ratioId: "1:1",
  anchor: "center",
  widthId: "1080",
  framing: {},
  baselines: {},
  activeCrop: {},

  setRatioId: (ratioId) => set({ ratioId }),
  setAnchor: (anchor) => set({ anchor, framing: {} }),
  setWidthId: (widthId) => set({ widthId }),
  setFraming: (photoId, f) => set((s) => ({ framing: { ...s.framing, [photoId]: f } })),
  clearFraming: (photoId) =>
    set((s) => {
      const { [photoId]: _gone, ...rest } = s.framing;
      return { framing: rest };
    }),
  setBaseline: (photoId, key) =>
    set((s) => (s.baselines[photoId] ? s : { baselines: { ...s.baselines, [photoId]: key } })),
  setActiveCrop: (photoId, v) => set((s) => ({ activeCrop: { ...s.activeCrop, [photoId]: v } })),
}));

/** Is the photo on screen still its ORIGINAL framing — i.e. is the preview
 *  frame measuring the same pixels the next Apply will crop? False once a batch
 *  crop has been baked into it (active: until undone; others: for good, since
 *  their stored original was replaced). */
export function showsOriginalFraming(
  s: Pick<BatchCropState, "baselines" | "activeCrop">,
  photoId: string,
  originalKey: string,
  undoCount: number,
): boolean {
  const live = s.activeCrop[photoId];
  if (live && live.undoCount === undoCount) return false;
  const base = s.baselines[photoId];
  return !base || base === originalKey;
}
