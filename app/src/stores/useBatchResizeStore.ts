import { create } from "zustand";
import type { BatchGroup } from "@/stores/useBatchGroupStore";
import { DEFAULT_RESIZE_LOOK, type BatchResizeLook } from "@/lib/batchResize";

/** Batch › Resize & Compress: one set of settings per group, like Crop's
 *  looks, so Main and Exceptions run in one pass at their own sizes. Session
 *  only — not persisted, like Batch Crop's. */
interface BatchResizeState {
  looks: Record<BatchGroup, BatchResizeLook>;
  setLook: (g: BatchGroup, patch: Partial<BatchResizeLook>) => void;
}

export const useBatchResizeStore = create<BatchResizeState>((set) => ({
  looks: { main: { ...DEFAULT_RESIZE_LOOK }, exceptions: { ...DEFAULT_RESIZE_LOOK, size: 1080 } },
  setLook: (g, patch) => set((s) => ({ looks: { ...s.looks, [g]: { ...s.looks[g], ...patch } } })),
}));
