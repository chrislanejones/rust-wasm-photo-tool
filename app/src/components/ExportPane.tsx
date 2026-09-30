import { useRef, useState } from "react";
import type { MutableRefObject } from "react";
import type { ImageHorseTool } from "stamp_tool";
import { Package, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { downloadOraWithToast, importOraAsNewPhoto } from "@/lib/openraster";
import { PaneHeading } from "@/components/ui/pane-heading";

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
    setBusy("export");
    await downloadOraWithToast({ stampToolRef, flushToCanvas, syncState, imageName });
    setBusy(null);
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
        <PaneHeading title="Import">
          Open an OpenRaster (.ora) project as a new photo, with its full
          layer stack restored. Your currently open photo is untouched.
        </PaneHeading>
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
        <PaneHeading title="Export">
          Export the full project — every layer — to OpenRaster (.ora), an
          open, layered format that opens in Krita, GIMP, and other editors.
        </PaneHeading>
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
