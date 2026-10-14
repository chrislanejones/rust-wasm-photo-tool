// The returning-session "Welcome back" content, shown full-page inside
// FirstRunScreen on cold start (so it gets the same logo-eases-up entrance as
// the New surface). Compact: two thumbnails + a "+N" tile (no info paragraph),
// then Resume / Start fresh. There's no close — you must pick one.
import { Upload } from "lucide-react";
import type { PhotoEntry } from "@/features/gallery/GalleryBar";
import { MediaTile } from "@/components/MediaTile";
import { Button } from "@/components/ui/button";

export function ResumeContent({
  photos,
  onResume,
  onStartFresh,
}: {
  photos: PhotoEntry[];
  onResume: () => void;
  onStartFresh: () => void;
}) {
  // Render from photo identity immediately; URL creation must not add tiles.
  const more = photos.length - Math.min(2, photos.length);

  return (
    <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-border bg-bg-secondary shadow-2xl">
      <div className="flex flex-col items-center gap-4 px-6 py-6">
        <h2 className="text-base font-semibold text-text-primary">Welcome back</h2>

        <div className="flex items-center justify-center gap-3">
          {photos.slice(0, 2).map((photo) => (
            <MediaTile key={photo.id} thumbBlob={photo.thumbBlob} alt={photo.name} />
          ))}
          {more > 0 && <MediaTile count={more} />}
        </div>

        <div className="flex w-full gap-2 pt-1">
          {/* The one filled-accent action on this screen. `theme-primary` is
              the same value as the `--accent` it used to name raw. */}
          <Button
            size="large"
            onClick={onResume}
            className="flex-1 border-transparent bg-theme-primary text-sm text-theme-primary-foreground hover:border-transparent"
          >
            Resume editing
          </Button>
          <Button size="large" onClick={onStartFresh} className="flex-1 gap-1.5 text-sm text-text-secondary">
            <Upload className="h-3.5 w-3.5" />
            Start fresh
          </Button>
        </div>
      </div>
    </div>
  );
}
