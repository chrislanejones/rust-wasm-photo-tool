import { create } from "zustand";
import type { PlacementCell } from "@/components/PlacementGrid";
import { BATCH_CROP_RATIOS, type BatchCropRatioId, type CropFraming } from "@/lib/batchCrop";

// Batch › Bulk (the tile used to say Crop, and the mode id is still `crop`):
// one crop applied to a whole gallery — and a SECOND crop for the odd ones out.
//
// WHO IS ODD is not stored here. It is the gallery's own checkboxes
// (useGalleryStore.selectedIds): tick photos 4 and 6 in the gallery and they
// are the odd ones. One set of marks, in the place the photos already are,
// instead of a second grid of thumbnails inside the panel. Every reader takes
// that set as an argument, so this store never has to know the gallery.
//
// WHY A STORE: the crop is edited in two places, the panel
// (features/tools/settings) and the draggable frame on the preview
// (features/canvas), and their only common ancestor is AppShell.
//
// NOT PERSISTED. Lives for the session; no IndexedDB change, so the
// dexie-migration gate is not triggered.

export type BatchCropWidthId = "keep" | "1080" | "1440";

/** The two groups a pass crops: everyone, and the photos ticked in the gallery. */
export type BulkGroup = "bulk" | "odd";

/** What ONE group's crop looks like. Each group has its own. */
export interface BulkLook {
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

const DEFAULT_LOOK: BulkLook = {
  ratioId: "1:1",
  customRatio: null,
  anchor: "center",
  widthId: "1080",
  shared: null,
};

interface BatchCropState {
  looks: Record<BulkGroup, BulkLook>;
  /** Which group's settings the panel is showing. */
  editing: BulkGroup;
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

  setEditing: (g: BulkGroup) => void;
  setRatioId: (g: BulkGroup, id: BatchCropRatioId) => void;
  /** Picking an anchor is "put every frame in this group HERE" — it clears the
   *  group's hand framings. `ids` = the photos in that group. */
  setAnchor: (g: BulkGroup, a: PlacementCell, ids: readonly string[]) => void;
  setWidthId: (g: BulkGroup, id: BatchCropWidthId) => void;
  /** Also becomes the group's `shared`; `ratio` (a Shift-drag) sets its `customRatio`. */
  setFraming: (g: BulkGroup, photoId: string, f: CropFraming, ratio?: [number, number]) => void;
  clearFraming: (g: BulkGroup, photoId: string) => void;
  setApplyAll: (fn: (() => void) | null) => void;
  setBaseline: (photoId: string, key: string) => void;
  setActiveCrop: (photoId: string, v: { undoCount: number; steps: number }) => void;
}

const patchLook = (s: BatchCropState, g: BulkGroup, p: Partial<BulkLook>) => ({
  looks: { ...s.looks, [g]: { ...s.looks[g], ...p } },
});

export const useBatchCropStore = create<BatchCropState>((set) => ({
  looks: { bulk: { ...DEFAULT_LOOK }, odd: { ...DEFAULT_LOOK, ratioId: "4:5" } },
  editing: "bulk",
  framing: {},
  applyAll: null,
  baselines: {},
  activeCrop: {},

  setEditing: (editing) => set({ editing }),
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

/** Which group a photo is in: ticked in the gallery = odd. */
export function groupOf(oddIds: ReadonlySet<string>, photoId: string): BulkGroup {
  return oddIds.has(photoId) ? "odd" : "bulk";
}

/**
 * The gallery split in two, each in gallery order. This is the ONE split the
 * panel, the shade, the preview frame and the pass agree on. Ids in `oddIds`
 * that are no longer in the gallery are ignored.
 */
export function splitBulk<T extends { id: string }>(
  oddIds: ReadonlySet<string>,
  photos: readonly T[],
): Record<BulkGroup, T[]> {
  const out: Record<BulkGroup, T[]> = { bulk: [], odd: [] };
  for (const p of photos) out[groupOf(oddIds, p.id)].push(p);
  return out;
}

/** The crop shape a group gets: a Shift-drag's, else the ratio tile's. */
export function cropRatioOf(look: Pick<BulkLook, "ratioId" | "customRatio">): [number, number] {
  return look.customRatio ?? BATCH_CROP_RATIOS.find((r) => r.id === look.ratioId)!.dims;
}

/** The frame a photo will be cropped with: its own, else its group's shared
 *  one (undefined = use the group's anchor). */
export function framingFor(
  s: Pick<BatchCropState, "framing" | "looks">,
  g: BulkGroup,
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
