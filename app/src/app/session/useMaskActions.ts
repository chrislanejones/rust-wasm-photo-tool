// Layer-mask edit-mode handlers, extracted verbatim from AppShell (stage 2).
// Entering mask edit selects the layer and turns on `maskEditing` — the user
// STAYS on the Layers panel, whose Layer Mask section holds the mask brush
// (hide/reveal, size, feather). Canvas routing (useEffectiveTool) sends
// strokes to `mask_paint_*` while the flag is on. It used to switch the app
// to the Paint brush instead, which unmounted this panel and stranded the
// brush controls on Paint's — Chris, 09-24-2026: "don't go to brush, add a
// brush tool in it". Only the WASM `stamp` handle is passed in.
import { useCallback } from "react";
import type { useCloneStamp } from "@/hooks/useCloneStamp";
import { useToolStore } from "@/stores/useToolStore";

export function useMaskActions(stamp: ReturnType<typeof useCloneStamp>) {
  const maskEditing = useToolStore((s) => s.maskEditing);
  const setMaskEditing = useToolStore((s) => s.setMaskEditing);

  const handleAddMask = useCallback(
    (id: number) => {
      stamp.setActiveLayer(id);
      stamp.addLayerMask(id);
      setMaskEditing(true);
    },
    [stamp],
  );
  const handleToggleMaskEdit = useCallback(
    async (id: number) => {
      // AWAITED: the engine lives in a worker (ADR-024), so `active_layer_id()`
      // comes back as a Promise — the old synchronous `activeId === id` compared
      // a Promise to a number, was always false, and made this toggle a switch
      // that could only ever turn ON. (Latent since the worker move; first
      // reachable from here now that editing keeps this panel mounted.)
      if (maskEditing) {
        const activeId = await stamp.toolRef.current?.active_layer_id();
        if (activeId === id) {
          setMaskEditing(false);
          return;
        }
      }
      stamp.setActiveLayer(id);
      setMaskEditing(true);
    },
    [stamp, maskEditing],
  );

  return { handleAddMask, handleToggleMaskEdit };
}
