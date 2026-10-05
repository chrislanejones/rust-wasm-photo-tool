// Batch › Bulk — "Odd one out" for the photo on screen. The same mark as the
// gallery checkbox on its thumbnail (useGalleryStore.selectedIds), just closer
// to where you are looking: tick it and this photo gets the Odd ones crop
// instead of the bulk's. Mounted beside the preview frame by BatchCropOverlay.
import { useGalleryStore } from "@/stores/useGalleryStore";
import { useToolStore } from "@/stores/useToolStore";

export function BulkOddCheckbox() {
  const on = useToolStore((s) => s.activeTool === "emoji" && s.batchMode === "crop");
  const photoId = useGalleryStore((s) => s.activePhotoId);
  const odd = useGalleryStore((s) => (photoId ? s.selectedIds.has(photoId) : false));
  const setSelectedIds = useGalleryStore((s) => s.setSelectedIds);
  if (!on || !photoId) return null;

  return (
    <label
      // Bottom-left of the canvas viewport (top-left carries the grid's badge), outside the pan/zoom transform, so it
      // stays put and never lands on the crop frame's handles.
      // One above the frame's own inline zIndex (24, BatchCropOverlay), so
      // the photo's draw area under it cannot swallow the click.
      style={{ zIndex: 25 }}
      className="absolute bottom-3 left-3 flex cursor-pointer items-center gap-2 rounded-md bg-black/70 px-2 py-1.5 text-xs font-semibold text-on-photo"
    >
      <input
        type="checkbox"
        checked={odd}
        onChange={(e) => {
          const tick = e.target.checked;
          setSelectedIds((prev) => {
            const next = new Set(prev);
            if (tick) next.add(photoId);
            else next.delete(photoId);
            return next;
          });
        }}
        className="h-4 w-4 cursor-pointer accent-theme-primary"
      />
      Odd one out
    </label>
  );
}
