import { useEffect, useRef, useState } from "react";

/**
 * Alt (⌥ Option) held while the pointer or focus is on a panel row — the
 * row's alternate form (Fill Color → opacity steps, Corner Radius → one
 * corner at a time; Chris, 11-25-2026, mock-ups D and F). Listens on the
 * window only while the row is hovered or focused, so Alt everywhere else in
 * the app keeps whatever it does there. Spread `handlers` on the row.
 *
 * THE POINTER WINS. Focus counts only when it came from the keyboard
 * (`:focus-visible`) and the pointer isn't over another Alt row: a mouse click
 * on Corner Radius leaves focus there, and Alt over Fill Color must not light
 * both rows.
 */
let rowsUnderPointer = 0;

function keyboardFocused(): boolean {
  try {
    return document.activeElement?.matches(":focus-visible") ?? false;
  } catch {
    return true; // an engine without :focus-visible — keep the focus path
  }
}

export function useAltOverRow(enabled: boolean) {
  const [over, setOver] = useState(false);
  const [focused, setFocused] = useState(false);
  const [alt, setAlt] = useState(false);
  const live = enabled && (over || focused);
  const overRef = useRef(false);
  overRef.current = over;

  useEffect(() => {
    if (!live) {
      setAlt(false);
      return;
    }
    const down = (e: KeyboardEvent) => {
      if (e.key !== "Alt") return;
      if (!overRef.current && (rowsUnderPointer > 0 || !keyboardFocused())) return;
      // Windows browsers move focus to the menu bar on a bare Alt.
      e.preventDefault();
      setAlt(true);
    };
    const up = (e: KeyboardEvent) => {
      if (e.key !== "Alt") return;
      e.preventDefault();
      setAlt(false);
    };
    const reset = () => setAlt(false);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", reset);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", reset);
    };
  }, [live]);

  // Unmounted (or switched off) with the pointer on it: it is no longer under it.
  useEffect(() => {
    if (!enabled) return;
    return () => {
      if (overRef.current) rowsUnderPointer = Math.max(0, rowsUnderPointer - 1);
      overRef.current = false;
    };
  }, [enabled]);

  const handlers = enabled
    ? {
        onPointerEnter: (e: React.PointerEvent) => {
          if (!overRef.current) rowsUnderPointer++;
          overRef.current = true;
          setOver(true);
          setAlt(e.altKey);
        },
        // Alt pressed BEFORE the pointer arrived: no keydown reaches us.
        onPointerMove: (e: React.PointerEvent) => {
          if (e.altKey !== alt) setAlt(e.altKey);
        },
        onPointerLeave: () => {
          if (overRef.current) rowsUnderPointer = Math.max(0, rowsUnderPointer - 1);
          overRef.current = false;
          setOver(false);
        },
        onFocus: () => setFocused(true),
        onBlur: (e: React.FocusEvent) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false);
        },
      }
    : {};
  return { alt: live && alt, handlers };
}
