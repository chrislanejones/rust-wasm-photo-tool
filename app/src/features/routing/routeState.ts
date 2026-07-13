// ===== FILE: app/src/features/routing/routeState.ts =====
// Route <-> Zustand state. The two directions of the mirror:
//
//   readRoute()      state -> Route   (what the URL should say right now)
//   applyRoute(r)    Route -> state   (what a URL asked for)
//
// The sub-mode axis is NOT re-implemented here: it comes from
// features/tools/toolModes.ts, the same table the command palette uses. One
// source, so the palette and the router can't disagree about what "Paint ›
// Blur" means.
import type { ToolType } from "@/lib/types";
import { useToolStore } from "@/stores/useToolStore";
import { useUIStore } from "@/stores/useUIStore";
import { useGalleryStore } from "@/stores/useGalleryStore";
import { modesFor, activeModeOf, setModeOf } from "@/features/tools/toolModes";
import {
  parseRoute,
  formatRoute,
  routeFromSearch,
  SETTINGS_TAB_LABELS,
  toolSlug,
  type Route,
} from "./routes";
import { TOOLS } from "@/features/tools";

/** The live mode table, injected into the pure parser. */
const modesOf = (tool: ToolType): readonly string[] =>
  modesFor(tool).map((m) => m.id);

export const parseHash = (hash: string): Route | null => parseRoute(hash, modesOf);
export const parseSearch = (search: string): Route | null =>
  routeFromSearch(search, modesOf);

/**
 * The route the app is currently *at*.
 *
 * PRECEDENCE: an open Settings modal wins over the tool underneath it. It is
 * the foreground view — what you'd expect a link to this screen to reopen —
 * and closing it drops the URL back to the tool route.
 */
export function readRoute(): Route {
  const ui = useUIStore.getState();
  if (ui.settingsOpen) return { kind: "settings", tab: ui.settingsTab };
  const tool = useToolStore.getState().activeTool;
  return { kind: "tool", tool, mode: activeModeOf(tool) };
}

/** The fragment the URL should currently carry. */
export const currentHash = (): string => formatRoute(readRoute());

/**
 * Drive the app to `route`.
 *
 * Every write is guarded by a value comparison — a setter only fires when the
 * value actually CHANGES. That is the loop guard (no "am I writing?" boolean,
 * which is the classic way this feature rots: a stale flag and the hash and
 * the state stop agreeing). It also keeps a redundant re-apply from re-firing
 * AppShell's activeTool effects (which reset colour-picker / move / selection
 * modes).
 */
export function applyRoute(route: Route): void {
  const ui = useUIStore.getState();

  if (route.kind === "settings") {
    if (!ui.settingsOpen || ui.settingsTab !== route.tab) ui.openSettings(route.tab);
    return;
  }

  // A tool route means the editor, not the modal.
  if (ui.settingsOpen) ui.closeSettings();

  // Batch Image Editor needs 2+ photos. The sidebar disables it, the keyboard
  // shortcut ignores it (AppShell's onToolChange) — so a link must too, rather
  // than dropping the user into a tool whose own UI says it isn't available.
  if (route.tool === "emoji" && useGalleryStore.getState().photos.length <= 1) return;

  const tools = useToolStore.getState();
  if (tools.activeTool !== route.tool) tools.setActiveTool(route.tool);
  if (route.mode) setModeOf(route.tool, route.mode);
}

/** "Paint › Blur" / "Settings › Security" — for the palette's go-to row, the
 *  copy-link toast, and anywhere a route needs a human name. */
export function describeRoute(route: Route): string {
  if (route.kind === "settings") {
    return `Settings › ${SETTINGS_TAB_LABELS[route.tab]}`;
  }
  const label =
    TOOLS.find((t) => t.id === route.tool)?.label ?? toolSlug(route.tool);
  const mode = route.mode
    ? modesFor(route.tool).find((m) => m.id === route.mode)?.label
    : undefined;
  return mode ? `${label} › ${mode}` : label;
}
