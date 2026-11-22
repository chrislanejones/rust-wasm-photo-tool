import { create } from "zustand";
import type { BatchGroup } from "@/stores/useBatchGroupStore";
import type { StripChoice } from "@/lib/batchStripInfo";

/** Batch › Strip info (ADR-108): one choice per group, like Resize's looks.
 *  Exceptions start on "Leave as is", so ticking a photo is how you keep its
 *  camera info. Session only — not persisted. */
interface BatchStripInfoState {
  choices: Record<BatchGroup, StripChoice>;
  setChoice: (g: BatchGroup, c: StripChoice) => void;
}

export const useBatchStripInfoStore = create<BatchStripInfoState>((set) => ({
  choices: { main: "location", exceptions: "keep" },
  setChoice: (g, c) => set((s) => ({ choices: { ...s.choices, [g]: c } })),
}));
