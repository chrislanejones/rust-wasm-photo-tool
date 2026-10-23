// The currently-selected text/shape annotation, driving the Align row and the
// Reselect list's highlighted row. Lives in its own store (rather than folded
// into useToolStore) because it resets on every photo switch (annotation ids
// are per-photo) independent of which tool is active.
import { create } from "zustand";
import type { ReselectObject } from "@/features/canvas/ReviewPanel";
import { type SetArg, resolveSet } from "./_shared";
import type { PinSequence } from "@/lib/pinSteps";
import type { Pt } from "@/lib/callouts";
import { NONE, type Picked } from "@/lib/annotationSelection";

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

  // Reselecting a Bézier pen path (kind 7) from the Review list has to reach the
  // PenOverlay, which owns the anchors/handles — nothing else can draw a path.
  // A one-shot request rather than persistent state: the overlay consumes it,
  // loads the geometry, and clears it. (Lives here, not as AppShell useState —
  // CLAUDE.md: orphan useState goes to the stores, and nothing new is added to
  // AppShell.)
  penEditRequest: { id: number; points: number[] } | null;
  requestPenEdit: (req: { id: number; points: number[] }) => void;
  clearPenEditRequest: () => void;

  // The Rust `kind` of the RESELECTED shape open in the edit box, or null.
  // Not `selectedObject`: that is the Align target and outlives the edit box,
  // so a star committed a minute ago would still be "selected" while a new
  // rectangle is being drawn. The Shapes panel reads this to show the Star's
  // Points slider for a star being edited even when its tile says otherwise.
  // Written only by useDrawingTools, from its own edit state.
  editingShapeKind: number | null;
  setEditingShapeKind: (kind: number | null) => void;
  // ...and its id (Night 10-23): a Shift-click on a second shape picks the
  // one open in the edit box too. Written with the kind, by useDrawingTools.
  editingShapeId: number | null;
  setEditingShapeId: (id: number | null) => void;

  // Numbered steps (lib/pinSteps.ts). The active layer's pin sequence and the
  // Renumber action are published by hooks/usePinSteps for the Pins panel —
  // the panel cannot reach the engine, and AppShell gains no new props.
  // `pinNext` is the panel's Next field: the number the next pin takes, null
  // for "after the last".
  pinSequence: PinSequence;
  setPinSequence: (seq: PinSequence) => void;
  pinNext: number | null;
  setPinNext: (n: number | null) => void;
  renumberPins: (() => void) | null;
  setRenumberPins: (fn: (() => void) | null) => void;

  // Smart Callout v1 (lib/callouts.ts). `calloutMode` is the Pins panel's
  // Drop: Pin / Callout toggle; a Callout click parks its point in
  // `pendingCallout` for the label input (CalloutLabelInput), whose Enter
  // calls `commitCallout` — published by hooks/usePinSteps, like Renumber.
  calloutMode: boolean;
  setCalloutMode: (on: boolean) => void;
  pendingCallout: Pt | null;
  setPendingCallout: (p: Pt | null) => void;
  commitCallout: ((p: Pt, text: string) => void) | null;
  setCommitCallout: (fn: ((p: Pt, text: string) => void) | null) => void;

  // Multi-select (lib/annotationSelection.ts): the annotations picked on the
  // ACTIVE layer, written by app/session/useAnnotationSelection. Empty is no
  // multi-selection. Cleared on a layer or photo switch.
  picked: Picked;
  setPicked: (v: SetArg<Picked>) => void;
  // Grow a pick to whole callouts (pin + leader + label), the way a canvas
  // pick does. Published by useAnnotationSelection, which holds the layer's
  // geometry, so the Reselect list's Shift-click picks the same objects a
  // canvas Shift-click would. null until it mounts.
  expandPick: ((p: Picked) => Picked) | null;
  setExpandPick: (fn: ((p: Picked) => Picked) | null) => void;
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

  penEditRequest: null,
  requestPenEdit: (req) => set({ penEditRequest: req }),
  clearPenEditRequest: () => set({ penEditRequest: null }),

  editingShapeKind: null,
  setEditingShapeKind: (kind) => set({ editingShapeKind: kind }),
  editingShapeId: null,
  setEditingShapeId: (id) => set({ editingShapeId: id }),

  pinSequence: { max: 0, gaps: false },
  setPinSequence: (seq) => set({ pinSequence: seq }),
  pinNext: null,
  setPinNext: (n) => set({ pinNext: n }),
  renumberPins: null,
  setRenumberPins: (fn) => set({ renumberPins: fn }),

  calloutMode: false,
  setCalloutMode: (on) => set({ calloutMode: on, pendingCallout: null }),
  pendingCallout: null,
  setPendingCallout: (p) => set({ pendingCallout: p }),
  commitCallout: null,
  setCommitCallout: (fn) => set({ commitCallout: fn }),

  picked: NONE,
  setPicked: (v) => set((s) => ({ picked: resolveSet(v, s.picked) })),
  expandPick: null,
  setExpandPick: (fn) => set({ expandPick: fn }),
}));
