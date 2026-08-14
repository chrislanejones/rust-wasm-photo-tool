// The text box's live REFLOW WIDTH — the one piece of state the box-resize
// handles and the commit path both need.
//
// A store rather than another field on `useTextTool`'s `textInput` state or
// another prop through AppShell: the handles live in CanvasArea, the commit
// lives in useTextTool, and AppShell sits between them owning neither. Every
// other cross-cutting tool value in this app (guides, selection kind, mask
// paint value) is already a slice for exactly that reason — see
// `useGuidesStore`, which this mirrors deliberately.
//
// NOT persisted: unlike the guide colour, a wrap width belongs to ONE text
// annotation, not to the user's preferences. The engine is the durable home
// for it (`TextParams::wrap_width`, carried through `Op::TextWrap`); this
// slice only holds it for the span of an editing session.
import { create } from "zustand";

interface TextBoxState {
  /** Box width in CANVAS px for the text currently being edited.
   *  0 = don't wrap — size the box to the text, which is what every text
   *  annotation meant before v8.40 and what a fresh one still starts as. */
  wrapWidth: number;
  /** Seeded when an input opens (0 for new text, the annotation's own width
   *  when re-editing) and updated live while a box handle is dragged. */
  setWrapWidth: (w: number) => void;
  /** Back to "size the box to the text". */
  clearWrapWidth: () => void;
}

/** Below this the box stops being a box and starts being a column of single
 *  letters; the drag clamps here rather than letting a handle cross the box. */
export const MIN_WRAP_WIDTH = 40;

export const useTextBoxStore = create<TextBoxState>()((set) => ({
  wrapWidth: 0,
  setWrapWidth: (w) => set({ wrapWidth: w > 0 ? Math.max(MIN_WRAP_WIDTH, Math.round(w)) : 0 }),
  clearWrapWidth: () => set({ wrapWidth: 0 }),
}));
