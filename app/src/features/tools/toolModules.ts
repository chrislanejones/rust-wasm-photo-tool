// ===== FILE: app/src/features/tools/toolModules.ts =====
// The tool REGISTRY shape (WT2 arc). A ToolModule is the self-contained
// description of one tool: identity, sub-modes, and its settings panel.
// Tools are migrated into this registry one per session (see the
// tool-module-migration skill); Paint is the first registered module and the
// reference implementation of the ToolModeToggle pattern.
//
// IMPORTANT — this file only LAYS THE SHAPE. Routing (ToolsSidebar's
// activeTool switch, keyboard shortcuts, persistence keys) is NOT wired
// through the registry yet; that happens per-tool in later sessions. Do not
// add AppShell wiring here or anywhere else.
import type { ToolType } from "@/lib/types";
import type { ToolMode } from "@/components/ui/tool-mode-toggle";
import { Paintbrush, Shrink, VectorSquare } from "lucide-react";
import { PaintSettings, PAINT_MODES } from "./settings/PaintSettings";
import type { PaintMode } from "./settings/PaintSettings";
import { ResizeSettings, RESIZE_MODES } from "./settings/ResizeSettings";
import {
  TransformCropSettings,
  ADJUST_MODES,
} from "./settings/TransformCropSettings";
import type { ResizeMode, AdjustMode } from "@/stores/useToolStore";

/**
 * Minimal registry entry for one tool. Kept deliberately small — fields are
 * added only when a migration session actually needs them.
 */
interface ToolModule<M extends string = string> {
  /** Registry id. MUST equal the tool's legacy `ToolType` id (`brush`,
   *  `stamp`, `emoji`, `arrow`, …) — ids are renamed to match labels only
   *  during that tool's own migration session, never here (shortcuts and
   *  persistence keys depend on them). */
  id: ToolType;
  /** Display label — mirrors `toolConfig.ts` TOOLS until the registry becomes
   *  the single definition site for tool metadata. */
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Sub-modes rendered by the shared ToolModeToggle (icon-row + title +
   *  body). Empty array for single-mode tools. */
  modes: readonly ToolMode<M>[];
  /** The tool's settings panel (sidebar body). Props stay tool-specific until
   *  each tool's own migration session standardizes them — `never` makes that
   *  explicit: nothing renders panels FROM the registry yet, and anything that
   *  tries must first give modules a standardized props contract. */
  Settings: React.ComponentType<never>;
}

/** Paint — first registered module; consumer #1 of ToolModeToggle. */
const paintModule: ToolModule<PaintMode> = {
  id: "brush", // legacy id — see ToolModule.id
  label: "Paint",
  icon: Paintbrush,
  modes: PAINT_MODES,
  Settings: PaintSettings,
};

/** Resize/Compress — second registered module (tool-UI arc Session 2.1).
 *  Registered under its legacy id `compress` (shortcut `1` and the ToolType
 *  union depend on it); the display label has been "Resize" since
 *  toolConfig.ts. Sub-mode state lives in `useToolStore.resizeMode`. */
const resizeModule: ToolModule<ResizeMode> = {
  id: "compress", // legacy id — see ToolModule.id
  label: "Resize",
  icon: Shrink,
  modes: RESIZE_MODES,
  Settings: ResizeSettings,
};

/** Adjust & Select — third registered module (tool-UI arc Session 2.6).
 *  Registered under its legacy id `crop` (shortcut `2` + persistence depend on
 *  it); the DISPLAY label became "Adjust & Select" when the Select sub-mode
 *  moved in from Layer Settings. Sub-mode state: `useToolStore.adjustMode`. */
const adjustModule: ToolModule<AdjustMode> = {
  id: "crop", // legacy id — see ToolModule.id
  label: "Adjust & Select",
  icon: VectorSquare,
  modes: ADJUST_MODES,
  Settings: TransformCropSettings,
};

/**
 * The registry. Partial — tools appear here one migration session at a time
 * (emoji/Batch next per the skill order; clone stamp last).
 */
export const TOOL_MODULES: Partial<Record<ToolType, ToolModule>> = {
  brush: paintModule,
  compress: resizeModule,
  crop: adjustModule,
};
