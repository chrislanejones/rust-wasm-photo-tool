// ===== FILE: app/src/features/tools/activateSubTool.ts =====
// Turning a sub-tool into app state, and reading back which one is lit.
//
// Split out of toolGroups.ts on purpose: that file is DATA (importable by
// anything, including tests, with no store edge), this one is the ACTION and
// necessarily talks to Zustand.
//
// Everything here goes through the same store setters the panels and the rail
// already use — `setActiveTool`, `setModeOf`, `setColorPickerActive`,
// `setToolSettings`. There is no privileged path: activating a sub-tool does
// exactly what a user clicking the equivalent controls by hand would do, which
// is what keeps the restructure behaviour-preserving.
import { useCallback } from "react";
import { useToolStore } from "@/stores/useToolStore";
import type { ToolState } from "@/stores/useToolStore";
import { setModeOf } from "./toolModes";
import {
  ALL_SUB_TOOLS,
  defaultSubToolOf,
  subToolByKey,
  subToolForToolMode,
  type LiveSubTool,
  type ResolvedSubTool,
  type ToolGroupDefinition,
} from "./toolGroups";

/** The mode field a tool's sub-mode lives in, for the read-back path. Mirrors
 *  MODE_ACCESS in toolModes.ts; kept as a selector list rather than re-exported
 *  from there because this one has to be usable inside a React selector. */
function modeOfTool(s: ToolState): string | undefined {
  switch (s.activeTool) {
    case "brush":
      return s.brushMode;
    case "compress":
      return s.resizeMode;
    case "select":
      return s.selectionKind;
    case "stamp":
      return s.stampSubMode;
    case "shapes":
      return s.shapesMode;
    case "ai":
      return s.eraserMode;
    case "text":
      return s.textMode;
    case "emoji":
      return s.batchMode;
    default:
      // Single-mode tools: `effects`, `crop`, `arrow`.
      return undefined;
  }
}

/**
 * Activate a sub-tool: point the app at its legacy `(tool, mode)` pair, record
 * which sub-tool is lit, and apply the sub-tool's preselect if it has one.
 *
 * Imperative (getState) rather than a hook, so the rail, the router and the
 * command palette can all call the one function.
 */
export function activateSubTool(resolved: ResolvedSubTool): void {
  const { subTool, group, key } = resolved;
  // Coming Soon items carry no `tool`, so there is nothing to activate. Guard
  // rather than throw: a hand-typed route reaching here is untrusted input, and
  // the route layer already refuses these.
  if (subTool.comingSoon) return;

  const store = useToolStore.getState();
  const live: LiveSubTool = subTool;

  if (store.activeTool !== live.tool) store.setActiveTool(live.tool);
  if (live.mode !== undefined) setModeOf(live.tool, live.mode);

  // The lit tile. Set even when tool+mode didn't change — that is the whole
  // point for the six Edit sub-tools that share a tool.
  store.setActiveSubTool(key);

  // ── Preselects ────────────────────────────────────────────────────────────
  // Edit › Color Picker owns the toggle; every OTHER sub-tool of the same tool
  // must turn it back off, or picking Crop after Color Picker would leave the
  // canvas in eyedropper mode with no lit tile saying so.
  const wantsColorPicker = live.preselect?.colorPicker === true;
  if (store.colorPickerActive !== wantsColorPicker) {
    store.setColorPickerActive(wantsColorPicker);
  }

  // Create › Line preselects a shape KIND (AMBIGUOUS-2 in the migration map).
  // Not cleared for other sub-tools: unlike the color picker this is an
  // ordinary panel setting the user is free to change afterwards, and resetting
  // it on every activation would fight them.
  const shapeKind = live.preselect?.shapeKind;
  if (shapeKind && store.toolSettings.shape !== shapeKind) {
    store.setToolSettings({
      ...store.toolSettings,
      shape: shapeKind as NonNullable<ToolState["toolSettings"]["shape"]>,
    });
  }

  void group;
}

/** Activate a group's rail tile — its first live sub-tool. */
export function activateGroup(group: ToolGroupDefinition): void {
  const first = defaultSubToolOf(group);
  const resolved = ALL_SUB_TOOLS.find(
    (r) => r.group.id === group.id && r.subTool.id === first.id,
  );
  if (resolved) activateSubTool(resolved);
}

/**
 * REACTIVE read of the lit sub-tool.
 *
 * `activeSubTool` is authoritative when it still agrees with the live
 * `(tool, mode)` pair. It can fall out of agreement three ways, all of them
 * normal: a reload (the field isn't persisted), a legacy route or `TOOL_BY_KEY`
 * digit that sets the tool directly, or a panel's own mode toggle — notably
 * AISettings', whose four modes straddle Create and Enhance. In every one of
 * those cases the `(tool, mode)` pair is the truth and the key is stale, so we
 * re-derive.
 */
export function useActiveSubTool(): ResolvedSubTool | undefined {
  return useToolStore(
    useCallback((s: ToolState) => {
      const stored = subToolByKey(s.activeSubTool);
      const mode = modeOfTool(s);
      if (
        stored &&
        !stored.subTool.comingSoon &&
        stored.subTool.tool === s.activeTool &&
        (stored.subTool.mode === undefined || stored.subTool.mode === mode)
      ) {
        return stored;
      }
      return subToolForToolMode(s.activeTool, mode);
    }, []),
  );
}

/** REACTIVE read of the lit group — whichever owns the lit sub-tool. */
export function useActiveGroup(): ToolGroupDefinition | undefined {
  return useActiveSubTool()?.group;
}
