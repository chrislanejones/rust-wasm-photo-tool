// The returning-session "Welcome back" content, shown full-page inside
// FirstRunScreen on cold start (so it gets the same logo-eases-up entrance as
// the New surface). Compact: two thumbnails + a "+N" tile (no info paragraph),
// then Resume / Start fresh. There's no close — you must pick one.
import { useEffect, useState } from "react";
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
  // Object URLs for the first two thumbnails, CREATED AND REVOKED IN THE SAME
  // EFFECT so the two can never come apart.
  //
  // They used to be built in a `useMemo` and revoked in an effect cleanup, and
  // under StrictMode that is guaranteed to break: React mounts the effect,
  // unmounts it, and mounts it again, so the cleanup revokes the URLs — while
  // the memo does NOT re-run, because `photos` never changed. The <img> tags
  // are then pointing at revoked URLs and every thumbnail renders as a broken
  // image icon, with `net::ERR_FILE_NOT_FOUND` for a blob: URL in the console.
  // A memo is a cache, not a lifecycle; anything needing cleanup belongs to an
  // effect at both ends. `GridThumbnails.tsx` already does it this way.
  const [thumbUrls, setThumbUrls] = useState<string[]>([]);
  useEffect(() => {
    const urls = photos.slice(0, 2).map((p) => URL.createObjectURL(p.thumbBlob));
    setThumbUrls(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [photos]);

  // Counted from `photos`, NOT from `thumbUrls` — the URLs are empty on the
  // first render now, and "+N" must not flash the wrong number while they fill.
  const more = photos.length - Math.min(2, photos.length);

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
