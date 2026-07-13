// ===== FILE: app/src/features/commandPalette/commands.ts =====
// The typed palette-command registry. Every entry is
// { id, label, group, keywords, run() } plus display extras (icon, shortcut
// hint) and a `disabled` precondition.
//
// SOURCES (in priority order):
//   1. TOOL_MODULES — the tool registry (features/tools/toolModules.ts).
//      Paint and Resize/Compress are registered there today; their sub-mode
//      entries derive from each module's `modes` (PAINT_MODES /
//      RESIZE_MODES), NOT a copy.
//   2. toolConfig.ts TOOLS — tools not yet migrated into the registry.
//   3. LEGACY_SUBMODES below — sub-mode lists for not-yet-migrated tools.
//      DECISION: these hardcoded lists migrate into each tool's
//      ToolModule.modes as tools land in the registry, one per session
//      (tool-module-migration skill). Delete the tool's row here in that
//      same session.
//
// run() routes through the existing Zustand stores only — no window
// CustomEvents (forbidden), no AppShell coupling. Entries whose plumbing
// arrives with the hot-toggle pass (TASK C: preferences broadcast, Settings
// tab requests, the undo/redo action bridge) stay `disabled` until their
// PaletteContext field is provided.
import {
  Activity,
  Download,
  History,
  ImagePlus,
  Keyboard,
  Images,
  Monitor,
  Moon,
  PanelLeft,
  Redo2,
  Ruler,
  Settings,
  Shield,
  Sun,
  Undo2,
} from "lucide-react";
import type { ToolType } from "@/lib/types";
import type { ThemeChoice } from "@/lib/preferences";
import type { SettingsTab } from "@/components/SubscriptionButton";
import { TOOLS, TOOL_MODULES } from "@/features/tools";
import {
  useToolStore,
  type AdjustMode,
  type BrushMode,
  type ResizeMode,
  type ShapesMode,
  type StampSubMode,
} from "@/stores/useToolStore";
import { useUIStore } from "@/stores/useUIStore";

export type PaletteGroup = "tools" | "settings" | "actions";

export interface PaletteCommand {
  /** Stable id — persisted in useUIStore.recentCommands; never rename. */
  id: string;
  label: string;
  group: PaletteGroup;
  /** Extra fuzzy-match terms beyond the label (cmdk `keywords`). */
  keywords: string[];
  icon?: React.ComponentType<{ className?: string }>;
  /** Display-only shortcut hint (the binding lives in useKeyboardShortcuts). */
  shortcut?: string;
  /** Precondition failed (e.g. Batch needs 2+ photos) — rendered but inert. */
  disabled?: boolean;
  run: () => void;
}

/** Live app context the registry builder needs. The optional fields are the
 *  TASK C plumbing — until provided, their entries render disabled. */
export interface PaletteContext {
  photoCount: number;
  /** Rulers/grid/theme hot-toggles (preferences live outside Zustand —
   *  usePreferences broadcasts commits to every instance, AppShell included). */
  prefs?: {
    rulers: boolean;
    grid: boolean;
    theme: ThemeChoice;
    set: (
      patch: Partial<{ rulers: boolean; grid: boolean; theme: ThemeChoice }>,
    ) => void;
  };
  /** Open the Settings modal on a given tab (Security, Rulers & Grids…). */
  requestSettings?: (tab?: SettingsTab) => void;
  /** AppShell-scoped session handlers, bridged via useKeyboardShortcuts. */
  actions?: { undo: () => void; redo: () => void } | null;
}

/** Per-tool sub-mode dispatch — the store owns the canonical mode unions. */
const SUBMODE_SETTERS: Partial<Record<ToolType, (modeId: string) => void>> = {
  brush: (m) => useToolStore.getState().setBrushMode(m as BrushMode),
  compress: (m) => useToolStore.getState().setResizeMode(m as ResizeMode),
  crop: (m) => useToolStore.getState().setAdjustMode(m as AdjustMode),
  stamp: (m) => useToolStore.getState().setStampSubMode(m as StampSubMode),
  shapes: (m) => useToolStore.getState().setShapesMode(m as ShapesMode),
};

/** Sub-mode lists for tools NOT yet in TOOL_MODULES (see DECISION above). */
const LEGACY_SUBMODES: {
  tool: ToolType;
  toolLabel: string;
  modes: { id: string; label: string; keywords: string[] }[];
}[] = [
  {
    tool: "stamp",
    toolLabel: "Stamps",
    modes: [
      { id: "clone", label: "Clone Stamp", keywords: ["clone", "heal", "duplicate"] },
      { id: "red", label: "Red Stamps", keywords: ["red", "batch stamp", "marker"] },
      { id: "emojis", label: "Emojis", keywords: ["emoji", "sticker"] },
    ],
  },
  {
    tool: "shapes",
    toolLabel: "Shapes",
    modes: [
      { id: "shapes", label: "Shapes", keywords: ["rectangle", "ellipse", "box"] },
      { id: "pens", label: "Pens", keywords: ["pen", "bezier", "path", "vector"] },
      { id: "arrows", label: "Arrows", keywords: ["arrow", "pointer", "annotate"] },
    ],
  },
];

const jumpToTool = (id: ToolType) => useToolStore.getState().setActiveTool(id);

const jumpToSubMode = (tool: ToolType, modeId: string) => {
  jumpToTool(tool);
  SUBMODE_SETTERS[tool]?.(modeId);
};

export function buildPaletteCommands(ctx: PaletteContext): PaletteCommand[] {
  const ui = () => useUIStore.getState();
  const commands: PaletteCommand[] = [];

  // ── Tools: jump-to-tool ──────────────────────────────────────────────────
  for (const tool of TOOLS) {
    // Registry module wins as the metadata source once a tool has migrated.
    const module = TOOL_MODULES[tool.id];
    commands.push({
      id: `tool.${tool.id}`,
      label: module?.label ?? tool.label,
      group: "tools",
      keywords: [tool.description],
      icon: module?.icon ?? tool.icon,
      shortcut: tool.shortcutKey,
      // Batch Image Editor needs 2+ photos — mirrors AppShell's onToolChange
      // guard so the palette matches the sidebar gating exactly.
      disabled: tool.id === "emoji" && ctx.photoCount <= 1,
      run: () => jumpToTool(tool.id),
    });
  }

  // ── Tools: jump-to-sub-mode (registry modules first) ─────────────────────
  for (const module of Object.values(TOOL_MODULES)) {
    if (!module) continue; // Partial<Record<…>> — TS sees optional slots
    for (const mode of module.modes) {
      commands.push({
        id: `mode.${module.id}.${mode.id}`,
        label: `${module.label} › ${mode.label}`,
        group: "tools",
        keywords: [mode.label, module.label],
        icon: mode.icon,
        run: () => jumpToSubMode(module.id, mode.id),
      });
    }
  }
  // …then the not-yet-migrated tools' hardcoded lists.
  for (const legacy of LEGACY_SUBMODES) {
    if (TOOL_MODULES[legacy.tool]?.modes.length) continue; // migrated → registry wins
    const toolDef = TOOLS.find((t) => t.id === legacy.tool);
    for (const mode of legacy.modes) {
      commands.push({
        id: `mode.${legacy.tool}.${mode.id}`,
        label: `${legacy.toolLabel} › ${mode.label}`,
        group: "tools",
        keywords: [...mode.keywords, legacy.toolLabel],
        icon: toolDef?.icon,
        run: () => jumpToSubMode(legacy.tool, mode.id),
      });
    }
  }

  // ── Settings ─────────────────────────────────────────────────────────────
  commands.push(
    {
      id: "settings.open",
      label: "Open Settings",
      group: "settings",
      keywords: ["preferences", "options", "general"],
      icon: Settings,
      shortcut: "Alt+S",
      disabled: !ctx.requestSettings,
      run: () => ctx.requestSettings?.("general"),
    },
    {
      id: "settings.security",
      label: "Security & EXIF",
      group: "settings",
      keywords: ["security", "exif", "privacy", "metadata", "gps"],
      icon: Shield,
      disabled: !ctx.requestSettings,
      run: () => ctx.requestSettings?.("security"),
    },
    {
      id: "settings.rulers-pane",
      label: "Rulers & Grids Settings",
      group: "settings",
      keywords: ["ruler", "grid", "guides", "overlay"],
      icon: Ruler,
      disabled: !ctx.requestSettings,
      run: () => ctx.requestSettings?.("rulers"),
    },
    {
      id: "settings.toggle-rulers",
      label: ctx.prefs?.rulers ? "Hide Rulers" : "Show Rulers",
      group: "settings",
      keywords: ["ruler", "toggle rulers", "measure"],
      icon: Ruler,
      disabled: !ctx.prefs,
      run: () => {
        const p = ctx.prefs;
        if (p) p.set({ rulers: !p.rulers });
      },
    },
    {
      id: "settings.toggle-grid",
      label: ctx.prefs?.grid ? "Hide Grid" : "Show Grid",
      group: "settings",
      keywords: ["grid", "toggle grid", "overlay", "golden ratio"],
      icon: Ruler,
      disabled: !ctx.prefs,
      run: () => {
        const p = ctx.prefs;
        if (p) p.set({ grid: !p.grid });
      },
    },
    {
      id: "settings.theme-dark",
      label: "Theme: Dark",
      group: "settings",
      keywords: ["dark mode", "appearance", "theme"],
      icon: Moon,
      disabled: !ctx.prefs || ctx.prefs.theme === "dark",
      run: () => ctx.prefs?.set({ theme: "dark" }),
    },
    {
      id: "settings.theme-light",
      label: "Theme: Light",
      group: "settings",
      keywords: ["light mode", "appearance", "theme"],
      icon: Sun,
      disabled: !ctx.prefs || ctx.prefs.theme === "light",
      run: () => ctx.prefs?.set({ theme: "light" }),
    },
    {
      id: "settings.theme-system",
      label: "Theme: System",
      group: "settings",
      keywords: ["system theme", "appearance", "auto"],
      icon: Monitor,
      disabled: !ctx.prefs || ctx.prefs.theme === "system",
      run: () => ctx.prefs?.set({ theme: "system" }),
    },
  );

  // ── Actions ──────────────────────────────────────────────────────────────
  commands.push(
    {
      id: "action.new",
      label: "New / Import Photos",
      group: "actions",
      keywords: ["new document", "upload", "open", "import", "add photo"],
      icon: ImagePlus,
      shortcut: "Alt+N",
      run: () => ui().setShowUpload(true),
    },
    {
      id: "action.export",
      label: "Export Photo…",
      group: "actions",
      keywords: ["download", "save", "export"],
      icon: Download,
      shortcut: "Alt+E",
      disabled: ctx.photoCount === 0,
      run: () => ui().setExportDialogOpen(true),
    },
    {
      id: "action.undo",
      label: "Undo",
      group: "actions",
      keywords: ["revert", "back"],
      icon: Undo2,
      shortcut: "Ctrl+Z",
      disabled: !ctx.actions,
      run: () => ctx.actions?.undo(),
    },
    {
      id: "action.redo",
      label: "Redo",
      group: "actions",
      keywords: ["forward", "again"],
      icon: Redo2,
      shortcut: "Ctrl+Shift+Z",
      disabled: !ctx.actions,
      run: () => ctx.actions?.redo(),
    },
    {
      id: "action.toggle-tools",
      label: "Toggle Tools Sidebar",
      group: "actions",
      keywords: ["tools panel", "sidebar"],
      icon: PanelLeft,
      shortcut: "Alt+T",
      run: () => ui().setShowTools((v) => !v),
    },
    {
      id: "action.toggle-gallery",
      label: "Toggle Gallery",
      group: "actions",
      keywords: ["photos", "gallery bar"],
      icon: Images,
      shortcut: "Alt+G",
      run: () => ui().setShowGallery((v) => !v),
    },
    {
      id: "action.toggle-history",
      label: "Toggle Edit History",
      group: "actions",
      keywords: ["history panel", "review", "edits"],
      icon: History,
      shortcut: "Alt+R",
      run: () => ui().setShowHistory((v) => !v),
    },
    {
      id: "action.shortcuts",
      label: "Keyboard Shortcuts",
      group: "actions",
      keywords: ["help", "hotkeys", "bindings"],
      icon: Keyboard,
      shortcut: "Alt+/",
      run: () => ui().setShowShortcutModal(true),
    },
    {
      id: "action.diagnostics",
      label: "Toggle Diagnostics",
      group: "actions",
      keywords: ["debug", "performance", "logs", "monitor"],
      icon: Activity,
      shortcut: "Alt+Del",
      run: () => ui().setShowDiagnostics((v) => !v),
    },
  );

  return commands;
}
