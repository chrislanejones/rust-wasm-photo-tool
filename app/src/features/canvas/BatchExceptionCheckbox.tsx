// Batch — "Exception" for the photo on screen, in every Batch tool. The same
// mark as the gallery checkbox on its thumbnail (useGalleryStore.selectedIds),
// just closer to where you are looking: tick it and this photo moves to the
// Exceptions group. Mounted by BatchCropOverlay, which is always on the canvas.
import { useGalleryStore } from "@/stores/useGalleryStore";
import { useToolStore } from "@/stores/useToolStore";

export function BatchExceptionCheckbox() {
  const on = useToolStore((s) => s.activeTool === "emoji");
  const photoId = useGalleryStore((s) => s.activePhotoId);
  const ticked = useGalleryStore((s) => (photoId ? s.selectedIds.has(photoId) : false));
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
        checked={ticked}
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
      Exception
    </label>
  );
}
