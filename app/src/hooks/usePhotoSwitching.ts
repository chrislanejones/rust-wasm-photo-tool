// "Is a photo switch in flight?" and the 300 ms rule for showing it.
//
// A switch starts when you ask for a photo (`activePhotoId` moves at once) and
// ends when its pixels are in the engine (`documentPhotoId` moves after the
// load — useEngineCore bumps it). Between the two, anything that reads or edits
// the photo would be reading or editing the previous one.
import { useEffect, useState } from "react";
import { useGalleryStore } from "@/stores/useGalleryStore";

export function usePhotoSwitching(): boolean {
  return useGalleryStore(
    (s) => s.activePhotoId !== null && s.documentPhotoId !== s.activePhotoId,
  );
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
