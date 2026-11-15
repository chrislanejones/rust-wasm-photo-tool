// The stored-file facts (EXIF date, upload name, file date) for every photo a
// rename panel is naming — read only while the pattern actually uses `{date}`
// or `{original}`, because reading them means pulling each stored file out of
// IndexedDB once. Shared by Batch › Rename and Batch › AI Rename.
import { useEffect, useState } from "react";
import { loadNameFacts, type NameFacts } from "@/lib/photoNameFacts";
import type { PhotoEntry } from "@/features/gallery/GalleryBar";

/** photo id → its facts, and whether a read is still running. While `loading`
 *  is true a panel should not apply names, or a photo whose date is still
 *  being read would be named from today's date. */
export function usePhotoNameFacts(
  photos: readonly PhotoEntry[],
  needed: boolean,
): { facts: ReadonlyMap<string, NameFacts>; loading: boolean } {
  const [facts, setFacts] = useState<ReadonlyMap<string, NameFacts>>(new Map());
  const missing = needed ? photos.filter((p) => !facts.has(p.id)) : [];
  const [loading, setLoading] = useState(false);
  // A stable key for "which photos still need reading", so a re-render with the
  // same gallery does not restart the read.
  const missingKey = missing.map((p) => p.id).join("|");

  useEffect(() => {
    if (!missingKey) {
      setLoading(false);
      return;
    }
    let alive = true;
    setLoading(true);
    const todo = photos.filter((p) => missingKey.split("|").includes(p.id));
    void (async () => {
      const next: [string, NameFacts][] = [];
      // One at a time: each read holds a whole stored file in memory.
      for (const p of todo) {
        if (!alive) return;
        next.push([p.id, await loadNameFacts(p)]);
      }
      if (!alive) return;
      setFacts((prev) => new Map([...prev, ...next]));
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
    // `photos` is read through `missingKey`; listing it would restart the read
    // on every render that hands in a new array with the same photos.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [missingKey]);

  return { facts, loading: needed && (loading || missing.length > 0) };
}
