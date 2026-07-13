// ===== FILE: app/src/features/tools/toolModes.ts =====
// The SUB-MODE AXIS — one table saying, for every multi-mode tool: what its
// sub-modes are, how to read the active one, and how to set it.
//
// Two consumers need exactly this and must not disagree:
//   • the command palette (jump-to-sub-mode entries), and
//   • URL routing (`#/tool/paint/blur` -> setBrushMode("blur")).
// Before this file, the palette carried a private LEGACY_SUBMODES list plus a
// private SUBMODE_SETTERS map; a second copy in the routing module would have
// been a drift bug waiting to happen. Tool metadata belongs to tool-land, so
// it lives here and both features import it.
//
// SOURCES (priority order, same rule the palette always used):
//   1. TOOL_MODULES — the tool registry. A migrated tool's `modes` array IS
//      its sub-mode list (Paint, Resize, Adjust & Select today).
//   2. LEGACY_SUBMODES below — hand-written lists for tools not yet in the
//      registry (Stamps, Shapes).
// DECISION (unchanged, just relocated): when a tool migrates into
// TOOL_MODULES, delete its row from LEGACY_SUBMODES in that same session.
import type { ToolType } from "@/lib/types";
import { TOOL_MODULES } from "./toolModules";
import { useToolStore } from "@/stores/useToolStore";
import type {
  AdjustMode,
  BrushMode,
  ResizeMode,
  ShapesMode,
  StampSubMode,
} from "@/stores/useToolStore";

/** One sub-mode as the palette and the router need it: an id, something to
 *  show a human, and fuzzy-search terms. (The rich `ToolMode` — icons, info
 *  copy — stays in the registry; this is the thin projection of it.) */
export interface ToolModeInfo {
  id: string;
  label: string;
  keywords: string[];
}

/** Sub-mode lists for tools NOT yet in TOOL_MODULES. */
const LEGACY_SUBMODES: Partial<Record<ToolType, ToolModeInfo[]>> = {
  stamp: [
    { id: "clone", label: "Clone Stamp", keywords: ["clone", "heal", "duplicate"] },
    { id: "red", label: "Red Stamps", keywords: ["red", "batch stamp", "marker"] },
    { id: "emojis", label: "Emojis", keywords: ["emoji", "sticker"] },
  ],
  shapes: [
    { id: "shapes", label: "Shapes", keywords: ["rectangle", "ellipse", "box"] },
    { id: "pens", label: "Pens", keywords: ["pen", "bezier", "path", "vector"] },
    { id: "arrows", label: "Arrows", keywords: ["arrow", "pointer", "annotate"] },
  ],
};

/** Read/write the store field that holds a tool's active sub-mode. */
interface ModeAccess {
  get: () => string;
  set: (modeId: string) => void;
}

const MODE_ACCESS: Partial<Record<ToolType, ModeAccess>> = {
  brush: {
    get: () => useToolStore.getState().brushMode,
    set: (m) => useToolStore.getState().setBrushMode(m as BrushMode),
  },
  compress: {
    get: () => useToolStore.getState().resizeMode,
    set: (m) => useToolStore.getState().setResizeMode(m as ResizeMode),
  },
  crop: {
    get: () => useToolStore.getState().adjustMode,
    set: (m) => useToolStore.getState().setAdjustMode(m as AdjustMode),
  },
  stamp: {
    get: () => useToolStore.getState().stampSubMode,
    set: (m) => useToolStore.getState().setStampSubMode(m as StampSubMode),
  },
  shapes: {
    get: () => useToolStore.getState().shapesMode,
    set: (m) => useToolStore.getState().setShapesMode(m as ShapesMode),
  },
};

/** The tool's sub-modes: registry first, legacy list as the fallback. Empty
 *  array for single-mode tools (Text, AI, Effects, Layer Settings, Batch). */
export function modesFor(tool: ToolType): ToolModeInfo[] {
  const registered = TOOL_MODULES[tool]?.modes;
  if (registered?.length) {
    return registered.map((m) => ({
      id: m.id,
      label: m.label,
      keywords: [m.label],
    }));
  }
  return LEGACY_SUBMODES[tool] ?? [];
}

/** The tool's currently-active sub-mode id, or `undefined` if it has none. */
export function activeModeOf(tool: ToolType): string | undefined {
  if (!modesFor(tool).length) return undefined;
  return MODE_ACCESS[tool]?.get();
}

/** Switch a tool's sub-mode. No-op when the id isn't one of that tool's modes
 *  (a hand-typed URL is untrusted input — it must not poke a bogus value into
 *  a typed store union). Returns whether it took. */
export function setModeOf(tool: ToolType, modeId: string): boolean {
  if (!modesFor(tool).some((m) => m.id === modeId)) return false;
  const access = MODE_ACCESS[tool];
  if (!access) return false;
  if (access.get() !== modeId) access.set(modeId);
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
