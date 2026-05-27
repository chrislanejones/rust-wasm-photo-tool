// Grid thumbnails (active when the Images tool is selected). Renders only the
// 11 non-active thumbnail tiles around the hero. The hero (active photo's live
// canvas) is rendered by AppShell at a stable position in the React tree so
// the canvas DOM/WASM pixels survive tool switches.
import { useEffect, useMemo, useRef, useState } from "react";
import type { PhotoEntry } from "@/features/gallery/GalleryBar";

interface Props {
  photos: PhotoEntry[];
  activePhotoId: string | null;
  onSelectPhoto: (entry: PhotoEntry) => void;
}

// CSS-grid coordinates for the 11 thumbnail tiles (hero is grid-area 1/1/3/3,
// rendered separately by AppShell — not included here).
const TILE_AREAS: string[] = [
  "1 / 3 / 2 / 4",
  "1 / 4 / 2 / 5",
  "1 / 5 / 2 / 6",
  "2 / 3 / 3 / 4",
  "2 / 4 / 3 / 5",
  "2 / 5 / 3 / 6",
  "3 / 1 / 4 / 2",
  "3 / 2 / 4 / 3",
  "3 / 3 / 4 / 4",
  "3 / 4 / 4 / 5",
  "3 / 5 / 4 / 6",
];

/**
 * Maps each photo to a stable Object URL for its `thumbBlob`. URLs are tracked
 * per (photo.id, blob identity) in a ref so we don't churn URLs (and trigger
 * <img> re-fetches) when the photos array reference changes but the blob
 * itself didn't. URLs are only revoked when:
 *   • the photo is removed from the array, or
 *   • its `thumbBlob` is replaced with a new blob (e.g. after Apply Logo to All),
 *   • the hook unmounts.
 * This prevents the race where rapid `setPhotos` calls during a batch run
 * revoke a brand-new URL before the browser has fetched it.
 */
function useThumbUrls(photos: PhotoEntry[]): Record<string, string> {
  // ref maps photo.id → { blob, url } so we can detect blob swaps reliably.
  const cacheRef = useRef<Map<string, { blob: Blob; url: string }>>(new Map());
  const [urls, setUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    const cache = cacheRef.current;
    const seenIds = new Set<string>();
    const next: Record<string, string> = {};
    let changed = false;

    for (const p of photos) {
      seenIds.add(p.id);
      const cached = cache.get(p.id);
      if (cached && cached.blob === p.thumbBlob) {
        next[p.id] = cached.url;
      } else {
        // Either new photo or thumbBlob was replaced.
        if (cached) URL.revokeObjectURL(cached.url);
        const url = URL.createObjectURL(p.thumbBlob);
        cache.set(p.id, { blob: p.thumbBlob, url });
        next[p.id] = url;
        changed = true;
      }
    }

    // Drop URLs for photos that have been removed.
    for (const id of Array.from(cache.keys())) {
      if (!seenIds.has(id)) {
        const entry = cache.get(id)!;
        URL.revokeObjectURL(entry.url);
        cache.delete(id);
        changed = true;
      }
    }

    if (changed) setUrls(next);
  }, [photos]);

  // Final cleanup on unmount only — revoke everything left in the cache.
  useEffect(() => {
    const cache = cacheRef.current;
    return () => {
      for (const { url } of cache.values()) URL.revokeObjectURL(url);
      cache.clear();
    };
  }, []);

  return urls;
}

export function GridThumbnails({
  photos,
  activePhotoId,
  onSelectPhoto,
}: Props) {
  const thumbUrls = useThumbUrls(photos);

  // Intentional cap: the grid spec defines exactly 12 cells (1 hero + 11
  // thumbnails). Photos beyond that are surfaced via a "+N more" badge on
  // the final tile rather than being silently dropped.
  const others = useMemo(
    () => photos.filter((p) => p.id !== activePhotoId).slice(0, 11),
    [photos, activePhotoId],
  );

  const overflowCount = Math.max(0, photos.length - 12);

  return (
    <>
      {TILE_AREAS.map((area, i) => {
        const p = others[i];
        const isLastTile = i === TILE_AREAS.length - 1;
        if (!p) {
          return (
            <div
              key={`empty-${i}`}
              style={{ gridArea: area }}
              className="overflow-hidden rounded-md border border-border bg-bg-secondary/40"
            />
          );
        }
        const url = thumbUrls[p.id];
        return (
          <div
            key={p.id}
            style={{ gridArea: area }}
            className="relative overflow-hidden rounded-md border border-border bg-zinc-950 hover:ring-2 hover:ring-orange-400"
          >
            <button
              type="button"
              onClick={() => onSelectPhoto(p)}
              className="flex h-full w-full items-center justify-center"
              title={p.name}
            >
              {url && (
                <img
                  src={url}
                  alt={p.name}
                  draggable={false}
                  className="max-h-full max-w-full object-contain"
                />
              )}
            </button>
            {isLastTile && overflowCount > 0 && (
              <span className="absolute bottom-1 right-1 rounded bg-zinc-900/80 px-1.5 py-0.5 text-[10px] text-zinc-100">
                +{overflowCount} more
              </span>
            )}
          </div>
        );
      })}
    </>
  );
}
