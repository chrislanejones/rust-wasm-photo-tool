import { create } from "zustand";
import type { BatchGroup } from "@/stores/useBatchGroupStore";
import { DEFAULT_REDACT_LOOK, MAX_BOXES, type RedactBox, type RedactLook } from "@/lib/batchRedact";

/** Batch › Redact (ADR-108): one look per group, like Resize's and Crop's, so
 *  Main and Exceptions run in one pass with their own boxes. Exceptions start
 *  with no boxes, so a ticked photo is skipped until boxes are drawn on it.
 *  Session only — not persisted. */
interface BatchRedactState {
  looks: Record<BatchGroup, RedactLook>;
  setLook: (g: BatchGroup, patch: Partial<Omit<RedactLook, "boxes">>) => void;
  /** False (nothing added) once the group holds MAX_BOXES. */
  addBox: (g: BatchGroup, box: RedactBox) => boolean;
  /** Move/re-base a box: a box moved on a photo keeps the spot it was put in there. */
  moveBox: (g: BatchGroup, id: string, at: Omit<RedactBox, "id">) => void;
  removeBox: (g: BatchGroup, id: string) => void;
  clearBoxes: (g: BatchGroup) => void;
}

const withBoxes = (s: BatchRedactState, g: BatchGroup, boxes: RedactBox[]) => ({
  looks: { ...s.looks, [g]: { ...s.looks[g], boxes } },
});

export const useBatchRedactStore = create<BatchRedactState>((set, get) => ({
  looks: { main: { ...DEFAULT_REDACT_LOOK }, exceptions: { ...DEFAULT_REDACT_LOOK } },
  setLook: (g, patch) => set((s) => ({ looks: { ...s.looks, [g]: { ...s.looks[g], ...patch } } })),
  addBox: (g, box) => {
    if (get().looks[g].boxes.length >= MAX_BOXES) return false;
    set((s) => withBoxes(s, g, [...s.looks[g].boxes, box]));
    return true;
  },
  moveBox: (g, id, at) =>
    set((s) => withBoxes(s, g, s.looks[g].boxes.map((b) => (b.id === id ? { ...b, ...at } : b)))),
  removeBox: (g, id) => set((s) => withBoxes(s, g, s.looks[g].boxes.filter((b) => b.id !== id))),
  clearBoxes: (g) => set((s) => withBoxes(s, g, [])),
}));
