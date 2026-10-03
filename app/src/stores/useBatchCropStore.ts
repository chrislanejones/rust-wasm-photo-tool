import { create } from "zustand";
import type { PlacementCell } from "@/components/PlacementGrid";
import { BATCH_CROP_RATIOS, type BatchCropRatioId, type CropFraming } from "@/lib/batchCrop";

// Batch › Bulk (the tile used to say Crop, and the mode id is still `crop`):
// the settings for one attribute applied to a whole gallery, plus each photo's
// hand-set framing AND the photos held OUT of the pass.
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
  /** A Shift-drag's free shape, as [w, h]. Wins over `ratioId` until a ratio
   *  tile is picked — every photo is still cropped to this ONE shape. */
  customRatio: [number, number] | null;
  anchor: PlacementCell;
  widthId: BatchCropWidthId;
  /** Per-photo framing dragged on the preview. A photo with no entry uses the
   *  anchor. Measured against the photo's ORIGINAL framing (see baselines). */
  framing: Record<string, CropFraming>;
  /** The last frame drawn on ANY photo. Photos with no framing of their own
   *  follow it, so framing one slide frames the whole carousel. */
  shared: CropFraming | null;
  /** THE ODD ONES OUT — photos held back from the pass, keyed by photo id.
   *
   *  Everything else here changes what the bulk LOOKS like (its shape, its
   *  anchor, its size). This changes WHO it lands on: a held photo is not
   *  cropped, resized or re-encoded at all, so it can be given a different
   *  attribute afterwards instead of this one. It is why the tile is called
   *  Bulk and not Crop.
   *
   *  Absent key = in the bulk, so a gallery nobody has touched behaves exactly
   *  as it did before this existed. Keys for deleted photos are harmless: every
   *  reader filters the live `photos` list. */
  held: Record<string, true>;
  /** Crop All, registered by the mounted panel — Enter runs it. */
  applyAll: (() => void) | null;
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
  /** Also becomes `shared`; `ratio` (a Shift-drag) sets `customRatio`. */
  setFraming: (photoId: string, f: CropFraming, ratio?: [number, number]) => void;
  setApplyAll: (fn: (() => void) | null) => void;
  clearFraming: (photoId: string) => void;
  /** Hold a photo out of the bulk, or put it back. */
  toggleHeld: (photoId: string) => void;
  /** Put every photo back in the bulk. */
  clearHeld: () => void;
  setBaseline: (photoId: string, key: string) => void;
  setActiveCrop: (photoId: string, v: { undoCount: number; steps: number }) => void;
}

export const useBatchCropStore = create<BatchCropState>((set) => ({
  ratioId: "1:1",
  customRatio: null,
  anchor: "center",
  widthId: "1080",
  framing: {},
  shared: null,
  held: {},
  applyAll: null,
  baselines: {},
  activeCrop: {},

  setRatioId: (ratioId) => set({ ratioId, customRatio: null }),
  setAnchor: (anchor) => set({ anchor, framing: {}, shared: null }),
  setWidthId: (widthId) => set({ widthId }),
  setFraming: (photoId, f, ratio) =>
    set((s) => ({
      framing: { ...s.framing, [photoId]: f },
      shared: f,
      ...(ratio ? { customRatio: ratio } : {}),
    })),
  setApplyAll: (applyAll) => set({ applyAll }),
  toggleHeld: (photoId) =>
    set((s) => {
      if (s.held[photoId]) {
        const { [photoId]: gone, ...rest } = s.held;
        return { held: rest };
      }
      return { held: { ...s.held, [photoId]: true } };
    }),
  clearHeld: () => set({ held: {} }),
  clearFraming: (photoId) =>
    set((s) => {
      const { [photoId]: gone, ...rest } = s.framing;
      // If this photo's frame is the one everyone follows, reset that too —
      // otherwise "reset" would leave the same frame standing via `shared`.
      return { framing: rest, shared: gone && gone === s.shared ? null : s.shared };
    }),
  setBaseline: (photoId, key) =>
    set((s) => (s.baselines[photoId] ? s : { baselines: { ...s.baselines, [photoId]: key } })),
  setActiveCrop: (photoId, v) => set((s) => ({ activeCrop: { ...s.activeCrop, [photoId]: v } })),
}));

/** Is this photo the odd one out — held back from the pass? */
export function isHeld(
  s: Pick<BatchCropState, "held">,
  photoId: string,
): boolean {
  return s.held[photoId] === true;
}

/**
 * The photos the pass will actually touch, in gallery order — everything that
 * is not held out. This is the ONE list the panel, the shade and the progress
 * counter agree on; a pass that skipped photos by a second rule could disagree
 * with the button that started it.
 */
export function bulkPhotos<T extends { id: string }>(
  s: Pick<BatchCropState, "held">,
  photos: readonly T[],
): T[] {
  return photos.filter((p) => !isHeld(s, p.id));
}

/** How many of these photos are held out. */
export function heldCount(
  s: Pick<BatchCropState, "held">,
  photos: readonly { id: string }[],
): number {
  return photos.length - bulkPhotos(s, photos).length;
}

/** The crop shape every photo gets: a Shift-drag's, else the ratio tile's. */
export function cropRatioOf(s: Pick<BatchCropState, "ratioId" | "customRatio">): [number, number] {
  return s.customRatio ?? BATCH_CROP_RATIOS.find((r) => r.id === s.ratioId)!.dims;
}

/** The frame a photo will be cropped with: its own, else the shared one
 *  (undefined = use the anchor). */
export function framingFor(
  s: Pick<BatchCropState, "framing" | "shared">,
  photoId: string,
): CropFraming | undefined {
  return s.framing[photoId] ?? s.shared ?? undefined;
}

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
