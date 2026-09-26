// The canvas cursor: the two data-URI glyphs the browser has no name for, and
// the one function that picks a cursor for the lit sub-tool. Moved out of
// CanvasArea.tsx unchanged so that file holds the component.
import type { ResolvedSubTool } from "@/features/tools/toolGroups";

// Data-URI SVG cursor for the rotate handle — there's no standard CSS
// rotation cursor, so we draw a small curved-arrow glyph. Falls back to
// `grab` if the browser can't decode the data-URI. Two stacked strokes
// (black outer 3.5, white inner 2.5) keep it visible against any background.
export const ROTATE_CURSOR =
  "url(\"data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke-linecap='round' stroke-linejoin='round'>
      <path d='M21 12a9 9 0 1 1-3-6.7' stroke='black' stroke-width='3.5'/>
      <polyline points='21 4 21 12 13 12' stroke='black' stroke-width='3.5'/>
      <path d='M21 12a9 9 0 1 1-3-6.7' stroke='white' stroke-width='2.5'/>
      <polyline points='21 4 21 12 13 12' stroke='white' stroke-width='2.5'/>
    </svg>`,
  ) +
  "\") 12 12, grab";

// Crosshair-with-plus / crosshair-with-minus for the Select tool while a
// Shift (add) / Alt (subtract) modifier is held — no standard CSS cursor
// carries the intent badge, so we draw it (same data-URI approach as the
// rotate cursor above; black-under-white double stroke for contrast on any
// background). Falls back to plain `crosshair`.
const combineCursor = (badge: "plus" | "minus"): string => {
  const bar =
    "<line x1='16' y1='20' x2='22' y2='20' stroke='black' stroke-width='3.5'/>" +
    "<line x1='16' y1='20' x2='22' y2='20' stroke='white' stroke-width='2'/>";
  const cross =
    badge === "plus"
      ? bar +
        "<line x1='19' y1='17' x2='19' y2='23' stroke='black' stroke-width='3.5'/>" +
        "<line x1='19' y1='17' x2='19' y2='23' stroke='white' stroke-width='2'/>"
      : bar;
  return (
    "url(\"data:image/svg+xml;utf8," +
    encodeURIComponent(
      `<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke-linecap='round'>
        <line x1='10' y1='2' x2='10' y2='18' stroke='black' stroke-width='3'/>
        <line x1='2' y1='10' x2='18' y2='10' stroke='black' stroke-width='3'/>
        <line x1='10' y1='2' x2='10' y2='18' stroke='white' stroke-width='1.5'/>
        <line x1='2' y1='10' x2='18' y2='10' stroke='white' stroke-width='1.5'/>
        ${cross}
      </svg>`,
    ) +
    "\") 10 10, crosshair"
  );
};
const SELECT_ADD_CURSOR = combineCursor("plus");
const SELECT_SUBTRACT_CURSOR = combineCursor("minus");

/** The canvas cursor for the lit SUB-TOOL.
 *
 *  The static answer comes from the registry (`LiveSubTool.cursor`), so a
 *  sub-tool's cursor is declared on the same row as its dispatch — a sub-tool
 *  with no canvas gesture carries no cursor AND idles in useEffectiveTool, and
 *  the two can't drift apart. This function only layers on the states a static
 *  table can't see.
 *
 *  Before the five-group restructure this switched on the legacy tool id, which
 *  meant every sub-mode of a tool shared one cursor: the whole Paint tool got
 *  the default arrow, and Crop / Transform / Color Picker were indistinguishable
 *  because they are all `crop`. */
export function getCursorForSubTool(
  subTool: ResolvedSubTool | undefined,
  isPanning?: boolean,
  colorPickerActive?: boolean,
  moveActive?: boolean,
  combineIntent?: 0 | 1 | 2,
): string | undefined {
  if (isPanning) return "grab";

  const def = subTool && !subTool.subTool.comingSoon ? subTool.subTool : undefined;
  const group = subTool?.group.id;

  // The Color Picker toggle can be switched on from the Transform/Crop panel
  // while a different Edit sub-tool is lit, so it wins inside that group —
  // mirroring the identical precedence in useEffectiveTool.
  if (colorPickerActive && group === "edit") return "crosshair";

  // Select: the gesture's intent is visible before it lands — Shift (add) and
  // Alt (subtract) badge the crosshair while held (`ih_selection_bool`; with
  // the flag off combineIntent is always 0).
  if (group === "select") {
    if (combineIntent === 1) return SELECT_ADD_CURSOR;
    if (combineIntent === 2) return SELECT_SUBTRACT_CURSOR;
  }

  // Resize Layer only drags while its Move toggle is on; idle otherwise, so the
  // cursor must not promise a drag the canvas won't honour.
  if (group === "edit" && def?.id === "resize-layer") {
    return moveActive ? "move" : undefined;
  }

  return def?.cursor;
}
