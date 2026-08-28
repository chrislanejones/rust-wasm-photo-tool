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
//   2. `selectModeOf(state, tool)` — the single sub-mode read. It is a plain
//      selector, so it is safe inside a React selector and from a getState()
//      snapshot alike; see its own comment for why a second copy must not
//      come back.
//
// SOURCES (priority order, same rule the palette always used):
//   1. TOOL_MODULES — the tool registry. A migrated tool's `modes` array IS
//      its sub-mode list (Paint, Resize, Adjust & Select today).
//   2. LEGACY_SUBMODES below — hand-written lists for tools not yet in the
//      registry.
// DECISION (unchanged): when a tool migrates into TOOL_MODULES, delete its row
// from LEGACY_SUBMODES in that same session.
import {
  ArrowUpRight,
  Copy,
  Eraser,
  FileEdit,
  ImagePlus,
  MapPin,
  PaintBucket,
  ScanEye,
  ScanText,
  Scissors,
  Shapes as ShapesIcon,
  Smile,
  Stamp as StampIcon,
  Trash2,
  Type,
  BroomSparkles,
} from "lucide-react";
import type { ToolType } from "@/lib/types";
import { TOOL_MODULES } from "./toolModules";
import { useToolStore } from "@/stores/useToolStore";
import type {
  BatchMode,
  BrushMode,
  EraserMode,
  PerspectiveMode,
  ResizeMode,
  SelectionKind,
  ShapesMode,
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
  shapes: [
    { id: "shapes", label: "Shapes", icon: ShapesIcon, keywords: ["rectangle", "ellipse", "box"] },
    { id: "pens", label: "Pens", icon: MapPin, keywords: ["pen", "bezier", "path", "vector"] },
    { id: "arrows", label: "Arrows", icon: ArrowUpRight, keywords: ["arrow", "pointer", "annotate"] },
  ],
  text: [
    { id: "text", label: "Text", icon: Type, keywords: ["text", "type", "caption", "label"] },
    { id: "background", label: "Background", icon: PaintBucket, keywords: ["background", "fill", "bubble", "plate"] },
    { id: "ocr", label: "OCR", icon: ScanText, keywords: ["ocr", "read", "extract", "scan text"] },
  ],
  ai: [
    { id: "brush", label: "Eraser", icon: Eraser, keywords: ["erase", "brush", "rub out"] },
    { id: "magic", label: "Magic Eraser", icon: BroomSparkles, keywords: ["magic", "patchmatch", "inpaint", "content aware"] },
    { id: "rembg", label: "Background Removal", icon: Scissors, keywords: ["background", "cutout", "rembg", "transparent"] },
    { id: "inpaint", label: "Object Removal", icon: Trash2, keywords: ["object", "remove", "inpaint", "delete"] },
  ],
  emoji: [
    { id: "logo", label: "Logo", icon: ImagePlus, keywords: ["logo", "watermark", "brand", "batch"] },
    { id: "text", label: "Text", icon: Type, keywords: ["text", "caption", "batch"] },
    { id: "rename", label: "Rename", icon: FileEdit, keywords: ["rename", "filename", "batch"] },
    {
      id: "airename",
      label: "AI Rename",
      icon: ScanEye,
      keywords: ["ai rename", "smart rename", "describe", "content", "auto name", "batch"],
    },
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
  shapes: {
    select: (s) => s.shapesMode,
    set: (m) => useToolStore.getState().setShapesMode(m as ShapesMode),
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
  // Perspective is a REGISTERED module, so its `modes` come from TOOL_MODULES
  // (PERSPECTIVE_MODES) rather than LEGACY_SUBMODES — but it still needs a
  // MODE_ACCESS row, because `modesFor` and the accessor are two separate
  // sources: the registry says what the modes ARE, this says where the active
  // one LIVES. Without it the SubtoolRow renders three tiles that never light.
  perspective: {
    select: (s) => s.perspectiveMode,
    set: (m) => useToolStore.getState().setPerspectiveMode(m as PerspectiveMode),
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

/** Switch a tool's sub-mode. No-op when the id isn't one of that tool's modes
 *  (a hand-typed URL is untrusted input — it must not poke a bogus value into
 *  a typed store union). Returns whether it took. */
/**
 * Read a tool's active sub-mode out of a store snapshot.
 *
 * Exported because `activateSubTool.ts` used to carry its OWN hand-written
 * switch over the same axis ("mirrors MODE_ACCESS", per its comment) — a
 * fourth copy after MODE_ACCESS, LEGACY_SUBMODES and routeState's. It went
 * stale the moment perspective was added: the switch had no `perspective`
 * case, fell through to `undefined`, and `useActiveSubTool` therefore rejected
 * the stored key on every read and lit nothing. Three tiles that never
 * highlighted — the exact failure MODE_ACCESS's own comment warns about, from
 * the copy nobody thought to update.
 *
 * `select` is a plain selector, so this is safe inside a React selector and
 * there is no reason for a second list to exist. Do not reintroduce one.
 */
export function selectModeOf(
  s: ToolState,
  tool: ToolType,
): string | undefined {
  return MODE_ACCESS[tool]?.select(s);
}

export function setModeOf(tool: ToolType, modeId: string): boolean {
  if (!modesFor(tool).some((m) => m.id === modeId)) return false;
  const access = MODE_ACCESS[tool];
  if (!access) return false;
  if (access.select(useToolStore.getState()) !== modeId) access.set(modeId);
  return true;
}
