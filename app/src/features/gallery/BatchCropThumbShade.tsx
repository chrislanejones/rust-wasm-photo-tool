// Batch › Crop — the "shadow" on the OTHER photos' gallery thumbnails: the part
// Enter / "Crop All" will cut off, shaded, with no frame or handles (those are
// only on the photo being edited, BatchCropOverlay). It reads the stored frame,
// which the preview writes on mouse-up, so the shadows move when you let go —
// not on every pointer move.
//
// The SVG's viewBox is the photo's own size and `preserveAspectRatio` does the
// same fit the <img> does (`contain` in the strip, `cover` in the vertical
// grid — see `.photo-thumb img` in styles.css), so the shade lands on the
// image's pixels without measuring anything.
import {
  anchoredCropRect,
  framedCropRect,
} from "@/lib/batchCrop";
import { useBatchCropStore, cropRatioOf, framingFor } from "@/stores/useBatchCropStore";
import { useToolStore } from "@/stores/useToolStore";
import type { PhotoEntry } from "./GalleryBar";

// Same black as the preview's shade, a touch lighter so a tiny tile still reads.
const SHADE = "rgba(0,0,0,0.6)";

export function BatchCropThumbShade({
  entry,
  isActive,
  cover,
}: {
  entry: PhotoEntry;
  isActive: boolean;
  /** The tile crops its image (vertical grid) rather than letterboxing it. */
  cover: boolean;
}) {
  const on = useToolStore((s) => s.activeTool === "emoji" && s.batchMode === "crop");
  const ratioW = useBatchCropStore((s) => cropRatioOf(s)[0]);
  const ratioH = useBatchCropStore((s) => cropRatioOf(s)[1]);
  const anchor = useBatchCropStore((s) => s.anchor);
  const framing = useBatchCropStore((s) => framingFor(s, entry.id));
  // Already batch-cropped: its stored original IS the crop — nothing to shade.
  const cropped = useBatchCropStore((s) => {
    const base = s.baselines[entry.id];
    return base !== undefined && base !== entry.originalKey;
  });

  const w = entry.workingWidth || entry.origWidth;
  const h = entry.workingHeight || entry.origHeight;
  if (!on || isActive || cropped || !w || !h) return null;

  const r = framing
    ? framedCropRect(w, h, ratioW, ratioH, framing)
    : anchoredCropRect(w, h, ratioW, ratioH, anchor);
  if (r.width >= w && r.height >= h) return null;

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio={cover ? "xMidYMid slice" : "xMidYMid meet"}
      className="pointer-events-none absolute inset-0 z-[5] h-full w-full"
      data-testid="batch-crop-thumb-shade"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        fill={SHADE}
        d={`M0 0h${w}v${h}h${-w}Z M${r.x} ${r.y}h${r.width}v${r.height}h${-r.width}Z`}
      />
    </svg>
  );
}
