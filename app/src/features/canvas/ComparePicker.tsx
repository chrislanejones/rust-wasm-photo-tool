// "Compare ▾ → With another photo…" (Night 10-23): pick photo A, the older
// screenshot, to compare the open photo with. The gallery's right-click
// "Compare with this" skips this dialog.
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useGalleryStore } from "@/stores/useGalleryStore";
import { useScreenshotCompareStore } from "@/stores/useScreenshotCompareStore";
import { useThumbImage } from "@/features/gallery/useThumbImage";
import type { PhotoEntry } from "@/features/gallery/GalleryBar";

function PickerTile({ entry, onPick }: { entry: PhotoEntry; onPick: () => void }) {
  const thumb = useThumbImage(entry.thumbBlob);
  return (
    <li>
      <Button variant="ghost" onClick={onPick} className="h-auto w-full flex-col gap-1 p-1.5 text-xs">
        <span className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-sm bg-theme-muted">
          {thumb.src && <img src={thumb.src} alt="" className="max-h-full max-w-full object-contain" />}
        </span>
        <span className="w-full truncate">{entry.name}</span>
      </Button>
    </li>
  );
}

export function ComparePicker() {
  const open = useScreenshotCompareStore((s) => s.pickerOpen);
  const setOpen = useScreenshotCompareStore((s) => s.setPickerOpen);
  const start = useScreenshotCompareStore((s) => s.start);
  const photos = useGalleryStore((s) => s.photos);
  const activeId = useGalleryStore((s) => s.activePhotoId);
  const others = photos.filter((p) => p.id !== activeId);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Compare with another photo</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <DialogDescription>
            Pick the older screenshot. Every pixel that changed shows tinted on the open photo.
          </DialogDescription>
          {others.length ? (
            <ul className="mt-3 grid max-h-[50vh] grid-cols-3 gap-2 overflow-y-auto" aria-label="Photos">
              {others.map((p) => (
                <PickerTile key={p.id} entry={p} onPick={() => start(p.id)} />
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-theme-muted-foreground">Add a second photo to the gallery to compare.</p>
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
