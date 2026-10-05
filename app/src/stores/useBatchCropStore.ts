import { create } from "zustand";
import type { BatchGroup } from "./useBatchGroupStore";
import type { PlacementCell } from "@/components/PlacementGrid";
import { BATCH_CROP_RATIOS, type BatchCropRatioId, type CropFraming } from "@/lib/batchCrop";

// Batch › Crop: one crop for the Main photos and one for the Exceptions (the
// photos ticked in the gallery — see useBatchGroupStore). Each group keeps its
// own ratio, anchor, width and shared frame; one pass crops both.
//
// WHY A STORE: the crop is edited in two places, the panel
// (features/tools/settings) and the draggable frame on the preview
// (features/canvas), and their only common ancestor is AppShell.
//
// NOT PERSISTED. Lives for the session; no IndexedDB change.

export type BatchCropWidthId = "keep" | "1080" | "1440";


/** What ONE group's crop looks like. Each group has its own. */
export interface CropLook {
  ratioId: BatchCropRatioId;
  /** A Shift-drag's free shape, as [w, h]. Wins over `ratioId` until a ratio
   *  tile is picked — every photo in the group is still cropped to this ONE shape. */
  customRatio: [number, number] | null;
  anchor: PlacementCell;
  widthId: BatchCropWidthId;
  /** The last frame drawn on any photo IN THIS GROUP. Photos of the group with
   *  no framing of their own follow it. */
  shared: CropFraming | null;
}

const DEFAULT_LOOK: CropLook = {
  ratioId: "1:1",
  customRatio: null,
  anchor: "center",
  widthId: "1080",
  shared: null,
};

interface BatchCropState {
  looks: Record<BatchGroup, CropLook>;
  /** Per-photo framing dragged on the preview. A photo with no entry uses its
   *  group's shared frame, else the anchor. Measured against the photo's
   *  ORIGINAL framing (see baselines). Fractions, so it survives a group's
   *  ratio change — and a photo moving between groups. */
  framing: Record<string, CropFraming>;
  /** The pass, registered by the mounted panel — Enter runs it. */
  applyAll: (() => void) | null;
  /** photo id → the originalKey it had before its first batch crop. Every
   *  Apply crops from here, so a second Apply re-frames the whole photo. */
  baselines: Record<string, string>;
  /** Active photo only: the undo count our last live crop left behind and how
   *  many steps it pushed. If the count still matches, re-apply rewinds them. */
  activeCrop: Record<string, { undoCount: number; steps: number }>;

  setRatioId: (g: BatchGroup, id: BatchCropRatioId) => void;
  /** Picking an anchor is "put every frame in this group HERE" — it clears the
   *  group's hand framings. `ids` = the photos in that group. */
  setAnchor: (g: BatchGroup, a: PlacementCell, ids: readonly string[]) => void;
  setWidthId: (g: BatchGroup, id: BatchCropWidthId) => void;
  /** Also becomes the group's `shared`; `ratio` (a Shift-drag) sets its `customRatio`. */
  setFraming: (g: BatchGroup, photoId: string, f: CropFraming, ratio?: [number, number]) => void;
  clearFraming: (g: BatchGroup, photoId: string) => void;
  setApplyAll: (fn: (() => void) | null) => void;
  setBaseline: (photoId: string, key: string) => void;
  setActiveCrop: (photoId: string, v: { undoCount: number; steps: number }) => void;
}

const patchLook = (s: BatchCropState, g: BatchGroup, p: Partial<CropLook>) => ({
  looks: { ...s.looks, [g]: { ...s.looks[g], ...p } },
});

export const useBatchCropStore = create<BatchCropState>((set) => ({
  looks: { main: { ...DEFAULT_LOOK }, exceptions: { ...DEFAULT_LOOK, ratioId: "4:5" } },
  framing: {},
  applyAll: null,
  baselines: {},
  activeCrop: {},

  setRatioId: (g, ratioId) => set((s) => patchLook(s, g, { ratioId, customRatio: null })),
  setAnchor: (g, anchor, ids) =>
    set((s) => {
      const framing = { ...s.framing };
      for (const id of ids) delete framing[id];
      return { framing, ...patchLook(s, g, { anchor, shared: null }) };
    }),
  setWidthId: (g, widthId) => set((s) => patchLook(s, g, { widthId })),
  setFraming: (g, photoId, f, ratio) =>
    set((s) => ({
      framing: { ...s.framing, [photoId]: f },
      ...patchLook(s, g, { shared: f, ...(ratio ? { customRatio: ratio } : {}) }),
    })),
  clearFraming: (g, photoId) =>
    set((s) => {
      const { [photoId]: gone, ...rest } = s.framing;
      // If this photo's frame is the one its group follows, reset that too —
      // otherwise "reset" would leave the same frame standing via `shared`.
      const shared = s.looks[g].shared;
      return {
        framing: rest,
        ...patchLook(s, g, { shared: gone && gone === shared ? null : shared }),
      };
    }),
  setApplyAll: (applyAll) => set({ applyAll }),
  setBaseline: (photoId, key) =>
    set((s) => (s.baselines[photoId] ? s : { baselines: { ...s.baselines, [photoId]: key } })),
  setActiveCrop: (photoId, v) => set((s) => ({ activeCrop: { ...s.activeCrop, [photoId]: v } })),
}));

/** The crop shape a group gets: a Shift-drag's, else the ratio tile's. */
export function cropRatioOf(look: Pick<CropLook, "ratioId" | "customRatio">): [number, number] {
  return look.customRatio ?? BATCH_CROP_RATIOS.find((r) => r.id === look.ratioId)!.dims;
}

/** The frame a photo will be cropped with: its own, else its group's shared
 *  one (undefined = use the group's anchor). */
export function framingFor(
  s: Pick<BatchCropState, "framing" | "looks">,
  g: BatchGroup,
  photoId: string,
): CropFraming | undefined {
  return s.framing[photoId] ?? s.looks[g].shared ?? undefined;
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
