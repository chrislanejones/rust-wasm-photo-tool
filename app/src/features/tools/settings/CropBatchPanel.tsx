// Batch › Crop — crop every loaded photo to ONE aspect ratio (and, optionally,
// one pixel size) so a set of photos lines up as a carousel. Same two-pass
// shape as the Logo and Text panels in BatchSettings.tsx: every non-active
// photo is re-encoded and written back to IDB; the active photo goes through
// the live engine so the crop is a normal undo step.
//
// The FRAME: by default every photo is cropped at the anchor. Drag the frame
// on the preview (BatchCropOverlay) and that photo keeps your framing instead;
// click through the gallery to frame each slide before cropping them all.
import { useCallback, useEffect, useState } from "react";
import { Square, RectangleHorizontal, RectangleVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ToolButtonGroup } from "@/components/ui/tool-button-group";
import { SectionHeader } from "@/components/ui/section-header";
import { PlacementGrid } from "@/components/PlacementGrid";
import { ErrorNote, SuccessCallout } from "@/components/ui/status-note";
import { toast } from "@/components/ui/sonner";
import { getOriginal, putOriginal } from "@/lib/dexie/originalsAdapter";
import { deleteReplacedOriginal } from "@/lib/originalRefs";
import { registerExtraRootProvider } from "@/lib/extraRoots";
import {
  makeWorkingCopy,
  makeThumbnail,
  makeThumbnailFromPixels,
} from "@/lib/workingCopy";
import {
  BATCH_CROP_RATIOS,
  anchoredCropRect,
  batchCropOutputSize,
  cropRgba,
  framedCropRect,
  type BatchCropRatioId,
  type BatchCropWidth,
} from "@/lib/batchCrop";
import { useGalleryStore } from "@/stores/useGalleryStore";
import {
  useBatchCropStore,
  showsOriginalFraming,
  type BatchCropWidthId,
} from "@/stores/useBatchCropStore";
import type { PhotoEntry } from "@/features/gallery/GalleryBar";
import type { ImageHorseTool } from "stamp_tool";

const RATIO_OPTIONS = BATCH_CROP_RATIOS.map((r) => ({
  id: r.id,
  label: r.label,
  icon:
    r.dims[0] === r.dims[1]
      ? Square
      : r.dims[0] > r.dims[1]
        ? RectangleHorizontal
        : RectangleVertical,
}));

/** Output width. 1080 is the carousel standard (1080×1080, 1080×1350); "Keep"
 *  leaves each crop at its own resolution — same shape, sizes may differ. */
const WIDTH_OPTIONS: readonly { id: BatchCropWidthId; label: string }[] = [
  { id: "keep", label: "Keep" },
  { id: "1080", label: "1080px" },
  { id: "1440", label: "1440px" },
];
const widthOf = (id: BatchCropWidthId): BatchCropWidth => (id === "keep" ? null : Number(id));
const ratioDims = (id: BatchCropRatioId): [number, number] =>
  BATCH_CROP_RATIOS.find((r) => r.id === id)!.dims;

/** Rust `resize_with_filter` code for Lanczos3 — the Resize panel's best. */
const LANCZOS3 = 3;

interface CropBatchPanelProps {
  photos: PhotoEntry[];
  activePhotoId: string | null;
  setPhotos: React.Dispatch<React.SetStateAction<PhotoEntry[]>>;
  stampToolRef: React.MutableRefObject<ImageHorseTool | null>;
  flushToCanvas: () => void;
  syncState: () => void;
}

export function CropBatchPanel({
  photos,
  activePhotoId,
  setPhotos,
  stampToolRef,
  flushToCanvas,
  syncState,
}: CropBatchPanelProps) {
  const ratioId = useBatchCropStore((s) => s.ratioId);
  const setRatioId = useBatchCropStore((s) => s.setRatioId);
  const anchor = useBatchCropStore((s) => s.anchor);
  const setAnchor = useBatchCropStore((s) => s.setAnchor);
  const widthId = useBatchCropStore((s) => s.widthId);
  const setWidthId = useBatchCropStore((s) => s.setWidthId);
  const framing = useBatchCropStore((s) => s.framing);
  const clearFraming = useBatchCropStore((s) => s.clearFraming);
  const framedCount = photos.filter((p) => framing[p.id]).length;
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number }>({
    done: 0,
    total: 0,
  });
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [appliedCount, setAppliedCount] = useState<number | null>(null);

  // Per-photo pre-crop baseline key (same idea as the logo/text panels): every
  // "Apply" crops the ORIGINAL framing, so switching 1:1 → 4:5 and applying
  // again re-crops the whole photo instead of a square that's already lost
  // its sides. Held in useBatchCropStore so the preview frame can tell whether
  // the photo it sits on is still the original.
  //
  // The active photo can't be reset from a baseline — `load_image` only takes
  // pixels at the document's CURRENT size, and a crop changed that size. So we
  // remember how many undo steps our last crop pushed and the undo count it
  // left behind (`activeCrop`); if nothing has happened since, re-apply rewinds
  // those steps first. If the user has edited since, we crop what they see.
  const baselineKeys = () => Object.values(useBatchCropStore.getState().baselines);

  // Baselines live in a store and in no manifest — declared as GC roots,
  // exactly like the logo and text baselines.
  useEffect(() => registerExtraRootProvider(baselineKeys), []);

  /** The gallery as of now — see the identical helper in BatchSettings. */
  const latestPhotos = () => useGalleryStore.getState().photos;

  useEffect(() => {
    if (appliedCount === null) return;
    const t = window.setTimeout(() => setAppliedCount(null), 3000);
    return () => window.clearTimeout(t);
  }, [appliedCount]);

  const sizeNote = (() => {
    const targetWidth = widthOf(widthId);
    if (targetWidth === null) return `Each photo keeps its own resolution at ${ratioId}.`;
    const s = batchCropOutputSize({ width: 1, height: 1 }, ratioDims(ratioId), targetWidth);
    return `Every photo comes out ${s.width}×${s.height}.`;
  })();

  const applyToAll = useCallback(async () => {
    if (photos.length === 0) return;
    setRunning(true);
    setErrorMsg(null);
    setProgress({ done: 0, total: photos.length });
    const ratio = ratioDims(ratioId);
    const targetWidth = widthOf(widthId);
    const crops = useBatchCropStore.getState();
    // A hand-set frame if the preview has one for this photo, else the anchor.
    const rectFor = (id: string, w: number, h: number, useFraming: boolean) => {
      const f = useFraming ? crops.framing[id] : undefined;
      return f
        ? framedCropRect(w, h, ratio[0], ratio[1], f)
        : anchoredCropRect(w, h, ratio[0], ratio[1], anchor);
    };

    try {
      const { default: init, resize_pixels, encode_png_pixels } = await import(
        "stamp_tool"
      );
      await init();

      let done = 0;
      let succeeded = 0;

      // First pass: every non-active photo — crop in JS, scale + encode in
      // Rust, write back to IDB.
      const others = photos.filter((p) => p.id !== activePhotoId);
      for (const photo of others) {
        try {
          crops.setBaseline(photo.id, photo.originalKey);
          const baselineKey = useBatchCropStore.getState().baselines[photo.id]!;
          const original = await getOriginal(baselineKey);
          if (!original) {
            done++;
            setProgress({ done, total: photos.length });
            continue;
          }
          const file = new File([original.bytes], original.name, {
            type: original.mimeType,
          });
          const working = await makeWorkingCopy(file);

          // Always the baseline's pixels, so a framing always applies.
          const rect = rectFor(photo.id, working.width, working.height, true);
          const out = batchCropOutputSize(rect, ratio, targetWidth);
          let pixels = cropRgba(working.pixels, working.width, rect);
          if (out.width !== rect.width || out.height !== rect.height) {
            pixels = resize_pixels(
              pixels,
              rect.width,
              rect.height,
              out.width,
              out.height,
            );
          }

          const pngBytes = encode_png_pixels(pixels, out.width, out.height);
          const pngBlob = new Blob([pngBytes.buffer as ArrayBuffer], {
            type: "image/png",
          });
          const newName = photo.name.replace(/\.[^.]+$/, "") + ".png";
          const newFile = new File([pngBlob], newName, { type: "image/png" });

          const oldKey = photo.originalKey;
          const [newKey, newThumbCandidate] = await Promise.all([
            putOriginal(newFile, out.width, out.height),
            makeThumbnailFromPixels(
              pixels,
              out.width,
              out.height,
              resize_pixels,
            ),
          ]);
          let newThumb = newThumbCandidate;
          if (newThumb.size < 200) {
            try {
              newThumb = await makeThumbnail(newFile);
            } catch (fallbackErr) {
              console.error("[batch-crop] thumbnail fallback failed", fallbackErr);
            }
          }

          setPhotos((prev) =>
            prev.map((x) =>
              x.id !== photo.id
                ? x
                : {
                    ...x,
                    mimeType: "image/png",
                    byteSize: pngBlob.size,
                    originalKey: newKey,
                    thumbBlob: newThumb,
                    workingWidth: out.width,
                    workingHeight: out.height,
                  },
            ),
          );
          // Same guard as the logo pass; cropBaselineRef holds the roots.
          void deleteReplacedOriginal({
            oldKey,
            newKey,
            photoId: photo.id,
            photos: latestPhotos(),
            extraRoots: [baselineKey, ...baselineKeys()],
          });
          succeeded++;
        } catch (err) {
          console.error("Bulk-crop: failed on photo", photo.id, err);
        }
        done++;
        setProgress({ done, total: photos.length });
      }

      // Second pass: the active photo, via the live tool so it gets undo.
      const active = photos.find((p) => p.id === activePhotoId);
      if (active) {
        try {
          const tool = stampToolRef.current;
          if (tool) {
            const prior = crops.activeCrop[active.id];
            if (prior && (await tool.undo_count()) === prior.undoCount) {
              for (let i = 0; i < prior.steps; i++) await tool.undo();
            }
            // Only replay a hand framing on the pixels it was drawn on.
            const onOriginal = showsOriginalFraming(
              useBatchCropStore.getState(),
              active.id,
              active.originalKey,
              await tool.undo_count(),
            );
            // Crop the PHOTO, not the padded artboard around it.
            const b = await tool.photo_bounds();
            const [bx, by, bw, bh] =
              b && b.length >= 4
                ? [b[0]!, b[1]!, b[2]!, b[3]!]
                : [0, 0, await tool.width(), await tool.height()];
            const rect = rectFor(active.id, bw, bh, onOriginal);
            const out = batchCropOutputSize(rect, ratio, targetWidth);
            tool.crop(bx + rect.x, by + rect.y, rect.width, rect.height);
            let steps = 1;
            if (out.width !== rect.width || out.height !== rect.height) {
              tool.resize_with_filter(out.width, out.height, LANCZOS3);
              steps = 2;
            }
            crops.setActiveCrop(active.id, {
              undoCount: await tool.undo_count(),
              steps,
            });
            flushToCanvas();
            syncState();
            succeeded++;
          }
        } catch (err) {
          console.error("Bulk-crop: failed on active photo", err);
        }
        done++;
        setProgress({ done, total: photos.length });
      }

      setAppliedCount(succeeded);
      toast.success(
        `Cropped ${succeeded} image${succeeded === 1 ? "" : "s"} to ${ratioId}`,
      );
    } catch (err) {
      console.error("Bulk-crop: fatal error", err);
      setErrorMsg("Something went wrong.");
      toast.error("Couldn't crop the photos.");
    } finally {
      setRunning(false);
    }
  }, [
    photos,
    activePhotoId,
    ratioId,
    widthId,
    anchor,
    setPhotos,
    stampToolRef,
    flushToCanvas,
    syncState,
  ]);

  return (
    <div className="space-y-5">
      <div>
        <SectionHeader
          title="Crop"
          info="Every photo is cropped to the same shape, so a carousel's slides all line up."
          className="mb-2"
        />
        <ToolButtonGroup
          aria-label="Ratio"
          options={RATIO_OPTIONS}
          value={ratioId}
          onChange={setRatioId}
          columns={4}
        />
      </div>

      <PlacementGrid
        label="Keep"
        info="Which part of each photo survives the crop — center trims evenly, top keeps the top of a tall photo. Picking one resets any frames you dragged."
        value={anchor}
        onChange={setAnchor}
      />

      <div className="space-y-2">
        <p className="text-2xs text-theme-muted-foreground">
          Drag the frame on the preview to choose what each photo keeps. Click
          another photo in the gallery to frame it too.
        </p>
        {framedCount > 0 && (
          <div className="flex items-center justify-between gap-2">
            <span className="text-2xs text-theme-muted-foreground">
              {`${framedCount} of ${photos.length} framed by hand`}
            </span>
            {activePhotoId && framing[activePhotoId] && (
              <Button
                onClick={() => clearFraming(activePhotoId)}
              >
                Reset this frame
              </Button>
            )}
          </div>
        )}
      </div>

      <div>
        <ToolButtonGroup
          label="Output width"
          options={WIDTH_OPTIONS}
          value={widthId}
          onChange={setWidthId}
          columns={3}
        />
        <p className="mt-2 text-2xs text-theme-muted-foreground">{sizeNote}</p>
      </div>

      <Button
        size="large"
        onClick={applyToAll}
        disabled={running || photos.length === 0}
        className="w-full"
      >
        {running
          ? `Processing ${progress.done}/${progress.total}…`
          : `Crop All Images to ${ratioId}`}
      </Button>

      {appliedCount !== null && !running && (
        <SuccessCallout>
          {`✓ Cropped ${appliedCount} image${appliedCount === 1 ? "" : "s"}`}
        </SuccessCallout>
      )}

      {errorMsg && <ErrorNote>{errorMsg}</ErrorNote>}
    </div>
  );
}
