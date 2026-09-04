// The keyboard-shortcut reference table, as data.
//
// Split out of ShortcutModal.tsx so the component file exports only a component
// — `react-refresh/only-export-components` flags the mixed module, and the rule
// is right: a constant shared between a component and a test wants its own file.
//
// The tool-groups section is DERIVED from the five-group registry rather than
// written by hand. It used to be its own copy of the tool table and drifted,
// silently omitting Select for three releases after the `S` binding was
// removed. `toolSurfaces.contract.test.ts` now fails if that recurs.
import { TOOL_GROUPS } from "@/features/tools/toolGroups";

export const SHORTCUT_GROUPS = [
  {
    title: "Tool groups (bare keys)",
    // DERIVED from the five-group registry, not hand-written. This list used to
    // be its own copy of the tool table and drifted: it silently omitted Select
    // for three releases after `S` was removed. Generating it means a group
    // that gains, loses or changes a key updates here for free.
    //
    // Sub-tools are deliberately absent: 33 of them have no bare-key bindings
    // (palette and click only), so there is nothing here to list for them and
    // no way for this table to fall behind one.
    shortcuts: TOOL_GROUPS.map((g) => ({
      keys: [g.shortcutKey],
      action: g.label,
    })),
  },
  {
    title: "Navigation",
    shortcuts: [
      { keys: ["Space"], action: "Hold to Pan (drag image)" },
      { keys: ["PgUp"], action: "Previous Photo" },
      { keys: ["PgDn"], action: "Next Photo" },
    ],
  },
  {
    title: "Panels",
    shortcuts: [
      { keys: ["Alt", ","], action: "Command Palette" },
      { keys: ["Alt", "N"], action: "Toggle New" },
      { keys: ["Alt", "T"], action: "Toggle Tools" },
      { keys: ["Alt", "G"], action: "Toggle Gallery" },
      { keys: ["Alt", "R"], action: "Toggle Review" },
      { keys: ["Alt", "/"], action: "Toggle This Modal" },
    ],
  },
  {
    title: "Edit",
    shortcuts: [
      { keys: ["Ctrl", "Z"], action: "Undo" },
      { keys: ["Ctrl", "Shift", "Z"], action: "Redo" },
      { keys: ["Ctrl", "C"], action: "Copy Selection / Canvas" },
      { keys: ["Ctrl", "Shift", "C"], action: "Copy to Clipboard" },
      { keys: ["Alt", "D"], action: "Delete All Images" },
    ],
  },
  {
    // With a shape SELECTED. Brackets were the natural chord and every one
    // is taken (brush size, layer front/back), so shapes take the arrows.
    title: "Shapes (selected shape)",
    shortcuts: [
      { keys: ["Ctrl", "Shift", "↑"], action: "Bring Shape Forward" },
      { keys: ["Ctrl", "Shift", "↓"], action: "Send Shape Backward" },
      { keys: ["Ctrl", "Shift", "Alt", "↑"], action: "Bring Shape to Front" },
      { keys: ["Ctrl", "Shift", "Alt", "↓"], action: "Send Shape to Back" },
    ],
  },
  {
    title: "Transform",
    shortcuts: [
      { keys: ["Alt", "F"], action: "Flip Horizontal" },
      { keys: ["Alt", "V"], action: "Flip Vertical" },
      { keys: ["Alt", "S"], action: "Open Settings" },
    ],
  },
  {
    // The bracket keys were filed under "Stamps (Clone)" and read as a
    // clone-only binding. They are not: `adjustBrushSize` covers Paint's brush,
    // its blur brush, its eraser, the Eraser tool's two canvas-brush modes, the
    // emoji stamp and the clone/redaction stamp — every brush that draws a size
    // ring. Filed under their own heading so they can be found by someone
    // painting, not only by someone cloning.
    title: "Brush size (all paints & stamps)",
    shortcuts: [
      { keys: ["Ctrl", "["], action: "Decrease Brush Size" },
      { keys: ["Ctrl", "]"], action: "Increase Brush Size" },
    ],
  },
  {
    title: "Stamps (Clone)",
    shortcuts: [{ keys: ["Alt", "Click"], action: "Set Source Point" }],
  },
  {
    title: "View",
    shortcuts: [
      { keys: ["Alt", "Scroll"], action: "Zoom In / Out" },
      { keys: ["Alt", "="], action: "Zoom In" },
      { keys: ["Alt", "-"], action: "Zoom Out" },
      { keys: ["Alt", "0"], action: "Reset Zoom (100%)" },
    ],
  },
  {
    title: "Export",
    shortcuts: [
      { keys: ["Alt", "E"], action: "Export current image" },
      { keys: ["Alt", "Shift", "E"], action: "Export all images (ZIP)" },
    ],
  },
  {
    // Always shown — the Diagnostics Window is open to everyone.
    title: "Dev Tools",
    shortcuts: [
      { keys: ["Alt", "Delete"], action: "Toggle Diagnostics Window" },
      // Bound in useKeyboardShortcuts as Ctrl/Cmd + Backslash. It was an
      // undocumented easter egg; listing it costs the surprise once and stops
      // it being a key combination nothing in the app admits exists.
      { keys: ["Ctrl", "\\"], action: "Shipping celebration" },
    ],
  },
];

