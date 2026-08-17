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
  /** Box HEIGHT in canvas px for the text currently being edited.
   *  0 = size the box to the text (pre-v8.41, and what a fresh one starts as).
   *
   *  The second axis of the same box, added in v8.41 so the six handles resize
   *  both ways instead of only left/right. It behaves differently from the
   *  width by necessity: width re-breaks the lines, height cannot (the line
   *  count is an OUTPUT of wrapping), so height lays out instead — the engine
   *  centres the text in the taller box and grows the background with it. */
  boxHeight: number;
  /** Seeded when an input opens (0 for new text, the annotation's own width
   *  when re-editing) and updated live while a box handle is dragged. */
  setWrapWidth: (w: number) => void;
  /** Same lifecycle as `setWrapWidth`, for the vertical axis. */
  setBoxHeight: (h: number) => void;
  /** Back to "size the box to the text" — BOTH axes. One reset, because the
   *  two are one box: clearing only the width would leave a stale height on
   *  the next annotation the user opens. */
  clearWrapWidth: () => void;
}

/** Below this the box stops being a box and starts being a column of single
 *  letters; the drag clamps here rather than letting a handle cross the box. */
export const MIN_WRAP_WIDTH = 40;

/** Vertical floor. Lower than `MIN_WRAP_WIDTH` because a box shorter than its
 *  text is harmless — the engine treats the height as a MINIMUM, so the text
 *  simply sets the real floor and the handle stops feeling stuck. */
export const MIN_BOX_HEIGHT = 16;

export const useTextBoxStore = create<TextBoxState>()((set) => ({
  wrapWidth: 0,
  boxHeight: 0,
  setWrapWidth: (w) => set({ wrapWidth: w > 0 ? Math.max(MIN_WRAP_WIDTH, Math.round(w)) : 0 }),
  setBoxHeight: (h) => set({ boxHeight: h > 0 ? Math.max(MIN_BOX_HEIGHT, Math.round(h)) : 0 }),
  clearWrapWidth: () => set({ wrapWidth: 0, boxHeight: 0 }),
}));
