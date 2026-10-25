// Ending a text edit without committing it — Escape in the editor, and every
// history move (Night 10-24). Split out of useTextTool, which sits at its
// max-lines cap.
//
// A history move has to close an open text's editor first. The editor
// suppresses the text's baked tile in the engine (`set_editing_text`), and the
// engine will not replay its op log over a text it is not drawing: an undo
// with the editor still open went down snapshot undo, broke the log for the
// rest of the session, and left the editor open over the undone text.
import { useCallback, useEffect, useRef, type MutableRefObject } from "react";
import { useAnnotationStore } from "@/stores/useAnnotationStore";

interface TextEditEndOptions {
  textInputRef: MutableRefObject<{ text: string } | null>;
  /** The engine annotation open in the editor; null for a NEW text. */
  editingAnnotationId: MutableRefObject<number | null>;
  setTextInput: (v: null) => void;
  toolRef: MutableRefObject<{ set_editing_text(id: number): unknown } | null>;
  flushToCanvas: () => void;
}

export function useTextEditEnd({
  textInputRef,
  editingAnnotationId,
  setTextInput,
  toolRef,
  flushToCanvas,
}: TextEditEndOptions) {
  /** The text the open annotation held when its editor opened. */
  const opened = useRef("");

  const cancel = useCallback(() => {
    textInputRef.current = null;
    editingAnnotationId.current = null;
    setTextInput(null);
    // Canceling an edit must un-suppress the (unchanged) baked tile.
    toolRef.current?.set_editing_text(-1);
    flushToCanvas();
  }, [textInputRef, editingAnnotationId, setTextInput, toolRef, flushToCanvas]);

  // Published for useHistory. True when the editor held typing: throwing it
  // away is that press's whole step. A NEW text is not in the engine, never
  // blocked the log, and is left as it is.
  useEffect(() => {
    const close = () => {
      const ti = textInputRef.current;
      if (!ti || editingAnnotationId.current === null) return false;
      const typed = ti.text !== opened.current;
      cancel();
      return typed;
    };
    const { setCloseTextEdit } = useAnnotationStore.getState();
    setCloseTextEdit(close);
    return () => setCloseTextEdit(null);
  }, [textInputRef, editingAnnotationId, cancel]);

  return { cancel, opened };
}
