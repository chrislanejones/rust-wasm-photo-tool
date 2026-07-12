import { useEffect, useRef } from "react";
import type { ToolType } from "@/lib/types";
import type { StampSubMode } from "@/stores/useToolStore";

/**
 * Stamp-tool state teardown. The Stamp tool keeps three pieces of "armed
 * stamp" state that used to survive leaving it — so re-entering (or switching
 * sub-mode) kept stamping the last-selected stamp:
 *   • clone source      — engine set_source + useCloneStamp.sourcePosRef
 *   • pending red stamp — useRedStampTool.pendingStamp (the worst offender:
 *     useEffectiveTool routes stamp-tool clicks to the red stamp whenever one
 *     is pending, even in Clone sub-mode)
 *   • selected emoji    — useToolStore.toolSettings.emoji
 *
 * This hook watches the (activeTool, stampSubMode) pair and fires all three
 * clear callbacks on EITHER exit: deactivating the Stamp tool or switching
 * between its Clone/Stamps/Emojis sub-modes. Re-entering always starts clean.
 * Stamping behavior WITHIN a mode is untouched.
 */
export function useStampTeardown({
  activeTool,
  stampSubMode,
  clearCloneSource,
  clearPendingStamp,
  clearEmoji,
}: {
  activeTool: ToolType;
  stampSubMode: StampSubMode;
  clearCloneSource: () => void;
  clearPendingStamp: () => void;
  clearEmoji: () => void;
}) {
  // Callbacks ride in refs so an unstable identity (e.g. an inline clearEmoji
  // arrow in AppShell) can't re-fire the transition effect on every render.
  const clearsRef = useRef({ clearCloneSource, clearPendingStamp, clearEmoji });
  clearsRef.current = { clearCloneSource, clearPendingStamp, clearEmoji };

  const prevRef = useRef({ tool: activeTool, mode: stampSubMode });
  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = { tool: activeTool, mode: stampSubMode };

    const leftTool = prev.tool === "stamp" && activeTool !== "stamp";
    const switchedSubMode =
      prev.tool === "stamp" &&
      activeTool === "stamp" &&
      prev.mode !== stampSubMode;
    if (!leftTool && !switchedSubMode) return;

    const clears = clearsRef.current;
    clears.clearCloneSource();
    clears.clearPendingStamp();
    clears.clearEmoji();
  }, [activeTool, stampSubMode]);
}
