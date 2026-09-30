// Open a plugin-format file as a NEW gallery photo with its layers restored.
//
// The same two steps as `importOraAsNewPhoto`, for the same reasons (read its
// header): (1) the file's flat picture becomes an ordinary new photo through
// `addPhotos`, with the canvas-artboard padding skipped so the canvas is
// exactly the file's size; (2) once that photo is the live document, the
// real layer stack is rebuilt over it. Never overwrites the open photo.
import type { ImageHorseTool } from "stamp_tool";
import { compositeLayers, type LayeredDocument } from "./document";
import { encodePng, restoreLayeredDocument } from "./bridge";
import type { FormatSpec } from "./types";

type AddPhotosFn = (files: File[], opts?: { skipArtboard?: boolean }) => Promise<void>;

export interface PluginImportResult {
  layers: number;
  /** What the codec could not keep — for the toast. */
  notes: string[];
}

export async function importPluginFormatAsNewPhoto(
  format: FormatSpec,
  file: File,
  toolRef: { current: ImageHorseTool | null },
  addPhotos: AddPhotosFn,
): Promise<PluginImportResult> {
  const codec = await format.load();
  const doc: LayeredDocument = codec.read(new Uint8Array(await file.arrayBuffer()));

  const flat = doc.composite ?? compositeLayers(doc);
  const png = await encodePng(flat, doc.width, doc.height);
  const stem = file.name.replace(new RegExp(`\\${format.extension}$`, "i"), "") || "Imported project";
  const flatFile = new File([new Uint8Array(png)], `${stem}.png`, { type: "image/png" });

  await addPhotos([flatFile], { skipArtboard: true });
  const tool = toolRef.current;
  if (!tool) {
    throw new Error(
      "Import succeeded in adding the photo, but the engine wasn't ready to restore its layers.",
    );
  }
  const layers = await restoreLayeredDocument(tool, doc);

  // Race guard, as in openraster/import.ts: the "auto-select first photo"
  // effect can swap in a fresh engine instance between the add and the
  // restore. Restore is a full rebuild, so doing it again is safe.
  if (toolRef.current && toolRef.current !== tool) {
    await restoreLayeredDocument(toolRef.current, doc);
  }
  return { layers, notes: doc.notes };
}
