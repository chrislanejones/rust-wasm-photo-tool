// #57 — flash the layer row when undo/redo moves the active layer under you.
//
// WHY THIS EXISTS. Undo does not restore "the layer the operation belonged to",
// because no such ownership exists: exactly 1 of 16 `Op` variants carries a
// layer (`LayerMove`). What `restore_snapshot` does is
// `self.active = snap.active` (src/lib.rs:711) — it restores whichever layer
// happened to be active when the snapshot was TAKEN. So if you run an op, then
// select a different layer, then undo, the selection jumps back and nothing
// tells you.
//
// Reproduced on v8.63: active Photo → Apply Compression → select Canvas → undo
// → active is Photo again. ⚠️ The obvious three-step test (op → undo, with no
// selection change in between) reports "stays" and is a FALSE NEGATIVE, because
// the snapshot happens to hold the same layer. You must move the active layer
// BETWEEN the op and the undo.
//
// WHAT THIS IS NOT. It does not distinguish a global op from an owned one, and
// it is not meant to: "undoing a global op must not swap the active layer" is
// KNOWN-VIOLATED and deferred on purpose, because reinstating it means minting
// op→layer ownership in Rust — the expensive branch, explicitly declined. This
// is the cheap half: the swap still happens, it just stops being invisible.
import { useCallback, useEffect, useRef, useState } from "react";

/** How long the row stays marked. Long enough to catch the eye after an undo,
 *  short enough not to linger into the next action. */
const FLASH_MS = 900;

export function useLayerSwapFlash(activeLayerId: number | undefined) {
  const [flashingId, setFlashingId] = useState<number | null>(null);
  // The id the user just asked for. A change TO this id is their own click, not
  // a snapshot moving the selection, so it must not flash.
  const userPickedRef = useRef<number | null>(null);
  const prevRef = useRef<number | undefined>(activeLayerId);
  const timerRef = useRef<number | null>(null);

  /** Call immediately before handing a click to `onSelectLayer`. */
  const markUserSelection = useCallback((id: number) => {
    userPickedRef.current = id;
  }, []);

  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = activeLayerId;
    if (activeLayerId === undefined || prev === undefined) return;
    if (activeLayerId === prev) return;

    // The user's own click — consume the mark and stay quiet.
    if (userPickedRef.current === activeLayerId) {
      userPickedRef.current = null;
      return;
    }
    userPickedRef.current = null;

    setFlashingId(activeLayerId);
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      setFlashingId(null);
      timerRef.current = null;
    }, FLASH_MS);
  }, [activeLayerId]);

  // A pending timer outliving the panel would setState on an unmounted tree.
  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    },
    [],
  );

  return { flashingId, markUserSelection };
}
