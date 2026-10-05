import { create } from "zustand";

// Batch — Main and Exceptions. Every Batch tool (Logo, Text, Crop, Rename,
// AI Rename) can treat a few photos differently from the rest.
//
// WHO IS AN EXCEPTION is not stored here: it is the gallery's own checkboxes
// (useGalleryStore.selectedIds), which read "Exception" while Batch is open,
// plus the matching checkbox on the canvas. This store only remembers which
// group the panel is showing. Session-only, no IndexedDB.

export type BatchGroup = "main" | "exceptions";

interface BatchGroupState {
  group: BatchGroup;
  setGroup: (g: BatchGroup) => void;
}

export const useBatchGroupStore = create<BatchGroupState>((set) => ({
  group: "main",
  setGroup: (group) => set({ group }),
}));

/** Which group a photo is in: ticked in the gallery = an exception. */
export function groupOf(exceptionIds: ReadonlySet<string>, photoId: string): BatchGroup {
  return exceptionIds.has(photoId) ? "exceptions" : "main";
}

/** The gallery split in two, each in gallery order. Ticked ids no longer in
 *  the gallery are ignored. */
export function splitGroups<T extends { id: string }>(
  exceptionIds: ReadonlySet<string>,
  photos: readonly T[],
): Record<BatchGroup, T[]> {
  const out: Record<BatchGroup, T[]> = { main: [], exceptions: [] };
  for (const p of photos) out[groupOf(exceptionIds, p.id)].push(p);
  return out;
}
