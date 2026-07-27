// ===== FILE: app/src/features/tools/toolModes.ts =====
// The SUB-MODE AXIS — one table saying, for every multi-mode tool: what its
// sub-modes are, how to read the active one, and how to set it.
//
// Consumers (must not disagree):
//   • the command palette (jump-to-sub-mode entries),
//   • URL routing (`#/tool/paint/blur` -> setBrushMode("blur")), and
//   • NEW: SubtoolRow — the hoisted sub-tool grid in the ToolsSidebar header.
// Before this file, the palette carried a private LEGACY_SUBMODES list plus a
// private SUBMODE_SETTERS map; a second copy in the routing module would have
// been a drift bug waiting to happen. Tool metadata belongs to tool-land, so
// it lives here and every consumer imports it.
//
// The SubtoolRow is the reason this file gained two things in the
// new-ui-toolbar arc:
//   1. `icon` on ToolModeInfo — the row draws tiles, not text, so the thin
//      projection now has to carry the icon the rich ToolMode already had.
//   2. `useActiveMode(tool)` — a REACTIVE read. `activeModeOf` stays as the
//      imperative getState() read the palette/router use; a React component
//      cannot use it or it will never re-render on a mode change.
//
// SOURCES (priority order, same rule the palette always used):
//   1. TOOL_MODULES — the tool registry. A migrated tool's `modes` array IS
//      its sub-mode list (Paint, Resize, Adjust & Select today).
//   2. LEGACY_SUBMODES below — hand-written lists for tools not yet in the
//      registry.
// DECISION (unchanged): when a tool migrates into TOOL_MODULES, delete its row
// from LEGACY_SUBMODES in that same session.
import { useCallback } from "react";
import {
  ArrowUpRight,
  Copy,
  Eraser,
  FileEdit,
  ImagePlus,
  MapPin,
  Minus,
  ScanText,
  Scissors,
  Shapes as ShapesIcon,
  Smile,
  Stamp as StampIcon,
  Trash2,
  Type,
  Wand2,
} from "lucide-react";
import type { ToolType } from "@/lib/types";
import { TOOL_MODULES } from "./toolModules";
import { useToolStore } from "@/stores/useToolStore";
import type {
  BatchMode,
  BrushMode,
  EraserMode,
  ResizeMode,
  SelectionKind,
  StampSubMode,
  TextMode,
  ToolState,
} from "@/stores/useToolStore";

/** One sub-mode as the palette, the router, and the SubtoolRow need it: an id,
 *  something to show a human, an icon for the tile, and fuzzy-search terms.
 *  (The rich `ToolMode` — per-mode lightbulb info copy — stays in the registry
 *  / panel modules; this is the thin projection of it.) */
export interface ToolModeInfo {
  id: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  keywords: string[];
}

/** Sub-mode lists for tools NOT yet in TOOL_MODULES.
 *  NB: `text`, `ai` and `emoji` are new rows in the new-ui-toolbar arc. Their
 *  sub-modes previously lived as component-local `useState` inside their
 *  panels (or, for `ai`, in the store but unwired here), which made them
 *  invisible to the palette, the router AND the header row. */
const LEGACY_SUBMODES: Partial<Record<ToolType, ToolModeInfo[]>> = {
  stamp: [
    { id: "clone", label: "Clone Stamp", icon: Copy, keywords: ["clone", "heal", "duplicate"] },
    { id: "red", label: "Red Stamps", icon: StampIcon, keywords: ["red", "batch stamp", "marker"] },
    { id: "emojis", label: "Emojis", icon: Smile, keywords: ["emoji", "sticker"] },
  ],
  // The VECTOR tool (id `text`). v7.51 absorbed the standalone Shapes tool, so
  // shapes/pens/arrow live here now and `line` was promoted out of the shape-
  // kind picker into a mode of its own. `background` is gone as a MODE, not as
  // a feature: the plate behind a caption is a text style, so its controls sit
  // inside the Text panel.
  text: [
    { id: "text", label: "Text", icon: Type, keywords: ["text", "type", "caption", "label", "background", "bubble", "plate"] },
    { id: "ocr", label: "OCR", icon: ScanText, keywords: ["ocr", "read", "extract", "scan text"] },
    { id: "shapes", label: "Shapes", icon: ShapesIcon, keywords: ["rectangle", "ellipse", "box", "circle"] },
    { id: "pens", label: "Pens", icon: MapPin, keywords: ["pen", "bezier", "path", "vector", "pin"] },
    { id: "arrow", label: "Arrow", icon: ArrowUpRight, keywords: ["arrow", "pointer", "annotate"] },
    { id: "line", label: "Line", icon: Minus, keywords: ["line", "rule", "straight", "segment"] },
  ],
  ai: [
    { id: "brush", label: "Eraser", icon: Eraser, keywords: ["erase", "brush", "rub out"] },
    { id: "magic", label: "Magic Eraser", icon: Wand2, keywords: ["magic", "patchmatch", "inpaint", "content aware"] },
    { id: "rembg", label: "Background Removal", icon: Scissors, keywords: ["background", "cutout", "rembg", "transparent"] },
    { id: "inpaint", label: "Object Removal", icon: Trash2, keywords: ["object", "remove", "inpaint", "delete"] },
  ],
  emoji: [
    { id: "logo", label: "Logo", icon: ImagePlus, keywords: ["logo", "watermark", "brand", "batch"] },
    { id: "text", label: "Text", icon: Type, keywords: ["text", "caption", "batch"] },
    { id: "rename", label: "Rename", icon: FileEdit, keywords: ["rename", "filename", "batch"] },
  ],
};

/** Read/write the store field that holds a tool's active sub-mode.
 *  `select` is a plain selector so it serves BOTH the imperative read
 *  (`select(getState())`) and the reactive hook (`useToolStore(select)`) —
 *  one definition, no chance of the two drifting. */
interface ModeAccess {
  select: (s: ToolState) => string;
  set: (modeId: string) => void;
}

const MODE_ACCESS: Partial<Record<ToolType, ModeAccess>> = {
  brush: {
    select: (s) => s.brushMode,
    set: (m) => useToolStore.getState().setBrushMode(m as BrushMode),
  },
  compress: {
    select: (s) => s.resizeMode,
    set: (m) => useToolStore.getState().setResizeMode(m as ResizeMode),
  },
  // crop has no MODE_ACCESS row: single-mode again since Select split out.
  select: {
    select: (s) => s.selectionKind,
    set: (m) => useToolStore.getState().setSelectionKind(m as SelectionKind),
  },
  stamp: {
    select: (s) => s.stampSubMode,
    set: (m) => useToolStore.getState().setStampSubMode(m as StampSubMode),
  },
  // NEW in the new-ui-toolbar arc. `eraserMode` already existed in the store
  // and was simply never wired here — that was a latent palette/router gap,
  // fixed for free by the hoist.
  ai: {
    select: (s) => s.eraserMode,
    set: (m) => useToolStore.getState().setEraserMode(m as EraserMode),
  },
  text: {
    select: (s) => s.textMode,
    set: (m) => useToolStore.getState().setTextMode(m as TextMode),
  },
  emoji: {
    select: (s) => s.batchMode,
    set: (m) => useToolStore.getState().setBatchMode(m as BatchMode),
  },
};

/** The tool's sub-modes: registry first, legacy list as the fallback. Empty
 *  array for single-mode tools (Adjust, Effects, Layer Settings). */
export function modesFor(tool: ToolType): ToolModeInfo[] {
  const registered = TOOL_MODULES[tool]?.modes;
  if (registered?.length) {
    return registered.map((m) => ({
      id: m.id,
      label: m.label,
      icon: m.icon,
      // A mode's plain-string info doubles as palette search terms (SELECT_MODES
      // keeps `info` a string for exactly this); ReactNode infos are display-only.
      keywords: typeof m.info === "string" ? [m.label, m.info] : [m.label],
    }));
  }
  return LEGACY_SUBMODES[tool] ?? [];
}

/** The tool's currently-active sub-mode id, or `undefined` if it has none.
 *  IMPERATIVE — for the palette and the router. React components want
 *  `useActiveMode` instead; this one does not subscribe. */
export function activeModeOf(tool: ToolType): string | undefined {
  if (!modesFor(tool).length) return undefined;
  const access = MODE_ACCESS[tool];
  return access ? access.select(useToolStore.getState()) : undefined;
}

/** REACTIVE active sub-mode — the SubtoolRow's read. Returns `undefined` for
 *  single-mode tools. The selector is memoized on `tool` so switching tools
 *  re-subscribes but a mode change inside one tool does not churn it. */
export function useActiveMode(tool: ToolType): string | undefined {
  return useToolStore(
    useCallback((s: ToolState) => MODE_ACCESS[tool]?.select(s), [tool]),
  );
}

/** Switch a tool's sub-mode. No-op when the id isn't one of that tool's modes
 *  (a hand-typed URL is untrusted input — it must not poke a bogus value into
 *  a typed store union). Returns whether it took. */
export function setModeOf(tool: ToolType, modeId: string): boolean {
  if (!modesFor(tool).some((m) => m.id === modeId)) return false;
  const access = MODE_ACCESS[tool];
  if (!access) return false;
  if (access.select(useToolStore.getState()) !== modeId) access.set(modeId);
  return true;
}

/** Every (tool, mode) pair that exists — the palette's jump-to-sub-mode source
 *  and the routing module's validation table. */
export function allToolModes(): { tool: ToolType; mode: ToolModeInfo }[] {
  const out: { tool: ToolType; mode: ToolModeInfo }[] = [];
  for (const tool of Object.keys(MODE_ACCESS) as ToolType[]) {
    for (const mode of modesFor(tool)) out.push({ tool, mode });
  }
  return out;
}
