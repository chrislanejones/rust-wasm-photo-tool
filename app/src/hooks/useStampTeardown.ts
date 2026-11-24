import { useEffect, useRef } from "react";
import type { ToolType } from "@/lib/types";
import type { StampSubMode } from "@/stores/useToolStore";

/**
 * Stamp-tool state teardown. The Stamp tool keeps two pieces of "armed
 * stamp" state that used to survive leaving it — so re-entering (or switching
 * sub-mode) kept stamping the last-selected stamp:
 *   • clone source   — engine set_source + useCloneStamp.sourcePosRef
 *   • selected emoji — useToolStore.toolSettings.emoji
 *
 * (A third, the pending red stamp, left with v17: Stamps are a Text mode now,
 * and a text mode has no armed state to leak — ADR-109.)
 *
 * This hook watches the (activeTool, stampSubMode) pair and fires both clear
 * callbacks on EITHER exit: deactivating the Stamp tool or switching between
 * its Clone/Emoji sub-modes. Re-entering always starts clean. Stamping
 * behavior WITHIN a mode is untouched.
 */
export function useStampTeardown({
  activeTool,
  stampSubMode,
  clearCloneSource,
  clearEmoji,
}: {
  activeTool: ToolType;
  stampSubMode: StampSubMode;
  clearCloneSource: () => void;
  clearEmoji: () => void;
}) {
  // Callbacks ride in refs so an unstable identity (e.g. an inline clearEmoji
  // arrow in AppShell) can't re-fire the transition effect on every render.
  const clearsRef = useRef({ clearCloneSource, clearEmoji });
  clearsRef.current = { clearCloneSource, clearEmoji };

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
    clears.clearEmoji();
  }, [activeTool, stampSubMode]);
}
