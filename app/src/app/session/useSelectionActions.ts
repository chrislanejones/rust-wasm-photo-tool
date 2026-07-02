// Selection-marker (magic-wand) + Move/Selection toggle handlers, extracted
// verbatim from AppShell (stage 2). All masking math is Rust; JS just stores the
// returned overlay + routes ops. Tool state is read straight from useToolStore;
// the WASM `stamp` handle and the canvas ref are passed in.
import { useCallback } from "react";
import type { RefObject, MouseEvent as ReactMouseEvent } from "react";
import type { useCloneStamp } from "@/hooks/useCloneStamp";
import { useToolStore } from "@/stores/useToolStore";

export function useSelectionActions(
  stamp: ReturnType<typeof useCloneStamp>,
  canvasRef: RefObject<HTMLCanvasElement | null>,
) {
  const selectionTolerance = useToolStore((s) => s.selectionTolerance);
  const setSelectionMask = useToolStore((s) => s.setSelectionMask);
  const setSelectionMode = useToolStore((s) => s.setSelectionMode);
  const setMoveActive = useToolStore((s) => s.setMoveActive);
  const setActiveTool = useToolStore((s) => s.setActiveTool);

  const getCoords = useCallback((e: ReactMouseEvent<HTMLCanvasElement>) => {
    const c = canvasRef.current;
    if (!c) return { x: 0, y: 0 };
    const r = c.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) * c.width) / r.width,
      y: ((e.clientY - r.top) * c.height) / r.height,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelectionClick = useCallback(
    (e: ReactMouseEvent<HTMLCanvasElement>) => {
      const tool = stamp.toolRef.current;
      if (!tool) return;
      const { x, y } = getCoords(e);
      const mask = tool.magic_wand_select(x, y, selectionTolerance);
      setSelectionMask(mask.length ? mask : null);
    },
    [stamp, getCoords, selectionTolerance],
  );
  const handleSelectAll = useCallback(() => {
    const tool = stamp.toolRef.current;
    if (!tool) return;
    const mask = tool.select_all();
    setSelectionMask(mask.length ? mask : null);
  }, [stamp]);
  const handleDeselect = useCallback(() => {
    stamp.toolRef.current?.clear_selection();
    setSelectionMask(null);
  }, [stamp]);
  const handleDeleteSelection = useCallback(() => {
    const tool = stamp.toolRef.current;
    if (tool?.delete_selection()) {
      stamp.flushToCanvas();
      stamp.syncState();
    }
    setSelectionMask(null);
  }, [stamp]);
  // Move-layer toggle (Layer Settings + Ctrl+M). Switches to the Layer Settings
  // tool and is mutually exclusive with the Selection marker.
  const handleToggleMove = useCallback(() => {
    setActiveTool("arrow");
    setSelectionMode(false);
    setMoveActive((m) => !m);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Selection toggle — mutually exclusive with Move.
  const handleToggleSelectionMode = useCallback(() => {
    setMoveActive(false);
    setSelectionMode((m) => !m);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    getCoords,
    handleSelectionClick,
    handleSelectAll,
    handleDeselect,
    handleDeleteSelection,
    handleToggleMove,
    handleToggleSelectionMode,
  };
}
