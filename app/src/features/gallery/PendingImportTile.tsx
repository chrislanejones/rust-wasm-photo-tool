// A file an import has accepted but not decoded yet: a skeleton tile in the
// gallery, at exactly a thumbnail's box. It waits out the same 300 ms grace as
// a thumbnail (THUMB_SKELETON_DELAY_MS), so a quick import shows only photos.
import { Skeleton } from "@/components/ui/skeleton";
import { useDelayedFlag } from "@/hooks/usePhotoSwitching";
import { THUMB_SKELETON_DELAY_MS } from "./useThumbImage";

export function PendingImportTile({ name, vertical }: { name: string; vertical?: boolean }) {
  const show = useDelayedFlag(true, THUMB_SKELETON_DELAY_MS);
  return (
    <div
      data-testid="pending-import"
      title={`Opening ${name}`}
      className={`photo-thumb ${vertical ? "photo-thumb-grid" : ""} relative`}
      style={vertical ? { width: "100%", height: "auto" } : undefined}
    >
      <Skeleton variant="tile" decorative loading={show} className="w-full">
        <div className="w-full aspect-square" aria-hidden="true" />
      </Skeleton>
    </div>
  );
}
