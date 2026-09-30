// The Export dialog (Download, Copy, Share) — a MULTI-PANE dialog, in the same frame
// as the New dialog's New Canvas and Create AI Image panes (PaneSwap +
// PaneHeader, components/ui/dialog-pane.tsx).
//
//   1. Choose     — Selected Image or All Images, two stacked tiles (the tool
//                   panels' icon-on-top buttons, as in Magic Wand → Selection /
//                   Refine). Skipped when only one image is open: there is
//                   nothing to choose between.
//   2a. Selected  — Image format (tiles, not radio cards), Layered file (ORA,
//                   PSD), File name, and three actions in a row, each with a
//                   glyph: Download, Share link, Clipboard.
//   2b. All       — one full-width Download (N) that zips every image.
//
// SVG sits in both Format pickers and is disabled until an SVG is open: on
// Selected, when the image being worked on was uploaded as an SVG; on All, when
// any of them was. It writes the uploaded SVG back out, cropped the way the
// image was cropped (lib/svgPassthrough.ts) — a zip of them on All.
//
// The action rows are the tool panels' PanelActionBar — the Apply Crop button
// — so the bottom of every pane looks like the bottom of every tool panel.
//
// The pane state lives in `DownloadPanes`, INSIDE DialogContent, on purpose:
// Radix unmounts the content when the dialog closes, so every open starts
// back on the first pane with no reset effect to keep in sync.
import type { ExportFormat } from "@/lib/exportImage";
import * as React from "react";
import {
  ClipboardCopy,
  Download,
  FolderArchive,
  Image as ImageIcon,
} from "lucide-react";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ActionTile } from "@/components/ui/action-tile";
import { PaneHeader, PaneSwap, type PaneDirection } from "@/components/ui/dialog-pane";
import { PanelAction, PanelActionBar } from "@/components/ui/panel-action-bar";
import { ToolButtonGroup } from "@/components/ui/tool-button-group";
import { ExportFileNameField } from "@/components/ExportFileNameField";
import {
  FileAvifIcon,
  FileJpegIcon,
  FileOraIcon,
  FilePngIcon,
  FilePsdIcon,
  FileSvgIcon,
  FileWebpIcon,
} from "@/components/icons/FileTypeIcons";
import type {
  DownloadFormat,
  DownloadFormatOption,
} from "@/app/session/useDownloadFormat";

/** The format picker's ids: every real download format, plus PSD, which is
 *  shown disabled ("Activate with plugin") and can never be picked here. PSD
 *  export ships as a separate plugin (its own repo), added from Settings. */
type FormatTileId = DownloadFormat | "psd";

/** The whole-project files, shown in their own "Layered file" group. */
const LAYERED_IDS: FormatTileId[] = ["ora", "psd"];

const SVG_HINT = "Vector · keeps crop";
const SVG_OFF_HINT = "SVG uploads only";

/** The file-type glyphs carry lettering, so they get a larger slot than the
 *  tile's default 24px icon. Inline size, not a class: ToolButton's
 *  `[&_svg]:h-6` is a descendant selector and would outrank a plain `h-8`.
 *  Module scope so each tile keeps one component identity across renders. */
const BIG = { width: 32, height: 32 };
const FORMAT_TILE_ICONS: Record<FormatTileId, React.ComponentType> = {
  jpeg: () => <FileJpegIcon style={BIG} />,
  png: () => <FilePngIcon style={BIG} />,
  webp: () => <FileWebpIcon style={BIG} />,
  avif: () => <FileAvifIcon style={BIG} />,
  ora: () => <FileOraIcon style={BIG} />,
  svg: () => <FileSvgIcon style={BIG} />,
  psd: () => <FilePsdIcon style={BIG} />,
};

interface DownloadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** How many images are open — decides whether the Choose pane shows. */
  photoCount: number;
  formats: DownloadFormatOption[];
  format: DownloadFormat;
  onFormatChange: (format: DownloadFormat) => void;
  fileName: {
    value: string;
    defaultStem: string;
    onChange: (value: string) => void;
  };
  /** Extension shown after the name — follows the format the browser will
   *  actually write. */
  ext: string;
  /** "Download JPEG" / "Download ORA". */
  downloadLabel: string;
  onDownload: () => void;
  /** The Share link action, already wired (ShareButton). */
  shareAction: React.ReactNode;
  onCopy: () => void;
  onDownloadAll: () => void;
  /** The raster format the zip writes every image in — the store's export
   *  format, which an ORA pick on "Selected" leaves alone. Lights a tile. */
  zipFormat: ExportFormat;
  /** What the browser will ACTUALLY write for it ("PNG" for an AVIF it
   *  cannot encode), so the button never promises a format it won't deliver. */
  zipLabel: string;
  /** Where the SVG tile is live: `selected` — the open image is an SVG;
   *  `all` — how many of the open images are. */
  svg: { selected: boolean; all: number };
}

export function DownloadDialog({ open, onOpenChange, ...rest }: DownloadDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Export</DialogTitle>
        </DialogHeader>
        <DownloadPanes {...rest} />
      </DialogContent>
    </Dialog>
  );
}

type Pane = "choose" | "selected" | "all";

function DownloadPanes({
  photoCount,
  formats,
  format,
  onFormatChange,
  fileName,
  ext,
  downloadLabel,
  onDownload,
  shareAction,
  onCopy,
  onDownloadAll,
  zipFormat,
  zipLabel,
  svg,
}: Omit<DownloadDialogProps, "open" | "onOpenChange">) {
  const multi = photoCount > 1;
  const [picked, setPicked] = React.useState<Pane>(multi ? "choose" : "selected");
  const [direction, setDirection] = React.useState<PaneDirection>(1);
  // An image deleted down to one while the dialog is open leaves nothing to
  // choose between — land on Selected rather than on a dead pane.
  const pane: Pane = multi ? picked : "selected";

  const go = (next: Pane) => {
    setDirection(next === "choose" ? -1 : 1);
    setPicked(next);
  };
  const back = multi ? () => go("choose") : undefined;

  const svgTile = (enabled: boolean) => ({
    id: "svg" as const,
    label: enabled ? SVG_HINT : SVG_OFF_HINT,
    icon: FORMAT_TILE_ICONS.svg,
    title: enabled
      ? `SVG — ${SVG_HINT}. Painting and filters stay in the other formats.`
      : "SVG — only for images uploaded as SVG.",
    disabled: !enabled,
  });
  // An SVG pick that the pane cannot honor (picked on All, then Selected on a
  // raster image) shows the raster format the button will actually write.
  const selectedValue: FormatTileId = format === "svg" && !svg.selected ? zipFormat : format;
  const allSvg = format === "svg" && svg.all > 0;

  const formatOptions = [
    ...formats.map((f) => ({
      id: f.value as FormatTileId,
      label: f.hint,
      icon: FORMAT_TILE_ICONS[f.value],
      title: `${f.label} — ${f.hint}`,
    })),
    svgTile(svg.selected),
    {
      id: "psd" as const,
      label: "Activate with plugin",
      icon: FORMAT_TILE_ICONS.psd,
      title: "PSD — layered Photoshop file. Activate with the PSD plugin in Settings.",
      disabled: true,
    },
  ];

  return (
    <DialogBody>
      <PaneSwap paneKey={pane} direction={direction} className="flex flex-col gap-4">
        {pane === "choose" ? (
          <>
            <DialogDescription>
              One image, or all {photoCount} as a{" "}
              <span className="font-mono">.zip</span>.
            </DialogDescription>
            <div className="grid grid-cols-2 gap-3">
              <ActionTile
                icon={ImageIcon}
                label="Download Selected Image"
                onClick={() => go("selected")}
                className="py-5 [&_svg]:h-8 [&_svg]:w-8"
              />
              <ActionTile
                icon={FolderArchive}
                label={`Download All Images (${photoCount})`}
                onClick={() => go("all")}
                className="py-5 [&_svg]:h-8 [&_svg]:w-8"
              />
            </div>
          </>
        ) : pane === "selected" ? (
          <>
            <PaneHeader title="Selected Image" onBack={back} />
            <ToolButtonGroup<FormatTileId>
              label="Image format"
              stacked
              columns={3}
              value={LAYERED_IDS.includes(selectedValue) ? undefined : selectedValue}
              onChange={(id) => {
                if (id !== "psd") onFormatChange(id);
              }}
              options={formatOptions.filter((o) => !LAYERED_IDS.includes(o.id))}
            />
            {/* ORA and PSD hold every layer of the project, not one flattened
                picture, so they get their own group. */}
            <ToolButtonGroup<FormatTileId>
              label="Layered file"
              stacked
              columns={3}
              value={LAYERED_IDS.includes(selectedValue) ? selectedValue : undefined}
              onChange={(id) => {
                if (id !== "psd") onFormatChange(id);
              }}
              options={formatOptions.filter((o) => LAYERED_IDS.includes(o.id))}
            />
            {/* File name only here: a zip of every image keeps each image's
                own name. */}
            <ExportFileNameField
              value={fileName.value}
              defaultStem={fileName.defaultStem}
              onChange={fileName.onChange}
              ext={ext}
              onSubmit={onDownload}
            />
            <PanelActionBar layout="thirds">
              <PanelAction icon={Download} onClick={onDownload}>
                {downloadLabel}
              </PanelAction>
              {shareAction}
              <PanelAction icon={ClipboardCopy} onClick={onCopy}>
                Clipboard
              </PanelAction>
            </PanelActionBar>
          </>
        ) : (
          <>
            <PaneHeader title="All Images" onBack={back} />
            {/* The same tiles as Selected, on the same grid, minus the two that
                are whole-project files rather than one image each (ORA, PSD).
                Every image in the zip is written in this format; one already
                in it goes in untouched (lib/zipEntry.ts). SVG is live here
                when ANY open image is an SVG, and zips just those. */}
            <ToolButtonGroup<FormatTileId>
              label="Image format"
              stacked
              columns={3}
              value={allSvg ? "svg" : zipFormat}
              onChange={(id) => {
                if (id !== "psd" && id !== "ora") onFormatChange(id);
              }}
              options={formatOptions
                .filter((o) => o.id !== "ora" && o.id !== "psd")
                .map((o) => (o.id === "svg" ? svgTile(svg.all > 0) : o))}
            />
            <DialogDescription>
              {allSvg ? (
                <>
                  Every image uploaded as SVG, each with its crop, in one{" "}
                  <span className="font-mono">.zip</span>
                  {svg.all < photoCount ? " — the others are left out." : "."}
                </>
              ) : (
                <>
                  Every open image, each with its edits, in one{" "}
                  <span className="font-mono">.zip</span>.
                </>
              )}
            </DialogDescription>
            <PanelActionBar>
              <PanelAction icon={FolderArchive} onClick={onDownloadAll}>
                {allSvg
                  ? `Download ${svg.all} as SVG`
                  : `Download ${photoCount} as ${zipLabel}`}
              </PanelAction>
            </PanelActionBar>
          </>
        )}
      </PaneSwap>
    </DialogBody>
  );
}
