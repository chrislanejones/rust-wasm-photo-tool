import { useRef, useState } from "react";
import type { MutableRefObject } from "react";
import type { ImageHorseTool } from "stamp_tool";
import { Package, Puzzle, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { downloadOraWithToast, importOraAsNewPhoto } from "@/lib/openraster";
import { PaneHeading } from "@/components/ui/pane-heading";
import { baseFileName } from "@/lib/openraster/download";
import {
  downloadPluginFormatWithToast,
  importPluginFormatAsNewPhoto,
  type ActiveFormat,
} from "@/lib/plugins";
import { useActivePluginFormats } from "@/hooks/usePlugins";
import { navigateTo } from "@/features/routing";

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
  // Formats the active plugins add (Settings → Plugins). Empty while the
  // master switch is off, so this pane is exactly the .ora pane it was.
  const pluginFormats = useActivePluginFormats();
  const [pluginBusy, setPluginBusy] = useState<string | null>(null);
  const pluginInputRef = useRef<HTMLInputElement>(null);
  // One hidden input serves every plugin format: the button that opens it
  // sets `accept` and remembers which format asked, synchronously, inside the
  // click — a file picker only opens from a user gesture.
  const pendingImportRef = useRef<ActiveFormat | null>(null);

  const handlePluginExport = async ({ format }: ActiveFormat) => {
    setPluginBusy(`export:${format.id}`);
    await downloadPluginFormatWithToast({
      format,
      stampToolRef,
      flushToCanvas,
      syncState,
      fileStem: baseFileName(imageName),
    });
    setPluginBusy(null);
  };

  const handlePluginImportFile = async (file: File, { format }: ActiveFormat) => {
    setPluginBusy(`import:${format.id}`);
    try {
      const { layers, notes } = await importPluginFormatAsNewPhoto(
        format,
        file,
        stampToolRef,
        onAddPhotos,
      );
      flushToCanvas();
      syncState();
      toast.success(`Imported ${format.extension} as a new photo`, {
        description: [`Restored ${layers} layer${layers === 1 ? "" : "s"}.`, ...notes].join(" "),
        duration: notes.length ? 10000 : undefined,
      });
    } catch (err) {
      console.error(`Import ${format.extension} failed:`, err);
      toast.error(
        err instanceof Error ? err.message : `Couldn't import that ${format.extension} file.`,
      );
    } finally {
      setPluginBusy(null);
    }
  };
  const anyBusy = busy !== null || pluginBusy !== null;

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
          disabled={anyBusy}
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
          disabled={anyBusy}
          onClick={() => void handleExport()}
          className="w-full"
        >
          {busy === "export" ? <Spinner size={16} /> : <Package />}
          {busy === "export" ? "Exporting…" : "Export as .ora"}
        </Button>
      </div>

      {/* Plugin formats — one Import / Export pair per active format plugin. */}
      {pluginFormats.length === 0 ? (
        <div className="space-y-2 pt-4 border-t border-theme-sidebar-border">
          <PaneHeading title="More formats">
            Photoshop PSD and other layered formats are plugins. Turn them on in
            Settings → Plugins and their Import and Export buttons appear here.
          </PaneHeading>
          <Button onClick={() => navigateTo({ kind: "settings", tab: "plugins" })}>
            <Puzzle />
            Open Plugins
          </Button>
        </div>
      ) : (
        <>
          {pluginFormats.map((active) => {
            const { format, plugin } = active;
            const importing = pluginBusy === `import:${format.id}`;
            const exporting = pluginBusy === `export:${format.id}`;
            return (
              <div
                key={format.id}
                className="space-y-3 pt-4 border-t border-theme-sidebar-border"
              >
                <PaneHeading title={`${format.label} (${plugin.name} plugin)`}>
                  {format.describe} Open one as a new photo with its layers, or
                  export the full project — every layer — as {format.extension}.
                </PaneHeading>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    size="large"
                    disabled={anyBusy}
                    onClick={() => {
                      const input = pluginInputRef.current;
                      if (!input) return;
                      pendingImportRef.current = active;
                      input.accept = format.accept;
                      input.click();
                    }}
                  >
                    {importing ? <Spinner size={16} /> : <Upload />}
                    {importing ? "Importing…" : `Import ${format.extension}`}
                  </Button>
                  <Button
                    size="large"
                    disabled={anyBusy}
                    onClick={() => void handlePluginExport(active)}
                  >
                    {exporting ? <Spinner size={16} /> : <Package />}
                    {exporting ? "Exporting…" : `Export as ${format.extension}`}
                  </Button>
                </div>
              </div>
            );
          })}
          <input
            ref={pluginInputRef}
            type="file"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = ""; // allow re-selecting the same file next time
              const target = pendingImportRef.current;
              pendingImportRef.current = null;
              if (file && target) void handlePluginImportFile(file, target);
            }}
          />
        </>
      )}
    </div>
  );
}
