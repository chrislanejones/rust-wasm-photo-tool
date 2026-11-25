// A row that swaps its controls for another set (Alt over Fill Color turns the
// swatches into opacity steps; Alt over Corner Radius turns the presets into
// corners) unmounts whatever had keyboard focus. The browser then drops focus
// on <body>, and the arrow keys stop working on the row. This hands focus to
// the new set's control instead, but ONLY when focus was inside the row and
// got lost. A control that survived the swap (the "Opacity N%" readout, the
// slider) keeps it.
import { useLayoutEffect, useRef, type RefObject } from "react";

export function useKeepFocusOnSwap(
  ref: RefObject<HTMLElement | null>,
  mode: boolean,
  pick: (root: HTMLElement) => HTMLElement | null,
) {
  const prev = useRef(mode);
  const hadFocus = useRef(false);
  // Read during render, i.e. BEFORE React removes the old controls. After the
  // commit, a removed element's focus is already gone, and browsers don't
  // reliably fire focusout for a removed node.
  if (prev.current !== mode) {
    prev.current = mode;
    hadFocus.current = !!ref.current?.contains(document.activeElement);
  }
  useLayoutEffect(() => {
    if (!hadFocus.current) return;
    hadFocus.current = false;
    const root = ref.current;
    const now = document.activeElement;
    if (!root || (now && now !== document.body)) return;
    pick(root)?.focus();
    // `pick` is read once per swap; a new function each render is fine.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);
}
