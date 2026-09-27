// The Download / Copy / Share dialog — moved out of AppShell (B3,
// docs/AppShell-Refactor-Plan.md). It owns its own draft state: the dialog's
// format pick (which may be ORA, and so never lands in the persisted
// preference), the AVIF-encodability probe, the file-name draft and the
// predicted export size. AppShell keeps the actions (export, export-all,
// clipboard) because the context menu and the shortcuts share them.
import { useEffect, useMemo, useState } from "react";
import { useEngine, useEngineFacade, useEngineState } from "@/app/session/SessionContext";
import { useUIStore } from "@/stores/useUIStore";
import { useToolStore } from "@/stores/useToolStore";
import { useGalleryStore } from "@/stores/useGalleryStore";
import { canEncode } from "@/lib/encodeSupport";
import { downloadOraWithToast } from "@/lib/openraster";
import { encodeRgba, EXT, includeCanvasInExport } from "@/lib/exportImage";
import type { ExportFormat } from "@/lib/exportImage";
import { useExportFileName } from "@/hooks/useExportFileName";
import { useExportDimensions } from "@/app/session/useExportDimensions";
import { ExportFileNameField } from "@/components/ExportFileNameField";
import { RadioCards } from "@/components/ui/radio-cards";
import { ActionTile } from "@/components/ui/action-tile";
import { ShareButton } from "@/components/ShareButton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
} from "@/components/ui/dialog";
import { Clipboard, FolderArchive, Image as ImageIcon, Package } from "lucide-react";

// Format choices shown in the Download dialog — a second chance to pick a
// format for anyone who missed the dropdown in the Compress panel. ORA is the
// one non-raster choice — the full layered project, not a flattened encode —
// so it never touches the persisted `exportFormat` preference below.
type DownloadFormat = ExportFormat | "ora";
const DOWNLOAD_FORMATS: { value: DownloadFormat; label: string; hint: string }[] = [
  { value: "jpeg", label: "JPEG", hint: "Small · no transparency" },
  { value: "png", label: "PNG", hint: "Lossless · transparency" },
  { value: "webp", label: "WebP", hint: "Small · transparency" },
  { value: "avif", label: "AVIF", hint: "Smallest · modern" },
  { value: "ora", label: "ORA", hint: "Layered · full project" },
];

export interface ExportDialogProps {
  /** Single download, from useCanvasActions — takes the file-name stem. */
  onExportAs: (stem: string) => Promise<void> | void;
  onExportAll: () => void;
  onCopyToClipboard: () => Promise<void> | void;
  /** Settings → Layers and Canvas → "Include canvas" (preferences). */
  exportCanvasBackground: boolean;
  canvasBgTransparent: boolean;
}

export function ExportDialog({
  onExportAs: handleExportAs,
  onExportAll: handleExportAll,
  onCopyToClipboard: handleCopyToClipboard,
  exportCanvasBackground,
  canvasBgTransparent,
}: ExportDialogProps) {
  const engine = useEngine();
  const engineFacade = useEngineFacade();
  const { ready } = useEngineState();
  const exportDialogOpen = useUIStore((s) => s.exportDialogOpen);
  const setExportDialogOpen = useUIStore((s) => s.setExportDialogOpen);
  const exportFormat = useToolStore((s) => s.exportFormat);
  const setExportFormat = useToolStore((s) => s.setExportFormat);
  const photos = useGalleryStore((s) => s.photos);
  const activePhotoId = useGalleryStore((s) => s.activePhotoId);
  const activeEntry = photos.find((p) => p.id === activePhotoId) ?? null;
  // The Download dialog is a SECOND format picker, and it was still selling
  // AVIF as "Smallest · modern" while this browser silently writes PNG. The
  // Compress panel's note does not reach here, so the dialog has to say it too
  // — otherwise the more prominent of the two surfaces is the dishonest one.
  const [avifEncodable, setAvifEncodable] = useState<boolean | undefined>(undefined);
  useEffect(() => {
    let live = true;
    void canEncode("image/avif").then((ok) => {
      if (live) setAvifEncodable(ok);
    });
    return () => {
      live = false;
    };
  }, []);
  const downloadFormats = useMemo(
    () =>
      DOWNLOAD_FORMATS.map((o) =>
        o.value === "avif" && avifEncodable === false
          ? { ...o, hint: "Not supported here · saves as PNG" }
          : o,
      ),
    [avifEncodable],
  );
  /** What will actually be written — drives the dialog's button label so it
   *  cannot offer "Download AVIF" and then hand over a PNG. */
  const effectiveExportFormat: ExportFormat =
    exportFormat === "avif" && avifEncodable === false ? "png" : exportFormat;
  // The dialog's own format pick, reseeded from the persisted preference each
  // time it opens — kept separate so an "ora" pick never lands in that store.
  const [downloadFormat, setDownloadFormat] = useState<DownloadFormat>(exportFormat);
  useEffect(() => {
    if (exportDialogOpen) setDownloadFormat(exportFormat);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exportDialogOpen]);
  const isOraDownload = downloadFormat === "ora";
  // The size the export will actually produce. Computed in an effect, because
  // the "Photo only" branch costs a whole-image composite per call and used to
  // run twice per render from JSX prop position — see the hook's header.
  const exportDims = useExportDimensions({
    stamp: engineFacade,
    active: exportDialogOpen,
    // `effectiveExportFormat`, not `exportFormat`: the dialog must predict the
    // crop the encoder will actually cause.
    excludeBackground: !includeCanvasInExport({
      exportCanvasBackground,
      format: effectiveExportFormat,
      canvasBgTransparent,
    }),
  });

  const exportName = useExportFileName(
    exportDialogOpen,
    activePhotoId,
    photos.find((p) => p.id === activePhotoId)?.name,
  );
  const downloadFromDialog = () => {
    setExportDialogOpen(false);
    if (isOraDownload) {
      void downloadOraWithToast({
        stampToolRef: engine.toolRef,
        flushToCanvas: engine.flushToCanvas,
        syncState: engine.syncState,
        imageName: activeEntry?.name,
      });
      return;
    }
    void handleExportAs(exportName.stem());
  };

  return (
    <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Download, Copy, or Share</DialogTitle>
        </DialogHeader>

        <DialogBody className="space-y-4">
          <DialogDescription>
            {photos.length > 1 ? (
              <>
                Save the selected image — or all of them as a{" "}
                <span className="font-mono">.zip</span> — copy the canvas to
                your clipboard, or create a public{" "}
                <strong className="font-semibold text-text-secondary">
                  share link
                </strong>{" "}
                anyone can open.
              </>
            ) : (
              <>
                Save this image, copy the canvas to your clipboard, or create a
                public{" "}
                <strong className="font-semibold text-text-secondary">
                  share link
                </strong>{" "}
                anyone can open.
              </>
            )}
          </DialogDescription>

          {/* Format picker — a second shot at the format for anyone who missed
              the Compress dropdown. */}
          <div className="space-y-2">
            <span className="text-xs font-semibold text-text-muted">Format</span>
            <RadioCards
              name="download-format"
              value={downloadFormat}
              onValueChange={(v) => {
                setDownloadFormat(v);
                if (v !== "ora") setExportFormat(v); // ORA stays local-only
              }}
              options={downloadFormats}
              columns={2}
            />
          </div>

          <ExportFileNameField
            value={exportName.value}
            defaultStem={exportName.defaultStem}
            onChange={exportName.onChange}
            ext={isOraDownload ? ".ora" : EXT[effectiveExportFormat]}
            onSubmit={downloadFromDialog}
          />
        </DialogBody>

        <DialogFooter className="flex-row gap-2">
          <ActionTile
            icon={isOraDownload ? Package : ImageIcon}
            label={isOraDownload ? "Download ORA" : `Download ${effectiveExportFormat.toUpperCase()}`}
            onClick={downloadFromDialog}
          />
          <ShareButton
            exportPng={async () => {
              if (exportCanvasBackground) return engine.exportBlob("png");
              const tool = engine.toolRef.current;
              if (!tool) return null;
              // ATOMIC CAPTURE (ADR-024) — one call for pixels and the
              // cropped dimensions that describe them.
              const cap = await tool.capture_composite_excluding_background();
              const { rgba, width, height } = cap;
              cap.free();
              return encodeRgba(rgba, width, height, "png", 1);
            }}
            canvasW={exportDims.width}
            canvasH={exportDims.height}
            fileName={photos.find((p) => p.id === activePhotoId)?.name}
            disabled={!ready}
            onShared={() => setExportDialogOpen(false)}
          />
          {photos.length > 1 && (
            <ActionTile
              icon={FolderArchive}
              label={`Download All (${photos.length})`}
              onClick={() => {
                setExportDialogOpen(false);
                handleExportAll();
              }}
            />
          )}
          <ActionTile
            icon={Clipboard}
            label="Clipboard"
            onClick={() => {
              setExportDialogOpen(false);
              void handleCopyToClipboard();
            }}
          />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
