// Settings › Current Image. It was the Alt+Delete Diagnostics window until
// 10-14-2026; the window's other tabs were removed (Resources), moved to the
// browser console (System Telemetry) or moved to Settings (Feature Flags).
// Reads when shown; nothing polls.
import { ImageMetaPanel, type ImageMeta } from "@/components/ImageMetaPanel";
import { useLoadedDocument } from "@/hooks/useLoadedDocument";
import { PerPhotoRegion } from "@/features/tools/PerPhotoRegion";

export function CurrentImagePane({ active, imageMeta }: { active: boolean; imageMeta?: ImageMeta }) {
  const documentMeta = useLoadedDocument(imageMeta);
  return (
    <PerPhotoRegion>
      <ImageMetaPanel
        key={`${documentMeta?.photoId}:${documentMeta?.undoCount}:${documentMeta?.redoCount}:${documentMeta?.currentWidth}x${documentMeta?.currentHeight}`}
        active={active && !!documentMeta}
        meta={documentMeta ?? { photoId: imageMeta?.photoId ?? null, name: imageMeta?.name }}
      />
    </PerPhotoRegion>
  );
}
