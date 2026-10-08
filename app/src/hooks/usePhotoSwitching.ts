// "Is a photo switch in flight?" and the 300 ms rule for showing it.
//
// A switch starts when you ask for a photo (`activePhotoId` moves at once) and
// ends when its pixels are in the engine (`documentPhotoId` moves after the
// load — useEngineCore bumps it). Between the two, anything that reads or edits
// the photo would be reading or editing the previous one.
import { useEffect, useState } from "react";
import { useUIStore } from "@/stores/useUIStore";
import { useGalleryStore } from "@/stores/useGalleryStore";

/** Read at the action boundary: a callback may outlive the render that created it. */
export function isPhotoSwitching(): boolean {
  const { activePhotoId, documentPhotoId } = useGalleryStore.getState();
  return useUIStore.getState().isImageLoading ||
    (activePhotoId !== null && documentPhotoId !== activePhotoId);
}

export function usePhotoSwitching(): boolean {
  const loading = useUIStore((s) => s.isImageLoading);
  const mismatch = useGalleryStore(
    (s) => s.activePhotoId !== null && s.documentPhotoId !== s.activePhotoId,
  );
  return loading || mismatch;
}

/** `active`, but only once it has stayed true for `delayMs`. Fast loads show
 *  nothing — a skeleton that flashes for 80 ms is worse than none. */
export function useDelayedFlag(active: boolean, delayMs = 300): boolean {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!active) {
      setShown(false);
      return;
    }
    const t = window.setTimeout(() => setShown(true), delayMs);
    return () => window.clearTimeout(t);
  }, [active, delayMs]);
  return active && shown;
}
