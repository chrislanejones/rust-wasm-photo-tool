// Batch › Crop — one crop for the Main photos and one for the Exceptions (the
// photos ticked in the gallery, or with "Exception" ticked on the canvas). The
// Main | Exceptions switch above the panel (BatchGroupToggle) picks which crop
// you are editing; ONE pass crops every photo with its own group's settings.
// The mode id is `crop`. Same two-pass shape as the Logo and Text panels: every
// non-active photo is re-encoded and written back to IDB; the active photo goes
// through the live engine so the crop is a normal undo step.
//
// Drag the frame on the preview (BatchCropOverlay) and, on release, that
// framing becomes the one every photo IN THE SAME GROUP follows; frame another
// photo to give it its own. Shift-drag breaks the ratio. Enter runs the pass.
import { batchOutcome } from "@/lib/batchOutcome";
import { useCallback, useEffect, useRef, useState } from "react";
import { Square, RectangleHorizontal, RectangleVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PanelAction, PanelActionBar } from "@/components/ui/panel-action-bar";
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
  ratioLabel,
  type BatchCropWidth,
} from "@/lib/batchCrop";
import { useGalleryStore } from "@/stores/useGalleryStore";
import { cropTracked, useSvgSourceStore } from "@/stores/useSvgSourceStore";
import { rebaseOnOriginalCrop } from "@/lib/svgPassthrough";
import {
  useBatchCropStore,
  showsOriginalFraming,
  cropRatioOf,
  framingFor,
  type BatchCropWidthId,
} from "@/stores/useBatchCropStore";
import { groupOf } from "@/stores/useBatchGroupStore";
import { useBatchGroups } from "./useBatchGroups";
import type { PhotoEntry } from "@/features/gallery/GalleryBar";
import type { ImageHorseTool } from "stamp_tool";
import { ControlRow } from "@/components/ui/control-row";

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
  // The exceptions ARE the gallery's ticked photos; the switch above the panel
  // picks which group's crop is showing.
  const {
    exceptionIds,
    groups,
    hasExceptions,
    group: editing,
    activeGroup,
  } = useBatchGroups(photos, activePhotoId);
  const looks = useBatchCropStore((s) => s.looks);
  const look = looks[editing];
  const members = groups[editing];
  const custom = look.customRatio;
  const label = ratioLabel(cropRatioOf(look));
  const setRatioId = useBatchCropStore((s) => s.setRatioId);
  const setAnchor = useBatchCropStore((s) => s.setAnchor);
  const setWidthId = useBatchCropStore((s) => s.setWidthId);
  const framing = useBatchCropStore((s) => s.framing);
  const clearFraming = useBatchCropStore((s) => s.clearFraming);
  const setApplyAll = useBatchCropStore((s) => s.setApplyAll);
  const framedCount = members.filter((p) => framing[p.id]).length;

  const runningRef = useRef(false);
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
    const targetWidth = widthOf(look.widthId);
    const n = members.length;
    const [who, verb] = !hasExceptions ? ["Every photo", "s"] : n === 1 ? ["This photo", "s"] : [`These ${n}`, ""];
    if (targetWidth === null) return `${who} keep${verb} ${n === 1 ? "its" : "their"} own resolution at ${label}.`;
    const s = batchCropOutputSize({ width: 1, height: 1 }, cropRatioOf(look), targetWidth);
    return `${who} come${verb} out ${s.width}×${s.height}.`;
  })();

  const applyToAll = useCallback(async () => {
    // Enter can arrive while a pass is still running; the button can't.
    if (photos.length === 0 || runningRef.current) return;
    runningRef.current = true;
    setRunning(true);
    setErrorMsg(null);
    setProgress({ done: 0, total: photos.length });
    const crops = useBatchCropStore.getState();
    // Each photo gets ITS group's look: shape, anchor, width, shared frame.
    const lookOf = (id: string) => {
      const g = groupOf(exceptionIds, id);
      const l = crops.looks[g];
      return { g, l, ratio: cropRatioOf(l), targetWidth: widthOf(l.widthId) };
    };
    // The photo's own frame, else its group's shared one, else the anchor.
    const rectFor = (id: string, w: number, h: number, useFraming: boolean) => {
      const { g, l, ratio } = lookOf(id);
      const f = useFraming ? framingFor(crops, g, id) : undefined;
      return f
        ? framedCropRect(w, h, ratio[0], ratio[1], f)
        : anchoredCropRect(w, h, ratio[0], ratio[1], l.anchor);
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
          const { ratio, targetWidth } = lookOf(photo.id);
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

          // An SVG's stored original just became this crop — move its
          // vector frame the same way (lib/svgPassthrough).
          const svg = useSvgSourceStore.getState().sources[photo.id];
          if (svg) {
            useSvgSourceStore.getState().setSource(
              photo.id,
              rebaseOnOriginalCrop(
                svg,
                { x: rect.x, y: rect.y, w: rect.width, h: rect.height },
                out.width,
                out.height,
              ),
            );
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
            const { ratio, targetWidth } = lookOf(active.id);
            const out = batchCropOutputSize(rect, ratio, targetWidth);
            await cropTracked(tool, bx + rect.x, by + rect.y, rect.width, rect.height);
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
      const mainLabel = ratioLabel(cropRatioOf(crops.looks.main));
      const exceptionsLabel = ratioLabel(cropRatioOf(crops.looks.exceptions));
      const outcome = batchOutcome("Cropped", succeeded, photos.length);
      (outcome.ok ? toast.success : toast.warning)(
        hasExceptions
          ? `${outcome.text} — Main to ${mainLabel}, Exceptions to ${exceptionsLabel}`
          : outcome.ok
            ? `${outcome.text} to ${mainLabel}`
            : outcome.text,
      );
    } catch (err) {
      console.error("Bulk-crop: fatal error", err);
      setErrorMsg("Something went wrong.");
      toast.error("Couldn't crop the photos.");
    } finally {
      runningRef.current = false;
      setRunning(false);
    }
  }, [
    photos,
    exceptionIds,
    hasExceptions,
    activePhotoId,
    setPhotos,
    stampToolRef,
    flushToCanvas,
    syncState,
  ]);

  // Enter → Crop All, through the app's own Enter-to-crop shortcut (which
  // already stands aside for text fields and focused buttons).
  useEffect(() => {
    setApplyAll(() => void applyToAll());
    return () => setApplyAll(null);
  }, [applyToAll, setApplyAll]);

  return (
    <div className="space-y-6">
      <div>
        <SectionHeader
          title="Crop"
          info={
            <>
              Every photo is cropped to the same shape, so a carousel&apos;s
              slides all line up. Need a few to be different? Tick them in the
              gallery (or &ldquo;Exception&rdquo; on the canvas) and give
              Exceptions its own crop. Drag on the preview to frame; let go
              and the rest of that group follows. Hold Shift to break the
              ratio. Enter crops them all.
            </>
          }
          className="mb-2"
        />
        {/* Stacked tiles, the same grid as Select → Refine / Selection and
            Edit → Crop's ratios. */}
        <ToolButtonGroup
          stacked
          aria-label="Ratio"
          options={RATIO_OPTIONS}
          // A Shift-drag's custom shape lights no tile; picking one ends it.
          value={custom ? undefined : look.ratioId}
          onChange={(id) => setRatioId(editing, id)}
          columns={4}
        />
        {custom && (
          <p className="mt-2 text-2xs text-theme-muted-foreground">
            {`Custom ${label}, from a Shift-drag. Pick a ratio to go back.`}
          </p>
        )}
      </div>

      <PlacementGrid
        label="Keep"
        info="Which part of each photo survives the crop — center trims evenly, top keeps the top of a tall photo. Picking one resets any frames you dragged."
        value={look.anchor}
        onChange={(a) => setAnchor(editing, a, members.map((p) => p.id))}
      />

      {framedCount > 0 && (
        <div className="flex items-center justify-between gap-2">
          <span className="text-2xs text-theme-muted-foreground">
            {`${framedCount} of ${members.length} framed by hand`}
            {look.shared && framedCount < members.length ? " · the rest follow the last frame" : ""}
          </span>
          {activePhotoId && activeGroup === editing && framing[activePhotoId] && (
            <Button onClick={() => clearFraming(editing, activePhotoId)}>Reset this frame</Button>
          )}
        </div>
      )}

      <div>
        <ControlRow label="Output width">
          {({ labelId }) => (
            <ToolButtonGroup
              aria-labelledby={labelId}
              options={WIDTH_OPTIONS}
              value={look.widthId}
              onChange={(id) => setWidthId(editing, id)}
              columns={3}
            />
          )}
        </ControlRow>
        <p className="mt-2 text-2xs text-theme-muted-foreground">{sizeNote}</p>
      </div>

      <PanelActionBar>
        {/* One pass, both groups — the label says what each one gets. */}
        <PanelAction onClick={applyToAll} disabled={running || photos.length === 0}>
          {running
            ? `Processing ${progress.done}/${progress.total}…`
            : hasExceptions
              ? `Crop ${(["main", "exceptions"] as const)
                  .filter((g) => groups[g].length > 0)
                  .map((g) => `${groups[g].length} to ${ratioLabel(cropRatioOf(looks[g]))}`)
                  .join(" · ")}`
              : `Crop All Images to ${label}`}
        </PanelAction>
      </PanelActionBar>

      {appliedCount !== null && !running && (
        <SuccessCallout>
          {`✓ Cropped ${appliedCount} image${appliedCount === 1 ? "" : "s"}`}
        </SuccessCallout>
      )}

      {errorMsg && <ErrorNote>{errorMsg}</ErrorNote>}
    </div>
  );
}
