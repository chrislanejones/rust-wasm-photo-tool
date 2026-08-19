import { useEffect, useState } from "react";
import { useGalleryStore } from "@/stores/useGalleryStore";
import { getOriginalDimensions } from "@/lib/dexie/originalsAdapter";

/**
 * The active photo's dimensions **as uploaded** — the number the status bar
 * shows as "Original".
 *
 * WHY THIS IS NOT `entry.origWidth`: that field is not the upload size despite
 * the name. `persistActiveCanvas` rewrites `origWidth`/`origHeight` to the
 * dimensions it just saved, so after one Apply Resize it reports the resized
 * size and the original number is gone. `originalByteSize` is genuinely
 * immutable and `uploadKey` is documented as "immutable key of the upload
 * original — never replaced by Apply Compression or Auto Compress"; the
 * dimensions live on that stored record, so they are read from there.
 *
 * Deliberately NOT a new field on `PhotoEntry`: the gallery is persisted, so a
 * new field is a storage change and goes through the dexie-migration procedure.
 * Deriving it from a key that already exists needs no migration at all.
 *
 * The gallery itself is read from the Zustand store rather than passed in, so
 * the status bar does not gain two more props from AppShell.
 */
export function useUploadDimensions(): { width: number; height: number } | null {
  const activePhotoId = useGalleryStore((s) => s.activePhotoId);
  const photos = useGalleryStore((s) => s.photos);
  const [dims, setDims] = useState<{ width: number; height: number } | null>(null);

  const entry = photos.find((p) => p.id === activePhotoId) ?? null;
  // The upload baseline, or the current original for gallery entries old enough
  // to predate `uploadKey`. Those report the current stored size — still the
  // best available answer, and better than showing nothing.
  const key = entry?.uploadKey ?? entry?.originalKey ?? null;

  useEffect(() => {
    if (!key) {
      setDims(null);
      return;
    }
    let cancelled = false;
    void getOriginalDimensions(key).then((d) => {
      if (!cancelled) setDims(d);
    });
    return () => {
      cancelled = true;
    };
  }, [key]);

  return dims;
}
