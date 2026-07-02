// The currently-selected text/shape annotation, driving the Align row and the
// Reselect list's highlighted row. Lives in its own store (rather than folded
// into useToolStore) because it resets on every photo switch (annotation ids
// are per-photo) independent of which tool is active.
import { create } from "zustand";
import type { ReselectObject } from "@/features/canvas/ReviewPanel";
import { type SetArg, resolveSet } from "./_shared";

export type { ReselectObject };

interface AnnotationState {
  selectedObject: ReselectObject | null;
  setSelectedObject: (v: SetArg<ReselectObject | null>) => void;
}

export const useAnnotationStore = create<AnnotationState>()((set) => ({
  selectedObject: null,
  setSelectedObject: (v) =>
    set((s) => ({ selectedObject: resolveSet(v, s.selectedObject) })),
}));
