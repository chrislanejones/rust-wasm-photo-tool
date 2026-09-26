// Export the live document through a plugin format and hand it to the
// browser as a download — the plugin-format twin of openraster/download.ts,
// shared by Settings → Import / Export and the Download dialog so the two
// cannot drift on how a file reaches disk.
import type { MutableRefObject } from "react";
import type { ImageHorseTool } from "stamp_tool";
import { toast } from "sonner";
import { captureLayeredDocument } from "./bridge";
import type { FormatSpec } from "./types";

export interface DownloadPluginFormatOptions {
  format: FormatSpec;
  stampToolRef: MutableRefObject<ImageHorseTool | null>;
  flushToCanvas: () => void;
  syncState: () => void;
  /** File name without extension; the format's own extension is appended. */
  fileStem: string;
}

/** Throws with a user-facing message; `downloadPluginFormatWithToast` is the
 *  version every surface actually calls. */
async function downloadPluginFormat({
  format,
  stampToolRef,
  flushToCanvas,
  syncState,
  fileStem,
}: DownloadPluginFormatOptions): Promise<{ flattenedAnnotations: boolean }> {
  const tool = stampToolRef.current;
  if (!tool) throw new Error("Open or create an image first.");
  const codec = await format.load();
  const { doc, flattenedAnnotations } = await captureLayeredDocument(tool);
  // Flattening touched the live document — refresh the layer panel + canvas.
  if (flattenedAnnotations) {
    flushToCanvas();
    syncState();
  }
  const bytes = codec.write(doc);
  // `new Uint8Array(bytes)` copies onto a plain ArrayBuffer — the shape Blob
  // accepts — the way exportImage.ts and oplogPersistence.ts do it.
  const blob = new Blob([new Uint8Array(bytes)], { type: format.mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${fileStem}${format.extension}`;
  a.click();
  URL.revokeObjectURL(url);
  return { flattenedAnnotations };
}

export async function downloadPluginFormatWithToast(
  opts: DownloadPluginFormatOptions,
): Promise<void> {
  const ext = opts.format.extension;
  try {
    const { flattenedAnnotations } = await downloadPluginFormat(opts);
    toast.success(`Exported ${ext}`, {
      description: flattenedAnnotations
        ? "Live text/shape annotations were flattened into pixels for export."
        : undefined,
    });
  } catch (err) {
    console.error(`Export ${ext} failed:`, err);
    toast.error(err instanceof Error ? err.message : `Couldn't export the ${ext} file.`);
  }
}
