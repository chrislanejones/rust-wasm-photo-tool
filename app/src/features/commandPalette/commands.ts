// ===== FILE: app/src/features/commandPalette/commands.ts =====
// The typed palette-command registry — and, since routing landed, the SSOT for
// navigation. Every entry is { id, label, group, keywords, run() } plus display
// extras (icon, shortcut hint) and a `disabled` precondition.
//
// SOURCES (in priority order):
//   1. TOOL_MODULES — the tool registry (features/tools/toolModules.ts).
//   2. toolConfig.ts TOOLS — tools not yet migrated into the registry.
//   3. features/tools/toolModes.ts — the sub-mode axis, registry-first with
//      hand-written lists for the not-yet-migrated tools. That table used to
//      live in this file; it moved out when the router needed the same
//      knowledge, because the alternative was two copies of it.
//
// NAVIGATION. Any entry that moves the user calls navigateTo() — it applies the
// route to the stores AND writes the URL. The palette does not touch
// setActiveTool / setBrushMode / openSettings directly. Alt+, a pasted link,
// and the Back button are three front doors onto one road; a second, private
// path is exactly how the address bar starts lying about where you are.
//
// run() routes through Zustand stores and the router only — no window
// CustomEvents (forbidden), no AppShell coupling.
import {
  Activity,
  Download,
  History,
  ImagePlus,
  Keyboard,
  Images,
  Link2,
  Monitor,
  Moon,
  Navigation,
  PanelLeft,
  Redo2,
  Ruler,
  Settings,
  Shield,
  Sun,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";
import type { ToolType } from "@/lib/types";
import type { ThemeChoice } from "@/lib/preferences";
import type { SettingsTab } from "@/components/SubscriptionButton";
import { TOOLS, TOOL_MODULES } from "@/features/tools";
import { allToolModes } from "@/features/tools/toolModes";
import { useUIStore } from "@/stores/useUIStore";
import { navigateTo, currentRouteUrl, currentRouteLabel } from "@/features/routing";

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
  /** Leave the palette open after running. For entries that hand the palette
   *  back to you rather than taking you somewhere (Go to route… re-arms the
   *  search field as a jump box). */
  keepOpen?: boolean;
  run: () => void;
}

/** Live app context the registry builder needs. The optional fields are
 *  plumbing the palette provides — until provided, their entries render
 *  disabled. */
interface PaletteContext {
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
  /** AppShell-scoped session handlers, bridged via useKeyboardShortcuts. */
  actions?: { undo: () => void; redo: () => void } | null;
  /** Turn the palette's own search field into a route jump box (prefills it
   *  with `#/`). Provided by CommandPalette. */
  promptRoute?: () => void;
}

/** Copy a link to whatever view you're looking at.
 *
 *  Clipboard access fails on an insecure origin or a denied permission — in
 *  which case show the URL instead of a failure, so the link is still
 *  selectable by hand. Same fallback the share dialog already uses. */
async function copyRouteLink(): Promise<void> {
  const url = currentRouteUrl();
  try {
    await navigator.clipboard.writeText(url);
    toast.success("Link copied", { description: currentRouteLabel() });
  } catch {
    toast.info(url, { description: "Copy this link — clipboard access was blocked" });
  }
}

// ── Navigation ───────────────────────────────────────────────────────────────
// Every entry that MOVES the user goes through navigateTo(). It applies the
// route to the stores and records it in the URL, so Alt+, and a pasted link
// arrive by the same road and the address bar never lies about where you are.
// The palette does NOT call setActiveTool / setBrushMode / openSettings itself:
// a second navigation path is precisely how the URL and the app desync.
const jumpToTool = (tool: ToolType) => navigateTo({ kind: "tool", tool });

const jumpToSubMode = (tool: ToolType, mode: string) =>
  navigateTo({ kind: "tool", tool, mode });

/** Settings panes are routes too (`#/settings/security`). */
const openSettingsTab = (tab: SettingsTab) => navigateTo({ kind: "settings", tab });

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

  // ── Tools: jump-to-sub-mode ──────────────────────────────────────────────
  // One source: features/tools/toolModes (registry modules first, hand-written
  // lists for the not-yet-migrated tools). The palette used to keep its own
  // copy of both, which the router would then have had to copy again.
  for (const { tool, mode } of allToolModes()) {
    const module = TOOL_MODULES[tool];
    const toolDef = TOOLS.find((t) => t.id === tool);
    const toolLabel = module?.label ?? toolDef?.label ?? tool;
    commands.push({
      id: `mode.${tool}.${mode.id}`,
      label: `${toolLabel} › ${mode.label}`,
      group: "tools",
      keywords: [...mode.keywords, toolLabel],
      icon: module?.modes.find((m) => m.id === mode.id)?.icon ?? toolDef?.icon,
      run: () => jumpToSubMode(tool, mode.id),
    });
  }

  // (The old hand-rolled "Adjust & Select › <kind>" block is gone: Select is
  // its own tool now, its kinds ARE its registry sub-modes, so the generic
  // loop above already emits `mode.select.wand` … `mode.select.lasso` with
  // real routes (`#/tool/select/wand`). Persisted recents pointing at the old
  // `select.<kind>` ids simply stop matching, which the palette drops
  // gracefully.)

  // ── Settings ─────────────────────────────────────────────────────────────
  commands.push(
    {
      id: "settings.open",
      label: "Open Settings",
      group: "settings",
      keywords: ["preferences", "options", "general"],
      icon: Settings,
      shortcut: "Alt+S",
      run: () => openSettingsTab("general"),
    },
    {
      id: "settings.security",
      label: "Security & EXIF",
      group: "settings",
      keywords: ["security", "exif", "privacy", "metadata", "gps"],
      icon: Shield,
      run: () => openSettingsTab("security"),
    },
    {
      id: "settings.rulers-pane",
      label: "Rulers & Grids Settings",
      group: "settings",
      keywords: ["ruler", "grid", "guides", "overlay"],
      icon: Ruler,
      run: () => openSettingsTab("rulers"),
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
      id: "action.copy-link",
      label: "Copy link to this view",
      group: "actions",
      keywords: [
        "copy link",
        "share",
        "url",
        "permalink",
        "deep link",
        "bookmark",
        "address",
      ],
      icon: Link2,
      run: () => void copyRouteLink(),
    },
    {
      id: "action.goto",
      label: "Go to route…",
      group: "actions",
      keywords: ["goto", "jump", "navigate", "route", "url", "hash", "address"],
      icon: Navigation,
      // Hands the palette back to you with `#/` in the search box: type the
      // rest and the jump row appears. No second dialog for what is, after
      // all, a text field the palette already has.
      keepOpen: true,
      disabled: !ctx.promptRoute,
      run: () => ctx.promptRoute?.(),
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
