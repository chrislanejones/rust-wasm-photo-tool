// Skeleton plan §2.4 — "Switched to IMG_2041.jpg" for screen readers, in a
// polite live region. Sighted users already have the photo line's highlight,
// the gallery ring and the new pixels; this is the same cue without sight.
//
// Announced when the switch has FINISHED (documentPhotoId, set after the load),
// not when it was asked for: saying "switched" while the old photo is still in
// the engine would be the exact mismatch the plan is about.
import { useEffect, useRef, useState } from "react";
import { useGalleryStore } from "@/stores/useGalleryStore";

export function PhotoSwitchAnnouncer() {
  const documentPhotoId = useGalleryStore((s) => s.documentPhotoId);
  const photos = useGalleryStore((s) => s.photos);
  const [message, setMessage] = useState("");
  const previous = useRef<string | null>(null);
  useEffect(() => {
    const was = previous.current;
    previous.current = documentPhotoId;
    // The first photo opening is not a switch; it has its own load cue.
    if (!documentPhotoId || !was || was === documentPhotoId) return;
    const name = photos.find((p) => p.id === documentPhotoId)?.name;
    if (name) setMessage(`Switched to ${name}`);
    // `photos` deliberately not a dependency: a rename must not re-announce.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentPhotoId]);
  return (
    <span className="sr-only" role="status" aria-live="polite">
      {message}
    </span>
  );
}
