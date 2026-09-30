// Per-photo UI state that must not outlive its photo. When the active photo
// changes, anything that describes the OUTGOING photo's document — and would
// act on the incoming one with the old one's coordinates — is dropped.
//
// Found by classifying every panel control (skeleton plan §1) and reproduced in
// e2e/photo-switch-leftovers.spec.ts: a crop box drawn on a 256×256 photo sat on
// a 1200×800 one with Apply Crop still armed, and a selection made on one photo
// kept Deselect / Delete armed on the next.
//
// Per-TOOL settings (brush size, ratio, tolerance…) are deliberately untouched:
// your brush shouldn't change because the photo did.
import { useEffect, useRef } from "react";
import { useToolStore } from "@/stores/useToolStore";

export function usePhotoSwitchReset(
  activePhotoId: string | null,
  clearCropSelection: () => void,
): void {
  // A ref, not a dependency: the reset is about the photo changing, and
  // clearCropSelection is a fresh closure on every render.
  const clearCrop = useRef(clearCropSelection);
  clearCrop.current = clearCropSelection;
  useEffect(() => {
    clearCrop.current();
    useToolStore.setState({
      // The engine's selection belongs to the document it was made on; a load
      // starts the new document with none.
      selectionMask: null,
      selectionCoverage: null,
      // Mask-edit mode paints the ACTIVE layer's mask — the next photo's
      // layer is not the one you were editing.
      maskEditing: false,
      // Object-removal strokes are in the old photo's pixel space (they were
      // only dropped when the document SIZE changed). Same clears as Cancel.
      objectRemovalMasking: false,
      objectRemovalStrokes: [],
    });
  }, [activePhotoId]);
}
