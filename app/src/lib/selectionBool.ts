// Additive / subtractive selection — ON BY DEFAULT since the Select-tool
// split (Chris's call, 2026-07-23: "I wanted those shortcuts by default").
// Shift+gesture adds the next selection to the current one (union);
// Alt+gesture removes it (subtract); the Select-tool cursor badges the
// intent (+/−) while a modifier is held. `ih_selection_bool` remains as a
// KILL SWITCH only — `localStorage.setItem("ih_selection_bool", "0")` +
// reload disables the modifiers (same defaults-ON-with-"0"-kill pattern as
// the v7.36 op-log flags). There is deliberately no Settings-panel UI.
//
// The engine methods this drives (`set_selection_combine` /
// `selection_union` / `selection_subtract`) exist on EVERY build — they're
// not behind a Cargo feature — so they're in the shared ambient
// `stamp_tool.d.ts`. The switch gates only the gesture-routing below. With
// it killed, a selection gesture always sets combine mode 0 (replace).

/** Combine mode the engine's `set_selection_combine` takes:
 *  0 = replace (default), 1 = union (add), 2 = subtract (remove),
 *  3 = intersect. The panel's Combine group picks the standing mode; the
 *  modifiers override it for one gesture. */
export type SelectionCombineMode = 0 | 1 | 2 | 3;

/** Whether additive/subtractive selection is active — ON unless killed with
 *  the "0" switch (see module doc). */
export function isSelectionBoolEnabled(): boolean {
  try {
    return (
      typeof window === "undefined" ||
      window.localStorage.getItem("ih_selection_bool") !== "0"
    );
  } catch {
    return true;
  }
}

/** Resolve the combine mode a pointer gesture asks for: Shift → union,
 *  Alt → subtract, neither → the panel's standing mode (`base`, replace by
 *  default). Shift wins if both are held — "add" is the less destructive
 *  intent. The kill switch turns off the MODIFIERS only: the panel's Combine
 *  group is a visible control, not a hidden shortcut, so it keeps working.
 *  Reads the flag itself, so callers can pass the raw event unconditionally. */
export function selectionCombineMode(
  mods: { shiftKey: boolean; altKey: boolean },
  base: SelectionCombineMode = 0,
): SelectionCombineMode {
  if (!isSelectionBoolEnabled()) return base;
  if (mods.shiftKey) return 1;
  if (mods.altKey) return 2;
  return base;
}
