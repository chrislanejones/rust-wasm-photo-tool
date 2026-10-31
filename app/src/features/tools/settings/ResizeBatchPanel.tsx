// Batch › Resize & Compress (Night 10-28, 227). One width (or long edge), one
// format, one quality, and an optional "under N KB" target, for Main and for
// Exceptions, in ONE pass — the shape Batch › Crop runs in.
//
// HOW EACH PHOTO IS DONE
//   • Not on the canvas: from its STORED ORIGINAL at full resolution, one
//     photo at a time (the memory rule from #413: decode, resize, encode,
//     write, let go, next). Written back over the stored file.
//   • On the canvas: through the live engine, so the resize is a normal undo
//     step, then re-encoded and stored the way Apply Resize stores it
//     (usePersistActiveCanvas). The engine holds a working copy of at most
//     2048 px, so a target bigger than that copy SKIPS the open photo with a
//     reason instead of quietly writing it smaller than its original.
//
// NEVER BIGGER (the v9.40 rule): a result larger than the stored file is not
// written. The photo is kept as it is and its row says so. An SVG is kept
// too: re-encoding it would throw away the vector.
import { useCallback, useRef, useState } from "react";
import { PanelAction, PanelActionBar } from "@/components/ui/panel-action-bar";
import { ToolButtonGroup } from "@/components/ui/tool-button-group";
import { SectionHeader } from "@/components/ui/section-header";
import { ControlRow } from "@/components/ui/control-row";
import { NumberField } from "@/components/ui/number-field";
import { SizeSlider } from "@/components/ui/size-slider";
import { ErrorNote } from "@/components/ui/status-note";
import { toast } from "@/components/ui/sonner";
import { getOriginal, putOriginal } from "@/lib/dexie/originalsAdapter";
import { deleteReplacedOriginal } from "@/lib/originalRefs";
import { collectExtraRoots } from "@/lib/extraRoots";
import { makeWorkingCopy, makeThumbnailFromPixels } from "@/lib/workingCopy";
import { encodeRgba, extFromMime, formatFromMime, type ExportFormat } from "@/lib/exportImage";
import { documentSizeForPhoto } from "@/lib/resizeTarget";
import {
  encodeUnder,
  kb,
  resizeTarget,
  resolveFormat,
  type BatchResizeLook,
  type ResizeFormat,
} from "@/lib/batchResize";
import { batchOutcome } from "@/lib/batchOutcome";
import { useGalleryStore } from "@/stores/useGalleryStore";
import { useBatchResizeStore } from "@/stores/useBatchResizeStore";
import { groupOf } from "@/stores/useBatchGroupStore";
import { useBatchGroups } from "./useBatchGroups";
import type { PhotoEntry } from "@/features/gallery/GalleryBar";
import type { ImageHorseTool } from "stamp_tool";

const LANCZOS3 = 3;
/** Larger than any photo the pixel budget lets through: decode at full size. */
const FULL_RESOLUTION = Number.MAX_SAFE_INTEGER;

const SIZE_OPTIONS = [
  { id: "keep", label: "Keep" },
  { id: "1080", label: "1080" },
  { id: "1600", label: "1600" },
  { id: "2048", label: "2048" },
] as const;
type SizeId = (typeof SIZE_OPTIONS)[number]["id"] | "custom";

const FIT_OPTIONS = [
  { id: "width", label: "Width" },
  { id: "long", label: "Long edge" },
] as const;

const FORMAT_OPTIONS: readonly { id: ResizeFormat; label: string }[] = [
  { id: "keep", label: "Keep" },
  { id: "jpeg", label: "JPEG" },
  { id: "webp", label: "WebP" },
  { id: "avif", label: "AVIF" },
  { id: "png", label: "PNG" },
];

export type ResizeRow = {
  id: string;
  name: string;
  before: number;
  after: number | null;
  /** resized: written · kept: would have grown, left as is · skipped / failed */
  status: "resized" | "kept" | "skipped" | "failed";
  note?: string;
  /** What was written, for a resized row: "1600×1200 WebP". */
  out?: { width: number; height: number; mime: string };
};

interface Props {
  photos: PhotoEntry[];
  activePhotoId: string | null;
  setPhotos: React.Dispatch<React.SetStateAction<PhotoEntry[]>>;
  stampToolRef: React.MutableRefObject<ImageHorseTool | null>;
  flushToCanvas: () => void;
  syncState: () => void;
}

/** Encode `pixels` in `format` under the look's quality and KB target. Each
 *  encode gets its own copy: the worker path detaches the buffer. */
async function encodeLook(pixels: Uint8Array, w: number, h: number, format: ExportFormat, look: BatchResizeLook) {
  const encode = async (q: number): Promise<Blob> => {
    if (format === "png") {
      const mod = await import("stamp_tool");
      await mod.default();
      return new Blob([new Uint8Array(mod.encode_png_pixels_quality(pixels, w, h, q))], { type: "image/png" });
    }
    return encodeRgba(pixels.slice(), w, h, format, q / 100);
  };
  return encodeUnder(encode, look.quality, look.underKB === null ? null : look.underKB * 1024);
}

/** The stored-entry patch for a written file — the same fields
 *  usePersistActiveCanvas writes for Apply Resize. */
function writtenPatch(blob: Blob, format: ExportFormat, quality: number, key: string, thumb: Blob, w: number, h: number) {
  const mime = blob.type || `image/${format}`;
  return {
    originalKey: key,
    byteSize: blob.size,
    mimeType: mime,
    encodeQuality:
      format === "png" ? (quality < 100 ? quality : undefined) : mime !== "image/png" ? quality : undefined,
    origWidth: w,
    origHeight: h,
    workingWidth: w,
    workingHeight: h,
    thumbBlob: thumb,
  } satisfies Partial<PhotoEntry>;
}

function lookLabel(l: BatchResizeLook): string {
  const size = l.size === null ? "same size" : `${l.size}${l.fit === "long" ? " long edge" : ""}`;
  const fmt = l.format === "keep" ? "" : ` ${l.format.toUpperCase()}`;
  return `${size}${fmt}`;
}

export function ResizeBatchPanel({ photos, activePhotoId, setPhotos, stampToolRef, flushToCanvas, syncState }: Props) {
  const { exceptionIds, groups, hasExceptions, group: editing } = useBatchGroups(photos, activePhotoId);
  const looks = useBatchResizeStore((s) => s.looks);
  const setLook = useBatchResizeStore((s) => s.setLook);
  const look = looks[editing];
  const sizeId: SizeId =
    look.size === null ? "keep" : (SIZE_OPTIONS.find((o) => o.id === String(look.size))?.id ?? "custom");

  const runningRef = useRef(false);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [rows, setRows] = useState<ResizeRow[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const run = useCallback(async () => {
    if (photos.length === 0 || runningRef.current) return;
    runningRef.current = true;
    setRunning(true);
    setErrorMsg(null);
    setRows([]);
    setProgress({ done: 0, total: photos.length });
    const all = useBatchResizeStore.getState().looks;
    const lookOf = (id: string) => all[groupOf(exceptionIds, id)];
    const out: ResizeRow[] = [];
    const report = (row: ResizeRow) => {
      out.push(row);
      setRows([...out]);
      setProgress({ done: out.length, total: photos.length });
    };

    try {
      const mod = await import("stamp_tool");
      await mod.default();

      // First pass: every photo NOT on the canvas, from its stored original.
      for (const photo of photos.filter((p) => p.id !== activePhotoId)) {
        const base = { id: photo.id, name: photo.name, before: photo.byteSize, after: null };
        if (photo.mimeType === "image/svg+xml") {
          report({ ...base, status: "skipped", note: "SVG — kept as a vector" });
          continue;
        }
        try {
          const l = lookOf(photo.id);
          const original = await getOriginal(photo.originalKey);
          if (!original) {
            report({ ...base, status: "failed", note: "couldn't read the stored file" });
            continue;
          }
          const file = new File([original.bytes], original.name, { type: original.mimeType });
          const decoded = await makeWorkingCopy(file, FULL_RESOLUTION);
          const src = new Uint8Array(decoded.pixels.buffer, decoded.pixels.byteOffset, decoded.pixels.byteLength);
          const t = resizeTarget(decoded.width, decoded.height, l);
          const pixels =
            t.width === decoded.width && t.height === decoded.height
              ? src
              : mod.resize_pixels_filter(src, decoded.width, decoded.height, t.width, t.height, LANCZOS3);
          const format = resolveFormat(l, formatFromMime(photo.mimeType));
          const enc = await encodeLook(pixels, t.width, t.height, format, l);
          if (photo.byteSize > 0 && enc.blob.size > photo.byteSize) {
            report({ ...base, after: enc.blob.size, status: "kept", note: "would have grown — kept the original" });
            continue;
          }
          const mime = enc.blob.type || `image/${format}`;
          const stem = photo.name.replace(/\.[^.]+$/, "");
          const newFile = new File([enc.blob], `${stem}${extFromMime(mime)}`, { type: mime });
          const [newKey, thumb] = await Promise.all([
            putOriginal(newFile, t.width, t.height),
            makeThumbnailFromPixels(pixels, t.width, t.height, mod.resize_pixels),
          ]);
          const format_ = formatFromMime(mime) ?? format;
          setPhotos((prev) =>
            prev.map((x) =>
              x.id !== photo.id ? x : { ...x, ...writtenPatch(enc.blob, format_, enc.quality, newKey, thumb, t.width, t.height) },
            ),
          );
          void deleteReplacedOriginal({
            oldKey: photo.originalKey,
            newKey,
            photoId: photo.id,
            photos: useGalleryStore.getState().photos,
            extraRoots: collectExtraRoots(),
          });
          report({
            ...base,
            after: enc.blob.size,
            status: "resized",
            note: l.underKB !== null && !enc.fits ? `couldn't reach ${l.underKB} KB` : undefined,
            out: { width: t.width, height: t.height, mime },
          });
        } catch (err) {
          console.error("Batch resize: failed on", photo.name, err);
          report({ ...base, status: "failed", note: err instanceof Error ? err.message : "failed" });
        }
      }

      // Second pass: the photo on the canvas, through the engine (one undo).
      const active = photos.find((p) => p.id === activePhotoId);
      const tool = stampToolRef.current;
      if (active && tool) {
        const base = { id: active.id, name: active.name, before: active.byteSize, after: null };
        const l = lookOf(active.id);
        try {
          const b = await tool.photo_bounds();
          const docW = await tool.width();
          const docH = await tool.height();
          const bounds =
            b && b.length >= 4 ? { x: b[0]!, y: b[1]!, width: b[2]!, height: b[3]! } : { x: 0, y: 0, width: docW, height: docH };
          // The size comes from what is ON the canvas (it may hold unsaved
          // edits). The stored size only answers one question: would the
          // target need pixels the working copy no longer has?
          const want = resizeTarget(bounds.width, bounds.height, l);
          const fromStored = resizeTarget(active.origWidth, active.origHeight, l);
          if (active.mimeType === "image/svg+xml") {
            report({ ...base, status: "skipped", note: "SVG — kept as a vector" });
          } else if (fromStored.width > bounds.width || fromStored.height > bounds.height) {
            // The stored original is bigger than the canvas's working copy and
            // the target needs those pixels. Writing from the canvas would
            // shrink it; from the original would leave the canvas stale.
            report({
              ...base,
              status: "skipped",
              note: `open at working size (${bounds.width}×${bounds.height}) — switch photos and run again`,
            });
          } else {
            const resized = want.width !== bounds.width || want.height !== bounds.height;
            if (resized) {
              const doc = documentSizeForPhoto({ w: docW, h: docH }, bounds, { w: want.width, h: want.height });
              await tool.resize_with_filter(doc.w, doc.h, LANCZOS3);
            }
            const cap = await tool.capture_composite_excluding_background();
            const { rgba: pixels, width: tw, height: th } = cap;
            cap.free();
            const format = resolveFormat(l, formatFromMime(active.mimeType));
            const enc = await encodeLook(pixels, tw, th, format, l);
            if (active.byteSize > 0 && enc.blob.size > active.byteSize) {
              if (resized) await tool.undo();
              report({ ...base, after: enc.blob.size, status: "kept", note: "would have grown — kept the original" });
            } else {
              const mime = enc.blob.type || `image/${format}`;
              const stem = active.name.replace(/\.[^.]+$/, "");
              const newFile = new File([enc.blob], `${stem}${extFromMime(mime)}`, { type: mime });
              const [newKey, thumb] = await Promise.all([
                putOriginal(newFile, tw, th),
                makeThumbnailFromPixels(pixels, tw, th, mod.resize_pixels),
              ]);
              const format_ = formatFromMime(mime) ?? format;
              setPhotos((prev) =>
                prev.map((x) =>
                  x.id !== active.id ? x : { ...x, ...writtenPatch(enc.blob, format_, enc.quality, newKey, thumb, tw, th) },
                ),
              );
              void deleteReplacedOriginal({
                oldKey: active.originalKey,
                newKey,
                photoId: active.id,
                photos: useGalleryStore.getState().photos,
                extraRoots: collectExtraRoots(),
              });
              report({
                ...base,
                after: enc.blob.size,
                status: "resized",
                note: l.underKB !== null && !enc.fits ? `couldn't reach ${l.underKB} KB` : undefined,
                out: { width: tw, height: th, mime },
              });
            }
            flushToCanvas();
            syncState();
          }
        } catch (err) {
          console.error("Batch resize: failed on the open photo", err);
          report({ ...base, status: "failed", note: err instanceof Error ? err.message : "failed" });
        }
      }

      const resized = out.filter((r) => r.status === "resized").length;
      const kept = out.filter((r) => r.status === "kept").length;
      const outcome = batchOutcome("Resized", resized, photos.length);
      (outcome.ok ? toast.success : toast.warning)(
        kept > 0 ? `${outcome.text} — ${kept} kept, they would have grown` : outcome.text,
      );
    } catch (err) {
      console.error("Batch resize: fatal error", err);
      setErrorMsg("Something went wrong.");
      toast.error("Couldn't resize the photos.");
    } finally {
      runningRef.current = false;
      setRunning(false);
    }
  }, [photos, exceptionIds, activePhotoId, setPhotos, stampToolRef, flushToCanvas, syncState]);

  const buttonLabel = running
    ? `Resizing ${Math.min(progress.done + 1, progress.total)} of ${progress.total}…`
    : hasExceptions
      ? `Resize ${(["main", "exceptions"] as const)
          .filter((g) => groups[g].length > 0)
          .map((g) => `${groups[g].length} to ${lookLabel(looks[g])}`)
          .join(" · ")}`
      : `Resize All Images to ${lookLabel(look)}`;

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Resize & Compress"
        info={
          <>
            Every photo at once, from its stored original at full size. A photo
            already narrower than the size keeps its size and is only re-encoded.
            &ldquo;Under&rdquo; tries quality steps per photo and keeps the best
            one that fits. A result bigger than the stored file is never written.
            Tick photos in the gallery to give them their own settings as
            Exceptions.
          </>
        }
      />

      <ControlRow label="Fit">
        {({ labelId }) => (
          <ToolButtonGroup
            aria-labelledby={labelId}
            options={FIT_OPTIONS}
            value={look.fit}
            onChange={(fit) => setLook(editing, { fit })}
            columns={2}
          />
        )}
      </ControlRow>

      <ControlRow label="Size">
        {({ labelId }) => (
          <ToolButtonGroup
            aria-labelledby={labelId}
            options={SIZE_OPTIONS}
            value={sizeId === "custom" ? undefined : sizeId}
            onChange={(id) => setLook(editing, { size: id === "keep" ? null : Number(id) })}
            columns={4}
          />
        )}
      </ControlRow>
      <NumberField
        label="Custom size (px)"
        min={16}
        max={16384}
        value={look.size ?? ""}
        placeholder="Keep"
        onChange={(e) => {
          const n = Math.round(Number(e.target.value));
          setLook(editing, { size: e.target.value === "" || !Number.isFinite(n) || n < 1 ? null : n });
        }}
      />

      <ControlRow label="Format">
        {({ labelId }) => (
          <ToolButtonGroup
            aria-labelledby={labelId}
            options={FORMAT_OPTIONS}
            value={look.format}
            onChange={(format) => setLook(editing, { format })}
            columns={5}
          />
        )}
      </ControlRow>

      <SizeSlider
        label="Quality"
        min={10}
        max={100}
        value={look.quality}
        unit="%"
        onChange={(quality) => setLook(editing, { quality })}
      />

      <NumberField
        label="Under (KB, optional)"
        min={1}
        value={look.underKB ?? ""}
        placeholder="No target"
        onChange={(e) => {
          const n = Math.round(Number(e.target.value));
          setLook(editing, { underKB: e.target.value === "" || !Number.isFinite(n) || n < 1 ? null : n });
        }}
      />

      <PanelActionBar>
        <PanelAction onClick={() => void run()} disabled={running || photos.length === 0}>
          {buttonLabel}
        </PanelAction>
      </PanelActionBar>

      {rows.length > 0 && (
        <ul aria-label="Resize results" className="space-y-1 text-2xs">
          {rows.map((r) => (
            <li key={r.id} data-status={r.status} className="flex flex-col rounded-sm bg-bg-secondary px-2 py-1">
              <span className="flex justify-between gap-2">
                <span className="truncate text-theme-foreground">{r.name}</span>
                <span className="shrink-0 font-mono text-theme-foreground">
                  {r.status === "resized" && r.after !== null
                    ? `${kb(r.before)} → ${kb(r.after)}`
                    : r.status === "kept"
                      ? `${kb(r.before)} kept`
                      : r.status}
                </span>
              </span>
              {r.out && (
                <span
                  className="text-theme-muted-foreground"
                  data-width={r.out.width}
                  data-height={r.out.height}
                  data-mime={r.out.mime}
                >
                  {`${r.out.width}×${r.out.height} ${(formatFromMime(r.out.mime) ?? "").toUpperCase()}`}
                </span>
              )}
              {r.note && <span className="text-theme-muted-foreground">{r.note}</span>}
            </li>
          ))}
        </ul>
      )}

      {errorMsg && <ErrorNote>{errorMsg}</ErrorNote>}
    </div>
  );
}
