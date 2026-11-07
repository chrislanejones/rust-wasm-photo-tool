// "Compare with another photo…" (11-07-2026): picking photo A in Batch rather
// than in a dialog. The top bar's button opens Batch, every tile there picks
// instead of opening, and the pick goes back to the tool you were on, where
// the Compare bar takes over. Esc, or leaving Batch, cancels. The gallery's
// right-click "Compare with this" still starts a compare directly.
//
// Imperative (getState), like activateGroup, so the top bar and Batch's grid
// share one path without a prop through AppShell.
import { useScreenshotCompareStore } from "@/stores/useScreenshotCompareStore";
import { useToolStore } from "@/stores/useToolStore";
import { groupById } from "@/features/tools/toolGroups";
import { activateGroup } from "@/features/tools/activateSubTool";

/** Open Batch to pick photo A. Already in Batch: stay there after the pick. */
export function beginComparePick(): void {
  const tools = useToolStore.getState();
  const inBatch = tools.activeTool === "emoji";
  useScreenshotCompareStore
    .getState()
    .beginPick(inBatch ? null : { tool: tools.activeTool, subTool: tools.activeSubTool });
  if (!inBatch) {
    const batch = groupById("batch");
    if (batch) activateGroup(batch);
  }
}

/** End the pick: compare with `otherId`, or cancel with null. Either way,
 *  back to the tool the pick began on. */
export function finishComparePick(otherId: string | null): void {
  const cmp = useScreenshotCompareStore.getState();
  const back = cmp.pickReturn;
  if (otherId) cmp.start(otherId);
  else cmp.cancelPick();
  if (back) {
    const tools = useToolStore.getState();
    tools.setActiveTool(back.tool);
    tools.setActiveSubTool(back.subTool);
  }
}
