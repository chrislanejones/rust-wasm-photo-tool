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
import { useToolStore } from "@/stores/useToolStore";
import { useUIStore } from "@/stores/useUIStore";
import { useGalleryStore } from "@/stores/useGalleryStore";
import {
  parseRoute,
  formatRoute,
  routeFromSearch,
  routeLabel,
  SETTINGS_TAB_LABELS,
  type Route,
} from "./routes";
import {
  resolveSubTool,
  subToolByKey,
  subToolForToolMode,
} from "@/features/tools/toolGroups";
import { activateSubTool } from "@/features/tools/activateSubTool";

/** The lit sub-tool, read imperatively (the router is not a component).
 *  Mirrors `useActiveSubTool`'s fallback rule: the stored key wins while it
 *  still agrees with the live (tool, mode) pair, otherwise re-derive. */
function activeSubToolResolved() {
  const s = useToolStore.getState();
  const stored = subToolByKey(s.activeSubTool);
  const mode = modeOfActiveTool(s);
  if (
    stored &&
    !stored.subTool.comingSoon &&
    stored.subTool.tool === s.activeTool &&
    (stored.subTool.mode === undefined || stored.subTool.mode === mode)
  ) {
    return stored;
  }
  return subToolForToolMode(s.activeTool, mode);
}

/** The mode field the active tool's sub-mode lives in. */
function modeOfActiveTool(s: ReturnType<typeof useToolStore.getState>) {
  switch (s.activeTool) {
    case "brush": return s.brushMode;
    case "compress": return s.resizeMode;
    case "select": return s.selectionKind;
    case "stamp": return s.stampSubMode;
    case "shapes": return s.shapesMode;
    case "ai": return s.eraserMode;
    case "text": return s.textMode;
    case "emoji": return s.batchMode;
    default: return undefined; // single-mode: effects, crop, arrow
  }
}

export const parseHash = (hash: string): Route | null => parseRoute(hash);
export const parseSearch = (search: string): Route | null =>
  routeFromSearch(search);

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
  // The URL names the lit SUB-TOOL. `activeSubTool` is the store's own answer
  // when it agrees with (activeTool, mode); the registry re-derives when it
  // doesn't (a reload, a legacy link, a panel's own mode toggle).
  const sub = activeSubToolResolved();
  return sub
    ? { kind: "tool", group: sub.group.id, subTool: sub.subTool.id }
    : { kind: "tool", group: "enhance", subTool: "compress" };
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

  // Batch needs 2+ photos. The rail disables it and the digit ignores it — so
  // a link must too, rather than dropping the user into a group whose own UI
  // says it isn't available.
  if (route.group === "batch" && useGalleryStore.getState().photos.length <= 1) return;

  const resolved = resolveSubTool(route.group, route.subTool);
  // Unknown or Coming Soon: refuse rather than guess. parseRoute already
  // collapses those to the group default, so reaching here means the route was
  // built by hand in code.
  if (!resolved || resolved.subTool.comingSoon) return;

  // One activation path, shared with the rail and the palette — it sets the
  // tool, the mode, the lit sub-tool and any preselect (the Color Picker
  // toggle) together. A second path here is how the URL and the app desync.
  activateSubTool(resolved);
}

/** "Create › Brush" / "Settings › Security" — for the palette's go-to row, the
 *  copy-link toast, and anywhere a route needs a human name. */
export function describeRoute(route: Route): string {
  if (route.kind === "settings") {
    return `Settings › ${SETTINGS_TAB_LABELS[route.tab]}`;
  }
  return routeLabel(route);
}
