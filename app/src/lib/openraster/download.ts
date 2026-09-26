// Shared ".ora" file-download step — the DOM/anchor-click mechanics that both
// Settings → Import/Export (ExportPane) and the single Download dialog need,
// so the two surfaces can't drift on how a .ora actually reaches disk.
import type { MutableRefObject } from "react";
import type { ImageHorseTool } from "stamp_tool";
import { toast } from "sonner";
import { exportOra } from "./export";

/** Strip a trailing extension (".png", ".jpg", …) so "Vacation Photo.png" →
 *  "Vacation Photo"; falls back to "image-horse" when there's nothing usable. */
export function baseFileName(name: string | null | undefined): string {
  const stripped = (name ?? "").replace(/\.[a-z0-9]{2,5}$/i, "").trim();
  return stripped || "image-horse";
}

export interface DownloadOraOptions {
  stampToolRef: MutableRefObject<ImageHorseTool | null>;
  flushToCanvas: () => void;
  syncState: () => void;
  /** Active photo's name, used as the downloaded .ora's filename (minus its
   *  own extension). Falls back to "image-horse" when there's no active photo. */
  imageName?: string | null;
}

/**
 * Export the full project (every layer) to a .ora file and trigger the
 * browser download. Throws with a user-facing message on failure — callers
 * are expected to catch it and surface the message via toast.
 */
export async function downloadOraProject({
  stampToolRef,
  flushToCanvas,
  syncState,
  imageName,
}: DownloadOraOptions): Promise<{ flattenedAnnotations: boolean }> {
  const tool = stampToolRef.current;
  if (!tool) throw new Error("Open or create an image first.");
  const { blob, flattenedAnnotations } = await exportOra(tool);
  // The export flatten path can touch the live document (see export.ts) —
  // refresh the layer panel + canvas so it reflects the flattened state.
  if (flattenedAnnotations) {
    flushToCanvas();
    syncState();
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${baseFileName(imageName)}.ora`;
  a.click();
  URL.revokeObjectURL(url);
  return { flattenedAnnotations };
}

/** `downloadOraProject`, with the success/error toast every caller wants —
 *  the Settings pane and the Download dialog's ORA option share this one
 *  message pair instead of each writing its own. */
export async function downloadOraWithToast(opts: DownloadOraOptions): Promise<void> {
  try {
    const { flattenedAnnotations } = await downloadOraProject(opts);
    toast.success("Exported .ora", {
      description: flattenedAnnotations
        ? "Live text/shape annotations were flattened into pixels for export."
        : undefined,
    });
  } catch (err) {
    console.error("Export .ora failed:", err);
    toast.error(err instanceof Error ? err.message : "Couldn't export the .ora file.");
  }
}
