import { useRef, useState } from "react";
import type { MutableRefObject } from "react";
import type { ImageHorseTool } from "stamp_tool";
import { Package, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { exportOra, importOraAsNewPhoto } from "@/lib/openraster";

export interface OpenRasterControls {
  stampToolRef: MutableRefObject<ImageHorseTool | null>;
  flushToCanvas: () => void;
  syncState: () => void;
  /** Active photo's name, used as the downloaded .ora's filename (minus its
   *  own extension). Falls back to "image-horse" when there's no active photo. */
  imageName?: string | null;
  /** Adds a new gallery photo — the same funnel Browse Files/Paste/Sample
   *  Images use. Import lands here too: it must never overwrite whatever
   *  photo is currently open, so it always creates a new entry instead. */
  onAddPhotos: (
    files: File[],
    opts?: { skipArtboard?: boolean },
  ) => Promise<void>;
}

/** Strip a trailing extension (".png", ".jpg", …) so "Vacation Photo.png" →
 *  "Vacation Photo"; falls back to "image-horse" when there's nothing usable. */
function baseFileName(name: string | null | undefined): string {
  const stripped = (name ?? "").replace(/\.[a-z0-9]{2,5}$/i, "").trim();
  return stripped || "image-horse";
}

/**
 * Settings → Import / Export pane. Round-trips the full project (every layer)
 * through OpenRaster (.ora) — an open, layered ZIP container that also opens
 * in Krita, GIMP, and other editors. See docs/OpenRaster-Export-Import.md.
 *
 * v1 scope: layer name/opacity/visibility/active-layer survive the round
 * trip; live text/shape annotations are flattened into pixels on export
 * (lossy but correct-looking) rather than round-tripped losslessly — that's
 * Phase 3.
 */
export function ExportPane({
  stampToolRef,
  flushToCanvas,
  syncState,
  imageName,
  onAddPhotos,
}: OpenRasterControls) {
  const [busy, setBusy] = useState<"export" | "import" | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = async () => {
    const tool = stampToolRef.current;
    if (!tool) {
      toast.error("Open or create an image first.");
      return;
    }
    setBusy("export");
    try {
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
      toast.success("Exported .ora", {
        description: flattenedAnnotations
          ? "Live text/shape annotations were flattened into pixels for export."
          : undefined,
      });
    } catch (err) {
      console.error("Export .ora failed:", err);
      toast.error(
        err instanceof Error ? err.message : "Couldn't export the .ora file.",
      );
    } finally {
      setBusy(null);
    }
  };

  const handleImportFile = async (file: File) => {
    setBusy("import");
    try {
      await importOraAsNewPhoto(file, stampToolRef, onAddPhotos);
      flushToCanvas();
      syncState();
      const count = stampToolRef.current?.layer_count() ?? 0;
      toast.success("Imported .ora as a new photo", {
        description: `Restored ${count} layer${count === 1 ? "" : "s"}.`,
      });
    } catch (err) {
      console.error("Import .ora failed:", err);
      toast.error(
        err instanceof Error ? err.message : "Couldn't import that .ora file.",
      );
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Import */}
      <div className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">Import</h3>
          <p className="mt-1 text-xs leading-relaxed text-text-muted">
            Open an OpenRaster (.ora) project as a new photo, with its full
            layer stack restored. Your currently open photo is untouched.
          </p>
        </div>
        <Button
          size="large"
          disabled={busy !== null}
          onClick={() => fileInputRef.current?.click()}
          className="w-full"
        >
          {busy === "import" ? <Spinner size={16} /> : <Upload />}
          {busy === "import" ? "Importing…" : "Import .ora"}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".ora"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = ""; // allow re-selecting the same file next time
            if (file) void handleImportFile(file);
          }}
        />
      </div>

      {/* Export */}
      <div className="space-y-3 pt-4 border-t border-theme-sidebar-border">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">Export</h3>
          <p className="mt-1 text-xs leading-relaxed text-text-muted">
            Export the full project — every layer — to OpenRaster (.ora), an
            open, layered format that opens in Krita, GIMP, and other editors.
          </p>
        </div>
        <Button
          size="large"
          disabled={busy !== null}
          onClick={() => void handleExport()}
          className="w-full"
        >
          {busy === "export" ? <Spinner size={16} /> : <Package />}
          {busy === "export" ? "Exporting…" : "Export as .ora"}
        </Button>
      </div>
    </div>
  );
}
