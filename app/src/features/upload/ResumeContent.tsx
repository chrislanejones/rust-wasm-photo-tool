// The returning-session "Welcome back" content, shown full-page inside
// FirstRunScreen on cold start (so it gets the same logo-eases-up entrance as
// the New surface). Compact: two thumbnails + a "+N" tile (no info paragraph),
// then Resume / Start fresh. There's no close — you must pick one.
import { useEffect, useMemo } from "react";
import { Upload } from "lucide-react";
import type { PhotoEntry } from "@/features/gallery/GalleryBar";
import { MediaTile } from "@/components/MediaTile";

export function ResumeContent({
  photos,
  onResume,
  onStartFresh,
}: {
  photos: PhotoEntry[];
  onResume: () => void;
  onStartFresh: () => void;
}) {
  // Object URLs for the first two thumbnails; revoked on unmount / change.
  const thumbUrls = useMemo(
    () => photos.slice(0, 2).map((p) => URL.createObjectURL(p.thumbBlob)),
    [photos],
  );
  useEffect(
    () => () => thumbUrls.forEach((u) => URL.revokeObjectURL(u)),
    [thumbUrls],
  );

  const more = photos.length - thumbUrls.length;

  return (
    <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-border bg-bg-secondary shadow-2xl">
      <div className="flex flex-col items-center gap-4 px-6 py-6">
        <h2 className="text-base font-semibold text-text-primary">Welcome back</h2>

        <div className="flex items-center justify-center gap-3">
          {thumbUrls.map((u, i) => (
            <MediaTile key={i} src={u} />
          ))}
          {more > 0 && <MediaTile count={more} />}
        </div>

        <div className="flex w-full gap-2 pt-1">
          <button
            type="button"
            onClick={onResume}
            className="flex-1 rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-[var(--accent-foreground)] transition hover:brightness-110"
          >
            Resume editing
          </button>
          <button
            type="button"
            onClick={onStartFresh}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border bg-bg-elevated px-4 py-2.5 text-sm font-medium text-text-secondary transition-colors hover:bg-bg-elevated/70"
          >
            <Upload className="h-3.5 w-3.5" />
            Start fresh
          </button>
        </div>
      </div>
    </div>
  );
}
