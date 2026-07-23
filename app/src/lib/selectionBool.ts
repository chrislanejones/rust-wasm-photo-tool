// Additive / subtractive selection — verification switch, NOT a shipped
// preference (yet). Shift+drag adds the next selection to the current one
// (union); Alt+drag removes it (subtract). Same runtime-toggle precedent as
// `ih_patchmatch`/`ih_smart_edge`: `localStorage.setItem("ih_selection_bool",
// "1")` in DevTools, then reload. There is deliberately no Settings-panel UI.
//
// Unlike `ih_patchmatch`, the engine methods this drives
// (`set_selection_combine` / `selection_union` / `selection_subtract`) exist
// on EVERY build — they're not behind a Cargo feature — so they're in the
// shared ambient `stamp_tool.d.ts`. The flag gates only the click-routing
// below, not the export's existence. With the switch OFF (the default), a
// selection click always sets combine mode 0 (replace), so behaviour is
// byte-for-byte what it was before this landed.

/** Combine mode the engine's `set_selection_combine` takes:
 *  0 = replace (default), 1 = union (add), 2 = subtract (remove). */
export type SelectionCombineMode = 0 | 1 | 2;

/** Whether additive/subtractive selection is unlocked (see module doc). */
export function isSelectionBoolEnabled(): boolean {
  try {
    return (
      typeof window !== "undefined" &&
      window.localStorage.getItem("ih_selection_bool") === "1"
    );
  } catch {
    return false;
  }
}

/** Resolve the combine mode a pointer gesture asks for: Shift → union,
 *  Alt → subtract, neither (or the flag off) → replace. Shift wins if both
 *  are held — "add" is the less destructive intent. Reads the flag itself, so
 *  callers can pass the raw event unconditionally. */
export function selectionCombineMode(mods: {
  shiftKey: boolean;
  altKey: boolean;
}): SelectionCombineMode {
  if (!isSelectionBoolEnabled()) return 0;
  if (mods.shiftKey) return 1;
  if (mods.altKey) return 2;
  return 0;
}
