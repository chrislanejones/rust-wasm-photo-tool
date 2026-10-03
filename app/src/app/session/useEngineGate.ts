// React side of lib/engineGate: the phone does not load the engine until the
// window is widened. See that file for the rule and why it latches.
import { useEffect, useSyncExternalStore } from "react";
import { engineWanted, subscribeEngineWanted } from "@/lib/engineGate";
import { useGalleryStore } from "@/stores/useGalleryStore";
import { TIERS, type UserMode } from "@/lib/tiers";
import { getPhotoLimit } from "@/lib/photoLimits";

/** The same answer as state, so a widened window re-renders its consumers. */
export function useEngineWanted(): boolean {
  return useSyncExternalStore(subscribeEngineWanted, engineWanted, () => true);
}

/** The gallery cap for the current tier. Set from lib/tiers.ts at once — no
 *  engine needed, which is what lets a phone have it — and, once the engine is
 *  wanted, confirmed from Rust (`photo_limit`), which stays the source of truth
 *  (tiers.ts documents that the two must agree). */
export function usePhotoLimit(mode: UserMode): void {
  const setMaxPhotos = useGalleryStore((s) => s.setMaxPhotos);
  const editing = useEngineWanted();
  useEffect(() => {
    setMaxPhotos(TIERS[mode].galleryLimit);
    if (!editing) return;
    let alive = true;
    void getPhotoLimit(mode).then((n) => {
      if (alive) setMaxPhotos(n);
    });
    return () => {
      alive = false;
    };
  }, [mode, editing, setMaxPhotos]);
}
