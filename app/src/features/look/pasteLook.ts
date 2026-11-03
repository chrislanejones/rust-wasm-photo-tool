// Paste look to the ticked photos (lib/look.ts says what a look is).
//
// HOW EACH PHOTO IS DONE (the Batch Resize rule, ResizeBatchPanel):
//   • Not on the canvas: from its STORED ORIGINAL at full resolution, one
//     photo at a time (decode, apply, encode, write, let go, next), written
//     back over the stored file. There is no undo for these, and the dialog
//     says so before you press Paste.
//   • On the canvas: through the live engine, as ONE undo step, which the op
//     log records like any other edit (so it undoes after a reload too).
//
// NEVER OVER A PHOTO'S OWN EDITS. A photo that is not open but has edits of
// its own (a saved archive, a persisted op log, or the gallery's edited mark)
// is skipped with a reason. Its edits restore on top of the stored file when
// it is opened, so writing the look into that file would put them on the
// wrong pixels. Open it and paste there instead, where it is one undo step.
import { getOriginal, putOriginal } from "@/lib/dexie/originalsAdapter";
import { deleteReplacedOriginal } from "@/lib/originalRefs";
import { collectExtraRoots } from "@/lib/extraRoots";
import { makeWorkingCopy, makeThumbnailFromPixels } from "@/lib/workingCopy";
import { encodeRgba, extFromMime, formatFromMime } from "@/lib/exportImage";
import { loadPhotoEdit } from "@/lib/editPersistence";
import { hasPersistedOplog } from "@/lib/oplogPersistence";
import { commitPendingEdits } from "@/lib/pendingEdits";
import { applyLookAsOneStep, type LookStep } from "@/lib/look";
import { useGalleryStore } from "@/stores/useGalleryStore";
import type { PhotoEntry } from "@/features/gallery/GalleryBar";
import type { ImageHorseTool } from "stamp_tool";

/** Larger than any photo the pixel budget lets through: decode at full size. */
const FULL_RESOLUTION = Number.MAX_SAFE_INTEGER;
/** JPEG/WebP/AVIF quality when the stored file does not say its own. */
const DEFAULT_QUALITY = 92;

export type PasteRow = {
  id: string;
  name: string;
  status: "pasted" | "skipped" | "failed";
  note?: string;
};

export interface LiveEngine {
  stampToolRef: { current: ImageHorseTool | null };
  flushToCanvas: () => void;
  syncState: () => void | Promise<void>;
}

/** The photos a paste would touch, and why any of them would not be. Cheap:
 *  no IndexedDB reads, so the dialog can show the count as it opens. */
export function pasteTargets(fromId: string): PhotoEntry[] {
  const { photos, selectedIds } = useGalleryStore.getState();
  return photos.filter((p) => selectedIds.has(p.id) && p.id !== fromId);
}

async function hasOwnEdits(photo: PhotoEntry): Promise<boolean> {
  if (useGalleryStore.getState().modifiedPhotos.has(photo.id)) return true;
  if (await hasPersistedOplog(photo.id)) return true;
  return (await loadPhotoEdit(photo.id)) !== null;
}

/** Apply the steps to RGBA pixels in a throwaway engine, in history order.
 *  The engine is freed before this returns, whatever happens. */
async function lookOnPixels(
  mod: typeof import("stamp_tool"),
  pixels: Uint8Array,
  width: number,
  height: number,
  steps: readonly LookStep[],
): Promise<Uint8Array> {
  const tool = new mod.ImageHorseTool(width, height);
  try {
    tool.load_image(pixels);
    for (const step of steps) {
      if (step.kind === "preset") tool.preset_apply(...step.values);
      else if (step.kind === "levels") tool.levels_apply(step.values[0], step.values[1], step.values[2]);
      else {
        tool.tonal_preview_begin();
        tool.adjust_apply(...step.values);
      }
    }
    return new Uint8Array(await tool.get_image_data());
  } finally {
    tool.free();
  }
}

async function pasteOnStored(
  mod: typeof import("stamp_tool"),
  photo: PhotoEntry,
  steps: readonly LookStep[],
): Promise<PasteRow> {
  const base = { id: photo.id, name: photo.name };
  if (photo.mimeType === "image/svg+xml") return { ...base, status: "skipped", note: "SVG — kept as a vector" };
  if (await hasOwnEdits(photo)) {
    return { ...base, status: "skipped", note: "has edits of its own — open it and paste there" };
  }
  const original = await getOriginal(photo.originalKey);
  if (!original) return { ...base, status: "failed", note: "couldn't read the stored file" };
  const file = new File([original.bytes], original.name, { type: original.mimeType });
  const decoded = await makeWorkingCopy(file, FULL_RESOLUTION);
  const src = new Uint8Array(decoded.pixels.buffer, decoded.pixels.byteOffset, decoded.pixels.byteLength);
  const pixels = await lookOnPixels(mod, src, decoded.width, decoded.height, steps);
  const format = formatFromMime(photo.mimeType) ?? "png";
  const quality = photo.encodeQuality ?? DEFAULT_QUALITY;
  // encodeRgba may detach what it is given; the thumbnail needs the pixels too.
  const blob = await encodeRgba(pixels.slice(), decoded.width, decoded.height, format, quality / 100);
  const mime = blob.type || photo.mimeType;
  const stem = photo.name.replace(/\.[^.]+$/, "");
  const newFile = new File([blob], `${stem}${extFromMime(mime)}`, { type: mime });
  const [newKey, thumb] = await Promise.all([
    putOriginal(newFile, decoded.width, decoded.height),
    makeThumbnailFromPixels(pixels, decoded.width, decoded.height, mod.resize_pixels),
  ]);
  useGalleryStore.getState().setPhotos((prev) =>
    prev.map((x) =>
      x.id !== photo.id
        ? x
        : { ...x, originalKey: newKey, byteSize: blob.size, mimeType: mime, thumbBlob: thumb },
    ),
  );
  void deleteReplacedOriginal({
    oldKey: photo.originalKey,
    newKey,
    photoId: photo.id,
    photos: useGalleryStore.getState().photos,
    extraRoots: collectExtraRoots(),
  });
  return { ...base, status: "pasted" };
}

/** Paste `steps` onto every photo in `targets`: the ones not on the canvas
 *  first, from their stored files, then the open one through the engine. Rows
 *  arrive through `report` as each photo finishes. */
export async function pasteLook(
  steps: readonly LookStep[],
  targets: readonly PhotoEntry[],
  engine: LiveEngine,
  report: (row: PasteRow) => void,
): Promise<PasteRow[]> {
  const rows: PasteRow[] = [];
  const done = (row: PasteRow) => {
    rows.push(row);
    report(row);
  };
  const activeId = useGalleryStore.getState().activePhotoId;
  const mod = await import("stamp_tool");
  await mod.default();

  for (const photo of targets.filter((p) => p.id !== activeId)) {
    try {
      done(await pasteOnStored(mod, photo, steps));
    } catch (err) {
      console.error("Paste look: failed on", photo.name, err);
      done({ id: photo.id, name: photo.name, status: "failed", note: err instanceof Error ? err.message : "failed" });
    }
  }

  const open = targets.find((p) => p.id === activeId);
  const tool = engine.stampToolRef.current;
  if (open && tool) {
    try {
      // A panel still previewing (Adjustments, Levels, a hovered preset) bakes
      // or drops its preview first, so the paste starts from a settled photo
      // and does not join the preview's session.
      await commitPendingEdits();
      await applyLookAsOneStep(tool, steps);
      engine.flushToCanvas();
      await engine.syncState();
      done({ id: open.id, name: open.name, status: "pasted" });
    } catch (err) {
      console.error("Paste look: failed on the open photo", err);
      done({ id: open.id, name: open.name, status: "failed", note: err instanceof Error ? err.message : "failed" });
    }
  }
  return rows;
}
