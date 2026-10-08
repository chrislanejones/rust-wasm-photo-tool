import { useUIStore } from "@/stores/useUIStore";
import { useDelayedFlag } from "@/hooks/usePhotoSwitching";

/** Decode/restore has no measured percentage. A delayed, static track also
 * respects reduced motion without adding animation to the editing path. */
export function ImageLoadingBar() {
  const loading = useDelayedFlag(useUIStore((s) => s.isImageLoading));
  if (!loading) return null;
  return <div role="progressbar" aria-label="Loading image" className="fixed top-0 left-0 right-0 z-[var(--z-progress)] h-1 bg-accent/60" />;
}
