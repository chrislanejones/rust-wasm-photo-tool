// Batch › Redact, one photo at a time (Night 11-21, 230, ADR-108).
//
// HOW EACH PHOTO IS DONE (the Batch Resize rule, ResizeBatchPanel):
//   • Not on the canvas: from its STORED ORIGINAL at full resolution (decode,
//     redact in a throwaway engine, encode, write, let go, next), written
//     back over the stored file. No undo, and the panel says so first.
//   • On the canvas: through the live engine as ONE undo step, which the op
//     log records with the ops it already has (ShapeAdd, Blur) — so it undoes
//     after a reload too, and the box stays editable until export.
//
// NEVER UNDER A PHOTO'S OWN EDITS (Paste look's rule, not Resize's). A photo
// that is not open but has edits of its own restores them on top of the
// stored file when it is opened, and a saved edit carries its own copy of the
// pixels: the redaction written into the stored file would be painted over
// by the unredacted pixels in the edit. For a privacy tool that is the one
// failure that matters, so such a photo is skipped with a reason.
//
// THE OPEN PHOTO NEEDS ONE PIXEL LAYER. A mosaic or blur works on the layer
// it is drawn on; with more than one content layer the text to hide may sit
// on another, and the box would hide nothing while looking done. So the open
// photo is redacted on its photo layer only when that is its only layer.
import { getOriginal, putOriginal } from "@/lib/dexie/originalsAdapter";
import { deleteReplacedOriginal } from "@/lib/originalRefs";
import { collectExtraRoots } from "@/lib/extraRoots";
import { makeWorkingCopy, makeThumbnailFromPixels } from "@/lib/workingCopy";
import { encodeRgba, extFromMime, formatFromMime } from "@/lib/exportImage";
import { commitPendingEdits } from "@/lib/pendingEdits";
import { boxOnPhoto, scaleRect, type Rect, type RedactLook } from "@/lib/batchRedact";
import { redactOnPixels, sendRedactions } from "@/lib/redactEngine";
import { hasOwnEdits } from "@/features/look/pasteLook";
import { useGalleryStore } from "@/stores/useGalleryStore";
import type { PhotoEntry } from "@/features/gallery/GalleryBar";
import type { ImageHorseTool } from "stamp_tool";

const FULL_RESOLUTION = Number.MAX_SAFE_INTEGER;
const DEFAULT_QUALITY = 92;

export type RedactRow = {
  id: string;
  name: string;
  status: "redacted" | "skipped" | "failed";
  note?: string;
  boxes?: number;
};

/** The look's boxes on a photo of `w` × `h` original px (those that land). */
function rectsOnPhoto(look: RedactLook, w: number, h: number): Rect[] {
  return look.boxes.map((b) => boxOnPhoto(b, look, w, h)).filter((r): r is Rect => r !== null);
}

export async function redactStored(mod: typeof import("stamp_tool"), photo: PhotoEntry, look: RedactLook): Promise<RedactRow> {
  const base = { id: photo.id, name: photo.name };
  if (look.boxes.length === 0) return { ...base, status: "skipped", note: "no boxes for this group" };
  if (photo.mimeType === "image/svg+xml") return { ...base, status: "skipped", note: "SVG — kept as a vector" };
  if (await hasOwnEdits(photo)) {
    return { ...base, status: "skipped", note: "has edits of its own — open it and redact there" };
  }
  const original = await getOriginal(photo.originalKey);
  if (!original) return { ...base, status: "failed", note: "couldn't read the stored file" };
  const file = new File([original.bytes], original.name, { type: original.mimeType });
  const decoded = await makeWorkingCopy(file, FULL_RESOLUTION);
  const rects = rectsOnPhoto(look, decoded.width, decoded.height);
  if (rects.length === 0) return { ...base, status: "skipped", note: "no box lands on this photo" };
  const src = new Uint8Array(decoded.pixels.buffer, decoded.pixels.byteOffset, decoded.pixels.byteLength);
  const pixels = await redactOnPixels(mod, src, decoded.width, decoded.height, rects, look);
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
    prev.map((x) => (x.id !== photo.id ? x : { ...x, originalKey: newKey, byteSize: blob.size, mimeType: mime, thumbBlob: thumb })),
  );
  void deleteReplacedOriginal({
    oldKey: photo.originalKey,
    newKey,
    photoId: photo.id,
    photos: useGalleryStore.getState().photos,
    extraRoots: collectExtraRoots(),
  });
  return { ...base, status: "redacted", boxes: rects.length };
}

export interface LiveEngine {
  tool: ImageHorseTool;
  flushToCanvas: () => void;
  syncState: () => void | Promise<void>;
}

export async function redactOpen(photo: PhotoEntry, look: RedactLook, engine: LiveEngine): Promise<RedactRow> {
  const base = { id: photo.id, name: photo.name };
  if (look.boxes.length === 0) return { ...base, status: "skipped", note: "no boxes for this group" };
  if (photo.mimeType === "image/svg+xml") return { ...base, status: "skipped", note: "SVG — kept as a vector" };
  const { tool } = engine;
  await commitPendingEdits();
  const contentLayers = await tool.content_layer_count();
  if (contentLayers !== 1) {
    return { ...base, status: "skipped", note: `has ${contentLayers} layers — flatten it, then redact` };
  }
  const layers = JSON.parse(await tool.get_layers()) as Array<{ id: number; kind: string }>;
  const photoLayer = layers.find((l) => l.kind === "content");
  if (!photoLayer) return { ...base, status: "failed", note: "no photo layer" };
  const b = await tool.photo_bounds();
  const docW = await tool.width();
  const docH = await tool.height();
  const bounds = b && b.length >= 4 ? { x: b[0]!, y: b[1]!, w: b[2]!, h: b[3]! } : { x: 0, y: 0, w: docW, h: docH };
  const ow = photo.origWidth > 0 ? photo.origWidth : bounds.w;
  const oh = photo.origHeight > 0 ? photo.origHeight : bounds.h;
  const k = bounds.w / ow;
  const rects = rectsOnPhoto(look, ow, oh).map((r) => {
    const s = scaleRect(r, k);
    return { ...s, x: s.x + bounds.x, y: s.y + bounds.y };
  });
  if (rects.length === 0) return { ...base, status: "skipped", note: "no box lands on this photo" };
  const before = await tool.active_layer_id();
  // Not an undo step: which layer is active is UI state.
  if (before !== photoLayer.id) await tool.set_active_layer(photoLayer.id);
  // Every box in this tick, no await between them: ONE undo step.
  sendRedactions(tool, rects, look);
  await tool.undo_count();
  if (before !== photoLayer.id) await tool.set_active_layer(before);
  engine.flushToCanvas();
  await engine.syncState();
  return { ...base, status: "redacted", boxes: rects.length };
}
