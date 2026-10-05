// Batch — "Exception" on a photo in the canvas grid, in every Batch tool. The
// same mark as the gallery checkbox on its thumbnail (useGalleryStore.selectedIds),
// just where you are looking: tick it and that photo moves to the Exceptions
// group. The hero (the open photo) gets one from BatchCropOverlay; every other
// grid tile gets one from GridThumbnails.
import { useGalleryStore } from "@/stores/useGalleryStore";
import { useToolStore } from "@/stores/useToolStore";

export function BatchExceptionCheckbox({
  photoId: forPhoto,
  name,
}: {
  /** The photo it marks. Omitted = the open photo. */
  photoId?: string;
  /** The photo's name, so each tile's checkbox has its own accessible name. */
  name?: string;
} = {}) {
  const on = useToolStore((s) => s.activeTool === "emoji");
  const activeId = useGalleryStore((s) => s.activePhotoId);
  const photoId = forPhoto ?? activeId;
  const ticked = useGalleryStore((s) => (photoId ? s.selectedIds.has(photoId) : false));
  const setSelectedIds = useGalleryStore((s) => s.setSelectedIds);
  if (!on || !photoId) return null;

  return (
    <label
      // Bottom-left of its tile (top-left carries the grid's badge), outside the pan/zoom transform, so it
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
        aria-label={name ? `Exception: ${name}` : undefined}
        className="h-4 w-4 cursor-pointer accent-theme-primary"
      />
      Exception
    </label>
  );
}
