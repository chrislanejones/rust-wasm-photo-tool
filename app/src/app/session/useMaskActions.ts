// Layer-mask edit-mode handlers, extracted verbatim from AppShell (stage 2).
// Entering mask edit selects the layer + switches to the Paint brush so strokes
// hit the mask instead of pixels. Tool state is read straight from useToolStore;
// only the WASM `stamp` handle is passed in.
import { useCallback } from "react";
import type { useCloneStamp } from "@/hooks/useCloneStamp";
import { useToolStore } from "@/stores/useToolStore";

export function useMaskActions(stamp: ReturnType<typeof useCloneStamp>) {
  const setActiveTool = useToolStore((s) => s.setActiveTool);
  const setBrushMode = useToolStore((s) => s.setBrushMode);
  const maskEditing = useToolStore((s) => s.maskEditing);
  const setMaskEditing = useToolStore((s) => s.setMaskEditing);

  const handleAddMask = useCallback(
    (id: number) => {
      stamp.setActiveLayer(id);
      stamp.addLayerMask(id);
      setActiveTool("brush");
      setBrushMode("paint");
      setMaskEditing(true);
    },
    [stamp],
  );
  const handleToggleMaskEdit = useCallback(
    (id: number) => {
      const activeId = stamp.toolRef.current?.active_layer_id();
      if (maskEditing && activeId === id) {
        setMaskEditing(false);
        return;
      }
      stamp.setActiveLayer(id);
      setActiveTool("brush");
      setBrushMode("paint");
      setMaskEditing(true);
    },
    [stamp, maskEditing],
  );

  return { handleAddMask, handleToggleMaskEdit };
}
