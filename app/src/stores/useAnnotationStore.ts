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

  // Stage-4: replaces the old `text-annotations-changed` window CustomEvent.
  // Any code that mutates the WASM annotation/shape vector (undo/redo/jump,
  // delete-object, text commit) calls bumpAnnotations(); consumers (text tool,
  // drawing tools) re-sync their derived state off the counter change.
  annotationsRevision: number;
  bumpAnnotations: () => void;
  // Stage-4: replaces the old `text-committed` window CustomEvent. The text tool
  // sets the just-committed string; AppShell records it into recent texts.
  lastCommittedText: string | null;
  commitText: (text: string) => void;
}

export const useAnnotationStore = create<AnnotationState>()((set) => ({
  selectedObject: null,
  setSelectedObject: (v) =>
    set((s) => ({ selectedObject: resolveSet(v, s.selectedObject) })),

  annotationsRevision: 0,
  bumpAnnotations: () =>
    set((s) => ({ annotationsRevision: s.annotationsRevision + 1 })),
  lastCommittedText: null,
  commitText: (text) => set({ lastCommittedText: text }),
}));
