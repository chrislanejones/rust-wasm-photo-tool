// Download All / ZIP, out of AppShell and into the one async grammar
// (Plan C §3). It used to show NOTHING: the dialog closed, N composites and
// encodes and a generateAsync ran with no progress, and a failure anywhere
// threw the whole ZIP away without a word (called bare, no catch).
//
// Now: a progress toast ("Zipping 3 of 12…"), a timeout, a photo that cannot
// be read is SKIPPED and counted instead of sinking the archive, and a real
// failure is an Error toast with Try again. The dialog has already closed, so
// the toast is this flow's surface; the states are the hook's.
import { useCallback, useRef } from "react";
import { toast } from "@/components/ui/sonner";
import { useAsyncTask } from "@/hooks/useAsyncTask";
import type { useEditPersistence } from "@/hooks/useEditPersistence";
import { getOriginal } from "@/lib/dexie/originalsAdapter";
import { compositeSavedEdit, encodeRgba, EXT, includeCanvasInExport } from "@/lib/exportImage";
import { resolveExportSource } from "@/lib/batchExportPlan";
import { untouchedZipEntry } from "@/lib/zipEntry";
import { readExifTiff, applyExifToReencoded } from "@/lib/exif";
import type { PhotoEntry } from "@/features/gallery/GalleryBar";
import type { ImageHorseTool } from "stamp_tool";

type Persistence = ReturnType<typeof useEditPersistence>;
type Format = Parameters<typeof encodeRgba>[3];

interface ZipDeps {
  activePhotoId: string | null;
  /** The active photo has edits not yet saved to the edit store. */
  activeChanged: boolean;
  toolRef: React.MutableRefObject<ImageHorseTool | null>;
  exportFormat: Format;
  quality: number;
  canvasBgTransparent: boolean;
  exportCanvasBackground: Parameters<typeof includeCanvasInExport>[0]["exportCanvasBackground"];
  exifKeep: boolean;
  exifStripMode: "all" | "location";
  loadPhotoEdit: Persistence["loadPhotoEdit"];
  savePhotoEdit: Persistence["savePhotoEdit"];
}

/** Ten minutes: a 100-photo gallery re-encoded on a slow laptop, with room. */
const ZIP_TIMEOUT_MS = 600_000;

export function useZipExport(deps: ZipDeps) {
  const { run, state } = useAsyncTask();
  const toastId = useRef<string | number | undefined>(undefined);
  const depsRef = useRef(deps);
  depsRef.current = deps;

  const exportZip = useCallback(
    async (list: PhotoEntry[], filename: string): Promise<void> => {
      if (list.length === 0) return;
      const d = depsRef.current;
      toast.dismiss(toastId.current);
      toastId.current = toast.loading(`Zipping 1 of ${list.length}…`);
      const result = await run(
        async ({ setProgress, isCurrent }) => {
          // Persist the active photo's in-progress edits so every photo reads
          // uniformly from the edit store below.
          if (d.activeChanged && d.activePhotoId && d.toolRef.current) {
            await d.savePhotoEdit(d.activePhotoId, d.toolRef);
          }
          // No `isChanged` gate: the presence of a saved edit in storage is
          // the question, and it outlives a reload (see batchExportPlan.ts).
          const { default: JSZip } = await import("jszip");
          const zip = new JSZip();
          const usedNames = new Set<string>();
          const mode = d.exifKeep ? "keep" : "strip";
          let skipped = 0;

          for (const [i, photo] of list.entries()) {
            if (!isCurrent()) return { skipped, mode };
            toast.loading(`Zipping ${i + 1} of ${list.length}…`, { id: toastId.current });
            setProgress(i / list.length);
            try {
              let bytes: Uint8Array<ArrayBuffer>;
              let mime: string;
              let ext: string;
              const { source, edit } = await resolveExportSource(photo.id, d.loadPhotoEdit);
              if (source === "edit" && edit) {
                // Honors Settings → "Photo only" like every other export path.
                const { pixels, w, h } = await compositeSavedEdit(edit, {
                  excludeBackground: !includeCanvasInExport({
                    exportCanvasBackground: d.exportCanvasBackground,
                    format: d.exportFormat,
                    canvasBgTransparent: d.canvasBgTransparent,
                  }),
                });
                const enc = await encodeRgba(pixels, w, h, d.exportFormat, d.quality / 100);
                bytes = new Uint8Array(await enc.arrayBuffer());
                mime = enc.type || "application/octet-stream";
                ext = EXT[d.exportFormat];
                // The re-encode carries no EXIF; keep → transplant the original's.
                let sourceTiff: Uint8Array<ArrayBuffer> | null = null;
                if (mode === "keep" && (d.exportFormat === "jpeg" || d.exportFormat === "webp")) {
                  const src = await getOriginal(photo.uploadKey ?? photo.originalKey);
                  if (src) sourceTiff = readExifTiff(new Uint8Array(src.bytes), src.mimeType);
                }
                bytes = applyExifToReencoded(bytes, d.exportFormat, mode, sourceTiff, w, h);
              } else {
                // Never edited, or compressed only: originalKey already holds
                // the bytes to ship (lib/zipEntry.ts re-encodes when needed).
                const orig = await getOriginal(photo.originalKey);
                if (!orig) {
                  skipped++;
                  continue;
                }
                ({ bytes, mime, ext } = await untouchedZipEntry(orig, d.exportFormat, d.quality / 100, {
                  mode,
                  stripMode: d.exifStripMode,
                }));
              }
              const base = photo.name || "image";
              let name = `${base}${ext}`;
              for (let n = 2; usedNames.has(name); n++) name = `${base}-${n}${ext}`;
              usedNames.add(name);
              zip.file(name, new Blob([bytes], { type: mime }));
            } catch (err) {
              // One unreadable photo is a skip, not the end of the archive.
              console.error("ZIP: skipped", photo.name, err);
              skipped++;
            }
          }
          if (skipped === list.length) throw new Error("None of the photos could be read.");
          setProgress(1);
          const out = await zip.generateAsync({ type: "blob" });
          const url = URL.createObjectURL(out);
          const a = document.createElement("a");
          a.href = url;
          a.download = filename;
          a.click();
          URL.revokeObjectURL(url);
          return { skipped, mode };
        },
        { timeoutMs: ZIP_TIMEOUT_MS, timeoutMessage: "Making the ZIP took too long and was stopped." },
      );

      toast.dismiss(toastId.current);
      if (result.status === "done") {
        const { skipped, mode } = result.value;
        const done = list.length - skipped;
        toast.success(
          skipped > 0
            ? `Zipped ${done} of ${list.length} — ${skipped} couldn't be read`
            : `Zipped ${list.length} photo${list.length === 1 ? "" : "s"}`,
          {
            description:
              mode === "strip"
                ? d.exifStripMode === "location"
                  ? "GPS removed — camera info kept"
                  : "EXIF + GPS removed"
                : undefined,
          },
        );
      } else if (result.status === "failed") {
        toast.error(`Couldn't make the ZIP. ${result.error}`, {
          action: { label: "Try again", onClick: () => void exportZip(list, filename) },
        });
      }
    },
    [run],
  );

  return { exportZip, state };
}
