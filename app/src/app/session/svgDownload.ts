// SVG → SVG download: the single file and the zip (lib/svgPassthrough.ts).
//
// Both read the same two facts per image — the SVG source kept at import, and
// how far along its history the document is — and hand them to
// `resolveDocFrame`. The live engine answers for the open photo; every other
// photo answers from its saved edit, and a photo with no saved edit is its
// original (a Bulk crop on it already moved the source's base frame).
import type { ImageHorseTool } from "stamp_tool";
import type { PhotoEntry } from "@/features/gallery/GalleryBar";
import type { SavedEdit } from "@/lib/editPersistence";
import { resolveDocFrame, writeCroppedSvg, type SvgSource } from "@/lib/svgPassthrough";
import { toast } from "@/components/ui/sonner";
import { useSvgSourceStore } from "@/stores/useSvgSourceStore";

const SVG_MIME = "image/svg+xml";

interface DocState {
  undoCount: number;
  w: number;
  h: number;
}

function svgText(src: SvgSource, doc: DocState | null): string | null {
  const d = doc ?? { undoCount: 0, w: src.baseW, h: src.baseH };
  const frame = resolveDocFrame(src, d.undoCount, d.w, d.h);
  return frame ? writeCroppedSvg(src, frame) : null;
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** The open photo as an SVG, or null when it is not an SVG or no longer a
 *  crop of one (rotated, canvas resized). */
async function activeSvgText(
  photoId: string,
  tool: ImageHorseTool | null,
): Promise<string | null> {
  const src = useSvgSourceStore.getState().sources[photoId];
  if (!src) return null;
  const doc = tool
    ? { undoCount: await tool.undo_count(), w: await tool.width(), h: await tool.height() }
    : null;
  return svgText(src, doc);
}

/** Download the open photo as `<stem>.svg`. False when it cannot be written. */
async function downloadActiveSvg(
  photoId: string,
  tool: ImageHorseTool | null,
  stem: string,
): Promise<boolean> {
  const text = await activeSvgText(photoId, tool);
  if (text === null) return false;
  saveBlob(new Blob([text], { type: SVG_MIME }), `${stem}.svg`);
  return true;
}

/**
 * Zip every SVG image in `photos` as SVG. Non-SVG images are not in it, and
 * neither is an SVG that has been changed beyond a crop — both are counted in
 * the result so the caller can say so.
 */
export async function downloadSvgZip(opts: {
  photos: PhotoEntry[];
  activePhotoId: string | null;
  tool: ImageHorseTool | null;
  loadPhotoEdit: (id: string) => Promise<SavedEdit | null>;
  filename: string;
}): Promise<{ written: number; skipped: number }> {
  const { photos, activePhotoId, tool, loadPhotoEdit, filename } = opts;
  const sources = useSvgSourceStore.getState().sources;
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  const used = new Set<string>();
  let written = 0;
  let skipped = 0;

  for (const photo of photos) {
    const src = sources[photo.id];
    if (!src) continue;
    let text: string | null;
    if (photo.id === activePhotoId) {
      text = await activeSvgText(photo.id, tool);
    } else {
      const edit = await loadPhotoEdit(photo.id);
      text = svgText(
        src,
        edit ? { undoCount: edit.undoStack.length, w: edit.canvasW, h: edit.canvasH } : null,
      );
    }
    if (text === null) {
      skipped++;
      continue;
    }
    const base = photo.name || "image";
    let name = `${base}.svg`;
    for (let n = 2; used.has(name); n++) name = `${base}-${n}.svg`;
    used.add(name);
    zip.file(name, text);
    written++;
  }

  if (written > 0) saveBlob(await zip.generateAsync({ type: "blob" }), filename);
  return { written, skipped };
}

/** `downloadActiveSvg` plus the refusal toast, so the Download handler in
 *  AppShell is one call (like `downloadOraWithToast`) and stays under its cap. */
export async function downloadActiveSvgWithToast(
  photoId: string,
  tool: ImageHorseTool | null,
  fileStem: string,
): Promise<void> {
  const ok = await downloadActiveSvg(photoId, tool, fileStem);
  if (!ok) {
    toast.error(
      "This image can't be saved as SVG — it has been changed beyond a crop (rotated or resized unevenly).",
    );
  }
}
