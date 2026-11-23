// The Export dialog: one step, six rows (Chris, 11-23-2026). It used to be a
// wizard (Choose → Selected Image / All Images, swapped in with a slide);
// everything is on one screen now, and the rows that do not apply are greyed
// out rather than gone, so the dialog keeps its shape.
//
//   1. What        Download Selected | Download All (N)
//   2. Kind        Raster | Vector | With Layers — Raster on every open
//                  (Vector: only when an SVG is open; With Layers: one image
//                  only, a ZIP holds flat files)
//   3. Format      the tiles for that kind, the Shapes picker's stacked tiles
//                  (Raster: JPEG PNG WebP AVIF + plugin formats · Vector: SVG ·
//                  With Layers: ORA, PSD + layered plugin formats)
//   4. Camera Info Keep all · Remove location · Remove all (ADR-108)
//   5. Recipe      menu + Save… (Download All only; greyed for Selected)
//   5.5 File Name  (Download Selected; greyed for All — each image in the ZIP
//                  keeps its own name)
//   6. Actions     Selected: Download <format> · Share link · Clipboard
//                  All:      Download ZIP (N as <format>) · Share all (paid,
//                            not wired yet, so off)
//
// Rows 1 and 2 are the top bar's ToggleButtonGroup in select mode — a radio
// group each, one Tab stop, arrow keys. Row 3 is the Shapes picker's
// ToolButtonGroup (stacked). Row 3 is ONE radio group per kind: the kind row
// is a separate, real choice now, so the old one-group-for-all-formats rule
// (a format and its kind were one choice) moves up a level.
//
// The parent (AppShell) still decides what a download writes from `format`:
// "svg" on Download All zips the SVGs, anything else zips in `zipFormat`.
// Picking a kind here therefore just picks that kind's format.
//
// SVG passthrough: the SVG tile writes the uploaded SVG back out, cropped the
// way the image was cropped (lib/svgPassthrough.ts), a zip of them on All.
//
// State lives INSIDE DialogContent on purpose: Radix unmounts the content when
// the dialog closes, so every open starts fresh with no reset effect.
import type { ExportFormat } from "@/lib/exportImage";
import * as React from "react";
import {
  ClipboardCopy,
  Download,
  FolderArchive,
  Image as ImageIcon,
  Layers,
  PenTool,
  Share2,
} from "lucide-react";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PanelAction, PanelActionBar } from "@/components/ui/panel-action-bar";
import { ToolButtonGroup } from "@/components/ui/tool-button-group";
import { ToggleButtonGroup } from "@/components/ui/toggle-button-group";
import { ExportFileNameField } from "@/components/ExportFileNameField";
import {
  FileAvifIcon,
  FileJpegIcon,
  FileOraIcon,
  FilePngIcon,
  FilePsdIcon,
  FileSvgIcon,
  FileWebpIcon,
  makeFileTypeIcon,
} from "@/components/icons/FileTypeIcons";
import type {
  DownloadFormat,
  DownloadFormatOption,
} from "@/app/session/useDownloadFormat";
import type { ActiveFormat } from "@/lib/plugins";
import { ZipRecipePicker } from "@/components/ZipRecipePicker";
import { CameraInfoPicker } from "@/components/CameraInfoPicker";
import { useZipRecipe } from "@/stores/useZipRecipeStore";

/** The format picker's ids: every real download format, the formats the
 *  active plugins add (Settings → Plugins, lib/plugins — their manifest ids,
 *  "psd" for the PSD plugin), plus PSD as a placeholder while NO plugin
 *  provides it: shown disabled ("Activate with plugin") and never pickable. */
type FormatTileId = DownloadFormat | "psd";
type Scope = "selected" | "all";
type Kind = "raster" | "vector" | "layers";

/** Files that hold every layer of the project rather than one picture. */
const LAYERED_IDS: FormatTileId[] = ["ora", "psd"];
/** A plugin format is "With Layers" when its id is one of those, or its own
 *  hint says so ("Layered · Photoshop"). */
const isLayeredPlugin = (p: ActiveFormat) =>
  LAYERED_IDS.includes(p.format.id as FormatTileId) || /^Layered\b/i.test(p.format.hint);

// No kind words ("vector", "layered") on a tile: the Kind row says which kind
// it is (Chris, 11-23-2026).
const SVG_HINT = "Keeps crop";
const SVG_OFF_HINT = "SVG uploads only";

/** The file-type glyphs carry lettering, so they get a larger slot than the
 *  tile's default 24px icon. Inline size, not a class: ToolButton's
 *  `[&_svg]:h-6` is a descendant selector and would outrank a plain `h-8`.
 *  Module scope so each tile keeps one component identity across renders. */
const BIG = { width: 32, height: 32 };
const FORMAT_TILE_ICONS: Record<string, React.ComponentType> = {
  jpeg: () => <FileJpegIcon style={BIG} />,
  png: () => <FilePngIcon style={BIG} />,
  webp: () => <FileWebpIcon style={BIG} />,
  avif: () => <FileAvifIcon style={BIG} />,
  ora: () => <FileOraIcon style={BIG} />,
  svg: () => <FileSvgIcon style={BIG} />,
  psd: () => <FilePsdIcon style={BIG} />,
};

/** A plugin format's glyph: the same lettered file icon, made once per label
 *  and kept, so the tile's component identity is stable across renders. */
const PLUGIN_TILE_ICONS = new Map<string, React.ComponentType>();
function pluginTileIcon(label: string): React.ComponentType {
  let icon = PLUGIN_TILE_ICONS.get(label);
  if (!icon) {
    const Glyph = makeFileTypeIcon(label.slice(0, 4).toUpperCase());
    icon = () => <Glyph style={BIG} />;
    PLUGIN_TILE_ICONS.set(label, icon);
  }
  return icon;
}

interface DownloadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** How many images are open — Download All needs two or more. */
  photoCount: number;
  formats: DownloadFormatOption[];
  /** Formats the active plugins add, after the built-ins. Whole-project
   *  files like ORA, so they sit on Selected only, never on All. */
  pluginFormats: ActiveFormat[];
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
        <ExportBody {...rest} />
      </DialogContent>
    </Dialog>
  );
}

function ExportBody({
  photoCount,
  formats,
  pluginFormats,
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
  const recipe = useZipRecipe();
  const [picked, setPicked] = React.useState<Scope>("selected");
  // An image deleted down to one while the dialog is open: back to Selected.
  const scope: Scope = multi ? picked : "selected";

  const pluginIds = new Set(pluginFormats.map((p) => p.format.id));
  const kindOfFormat = (f: DownloadFormat): Kind =>
    f === "svg"
      ? "vector"
      : LAYERED_IDS.includes(f) || pluginFormats.some((p) => p.format.id === f && isLayeredPlugin(p))
        ? "layers"
        : "raster";

  const vectorOn = scope === "selected" ? svg.selected : svg.all > 0;
  const layersOn = scope === "selected";
  // The kind the format already is, unless this scope cannot have it.
  const wanted = kindOfFormat(format);
  const kind: Kind =
    (wanted === "vector" && !vectorOn) || (wanted === "layers" && !layersOn) ? "raster" : wanted;

  // Every open starts on Raster (Chris, 11-23-2026), whatever was picked last
  // time: an ORA or SVG pick is for that one download, not a new default.
  // This body mounts fresh on each open (Radix unmounts closed content), so
  // a mount effect is "on open".
  React.useEffect(() => {
    if (kindOfFormat(format) !== "raster") onFormatChange(zipFormat);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- on open only
  }, []);

  /** Pick a kind: it lands on that kind's format — the raster one the store
   *  already holds, SVG, or ORA (or the first layered plugin format). */
  const pickKind = (k: Kind) => {
    if (k === "raster") onFormatChange(zipFormat);
    else if (k === "vector") onFormatChange("svg");
    else onFormatChange((kindOfFormat(format) === "layers" ? format : "ora") as DownloadFormat);
  };
  const pickScope = (next: Scope) => {
    setPicked(next);
    // Leaving a kind the new scope cannot have: the parent writes from
    // `format`, so it moves to the raster format too.
    const k = kindOfFormat(format);
    if ((next === "all" && k === "layers") || (k === "vector" && !(next === "selected" ? svg.selected : svg.all > 0))) {
      onFormatChange(zipFormat);
    }
  };

  // ── Row 3's tiles, per kind ────────────────────────────────────────────
  const pluginTile = ({ plugin, format: f }: ActiveFormat) => ({
    id: f.id as FormatTileId,
    // The plugin's hint names its kind ("Layered · Photoshop"); the Kind row
    // says that now, so the tile keeps the rest.
    label: f.hint.replace(/^Layered\s*·\s*/i, "") || f.hint,
    icon: FORMAT_TILE_ICONS[f.id] ?? pluginTileIcon(f.label),
    title: `${f.label} — ${f.hint} (${plugin.name} plugin).`,
  });
  const rasterTiles = [
    ...formats
      .filter((f) => kindOfFormat(f.value) === "raster")
      .map((f) => ({
        id: f.value as FormatTileId,
        label: f.hint,
        icon: FORMAT_TILE_ICONS[f.value],
        title: `${f.label} — ${f.hint}`,
      })),
    // Plugin formats write one image each, so they are Selected only.
    ...(scope === "selected"
      ? [...pluginFormats]
          .filter((p) => !isLayeredPlugin(p))
          .sort((a, b) => a.format.hint.localeCompare(b.format.hint))
          .map(pluginTile)
      : []),
  ];
  const vectorTiles = [
    {
      id: "svg" as const,
      label: vectorOn ? SVG_HINT : SVG_OFF_HINT,
      icon: FORMAT_TILE_ICONS.svg,
      title: vectorOn
        ? `SVG — ${SVG_HINT}. Painting and filters stay in the other formats.`
        : "SVG — only for images uploaded as SVG.",
      disabled: !vectorOn,
    },
  ];
  const layerTiles = [
    ...formats
      .filter((f) => kindOfFormat(f.value) === "layers")
      .map((f) => ({
        id: f.value as FormatTileId,
        label: f.hint,
        icon: FORMAT_TILE_ICONS[f.value],
        title: `${f.label} — ${f.hint}. Keeps every layer.`,
      })),
    ...[...pluginFormats].filter(isLayeredPlugin).map(pluginTile),
    // The placeholder, only while no plugin provides PSD.
    ...(pluginIds.has("psd")
      ? []
      : [
          {
            id: "psd" as const,
            label: "Activate with plugin",
            icon: FORMAT_TILE_ICONS.psd,
            title: "PSD — layered Photoshop file. Activate with the PSD plugin in Settings.",
            disabled: true,
          },
        ]),
  ];
  const tiles = kind === "raster" ? rasterTiles : kind === "vector" ? vectorTiles : layerTiles;
  const tileValue: FormatTileId = kind === "raster" ? (kindOfFormat(format) === "raster" ? format : zipFormat) : format;
  const allSvg = scope === "all" && kind === "vector";

  const zipAs = allSvg ? "SVG" : recipe ? recipe.name : zipLabel;
  const zipCount = allSvg ? svg.all : photoCount;

  return (
    <>
      <DialogHeader>
        <DialogTitle>Export</DialogTitle>
      </DialogHeader>
      <DialogBody className="flex flex-col gap-4">
        <DialogDescription className="sr-only">
          Download the selected image or all images, share a link, or copy to the clipboard.
        </DialogDescription>

        {/* 1. What */}
        <ToggleButtonGroup
          mode="select"
          aria-label="What to export"
          fill
          items={[
            {
              key: "selected",
              icon: ImageIcon,
              label: "Download Selected",
              active: scope === "selected",
              onToggle: () => pickScope("selected"),
            },
            {
              key: "all",
              icon: FolderArchive,
              label: `Download All (${photoCount})`,
              active: scope === "all",
              onToggle: () => pickScope("all"),
              disabled: !multi,
            },
          ]}
        />

        {/* 2. Kind */}
        <ToggleButtonGroup
          mode="select"
          aria-label="Kind of file"
          fill
          items={[
            { key: "raster", icon: ImageIcon, label: "Raster", active: kind === "raster", onToggle: () => pickKind("raster") },
            {
              key: "vector",
              icon: PenTool,
              label: "Vector",
              active: kind === "vector",
              onToggle: () => pickKind("vector"),
              disabled: !vectorOn,
              tooltip: { label: vectorOn ? "Vector: the SVG you uploaded" : "Vector: only for images uploaded as SVG" },
            },
            {
              key: "layers",
              icon: Layers,
              label: "With Layers",
              active: kind === "layers",
              onToggle: () => pickKind("layers"),
              disabled: !layersOn,
              tooltip: { label: layersOn ? "With Layers: every layer kept, to open in another editor" : "With Layers: one image at a time, not in a ZIP" },
            },
          ]}
        />

        {/* 3. Format — the Shapes picker's tiles */}
        <ToolButtonGroup<FormatTileId>
          aria-label="Format"
          stacked
          columns={3}
          value={tileValue}
          onChange={(id) => {
            const t = tiles.find((o) => o.id === id);
            if (t && !("disabled" in t && t.disabled)) onFormatChange(id as DownloadFormat);
          }}
          options={tiles}
        />

        {/* 4. Camera Info (ADR-108). An SVG carries no camera info. */}
        {kind !== "vector" && (
          <CameraInfoPicker variant="section" recipeChoice={scope === "all" ? recipe?.cameraInfo : undefined} />
        )}

        {/* 5. Recipe — shapes a ZIP, so greyed out for Download Selected. */}
        {kind === "raster" && <ZipRecipePicker zipFormat={zipFormat} disabled={scope === "selected"} />}

        {/* 5.5 File Name — Download Selected; greyed for All, where each
            image in the ZIP keeps its own name. */}
        <ExportFileNameField
          value={fileName.value}
          defaultStem={fileName.defaultStem}
          onChange={fileName.onChange}
          ext={ext}
          onSubmit={onDownload}
          disabled={scope === "all"}
        />

        {allSvg && svg.all < photoCount && (
          <p className="text-2xs text-theme-muted-foreground">
            {`Only the ${svg.all} images uploaded as SVG go in the ZIP; the others are left out.`}
          </p>
        )}

        {/* 6. Actions */}
        {scope === "selected" ? (
          <PanelActionBar layout="thirds">
            <PanelAction icon={Download} onClick={onDownload}>
              {downloadLabel}
            </PanelAction>
            {shareAction}
            <PanelAction icon={ClipboardCopy} onClick={onCopy}>
              Clipboard
            </PanelAction>
          </PanelActionBar>
        ) : (
          <PanelActionBar layout="halves">
            <PanelAction icon={FolderArchive} onClick={onDownloadAll}>
              {`Download ZIP (${zipCount} as ${zipAs})`}
            </PanelAction>
            <PanelAction icon={Share2} disabled title="Share all: a paid feature, coming soon">
              Share All · Soon
            </PanelAction>
          </PanelActionBar>
        )}
      </DialogBody>
    </>
  );
}
