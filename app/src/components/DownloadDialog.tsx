// The Export dialog: one step, and it adapts to the task (Chris, 11-24-2026,
// after a design review: "a settings panel, not an export dialog"). Nothing is
// shown grayed out just to keep the dialog's shape; a row that cannot apply is
// left out, and the dialog's height follows what you are doing.
//
//   Selected image                     All images (N)
//   1. What        Selected image | All images (N)
//   2. File Name   name + its extension, one box     Recipe: menu + Save recipe,
//                                                    then Batch settings
//   3. Kind        Raster | Vector | With Layers     Raster | Vector (no layers
//                  — Raster on every open             in a ZIP)
//   4. Format      tiles named for the format (JPEG PNG WebP AVIF + plugins ·
//                  SVG · ORA, PSD), one line under them saying what it's for
//   5. Privacy & metadata   a drop-down, shut, its choice on the right (ADR-108)
//   6. Footer      what you'll get ("photo.jpg · 1 image · JPEG"), the quiet
//                  actions (Share link, Clipboard / Share All · Soon) and ONE
//                  solid primary: Download JPEG / Download ZIP
//
// Rows 1 and 3 are the top bar's ToggleButtonGroup in select mode — a radio
// group each, one Tab stop, arrow keys. Row 4 is the Shapes picker's
// ToolButtonGroup (stacked), one radio group per kind.
//
// The parent (AppShell) still decides what a download writes from `format`:
// "svg" on All images zips the SVGs, anything else zips in `zipFormat`.
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
import { PanelAction } from "@/components/ui/panel-action-bar";
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
import { CONFIRM_AFFIRMATIVE, PANEL_DIVIDER } from "@/lib/styles";
import { cn } from "@/lib/utils";

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

// A tile is named for its format ("JPEG"); the line under the row says what
// it is for. No kind words ("vector", "layered"): the Kind row says that
// (Chris, 11-23-2026).
const SVG_HINT = "Keeps crop";
const PSD_OFF_HINT = "Turn on the PSD plugin in Settings › Plugins to save PSD.";

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
      {/* ~600px (max-w-xl, 576): the format tiles fit four across. */}
      <DialogContent className="max-w-xl">
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

  // ── Row 4's tiles, per kind ────────────────────────────────────────────
  // Each tile is named for its format; `hint` is the line under the row.
  type Tile = { id: FormatTileId; label: string; icon: React.ComponentType; title: string; hint: string; disabled?: boolean };
  const pluginTile = ({ plugin, format: f }: ActiveFormat): Tile => ({
    id: f.id as FormatTileId,
    label: f.label,
    icon: FORMAT_TILE_ICONS[f.id] ?? pluginTileIcon(f.label),
    title: `${f.label} — ${f.hint} (${plugin.name} plugin).`,
    // The plugin's hint names its kind ("Layered · Photoshop"); the Kind row
    // says that, so the line keeps the rest.
    hint: f.hint.replace(/^Layered\s*·\s*/i, "") || f.hint,
  });
  const rasterTiles: Tile[] = [
    ...formats
      .filter((f) => kindOfFormat(f.value) === "raster")
      .map((f) => ({
        id: f.value as FormatTileId,
        label: f.label,
        icon: FORMAT_TILE_ICONS[f.value],
        title: `${f.label} — ${f.hint}`,
        hint: f.hint,
      })),
    // Plugin formats write one image each, so they are Selected only.
    ...(scope === "selected"
      ? [...pluginFormats]
          .filter((p) => !isLayeredPlugin(p))
          .sort((a, b) => a.format.label.localeCompare(b.format.label))
          .map(pluginTile)
      : []),
  ];
  const vectorTiles: Tile[] = [
    {
      id: "svg",
      label: "SVG",
      icon: FORMAT_TILE_ICONS.svg,
      title: vectorOn
        ? `SVG — ${SVG_HINT}. Painting and filters stay in the other formats.`
        : "SVG — only for images uploaded as SVG.",
      hint: `${SVG_HINT}. Painting and filters stay in the other formats.`,
      disabled: !vectorOn,
    },
  ];
  const layerTiles: Tile[] = [
    ...formats
      .filter((f) => kindOfFormat(f.value) === "layers")
      .map((f) => ({
        id: f.value as FormatTileId,
        label: f.label,
        icon: FORMAT_TILE_ICONS[f.value],
        title: `${f.label} — ${f.hint}. Keeps every layer.`,
        hint: `${f.hint}. Keeps every layer.`,
      })),
    ...[...pluginFormats].filter(isLayeredPlugin).map(pluginTile),
    // The placeholder, only while no plugin provides PSD.
    ...(pluginIds.has("psd")
      ? []
      : [
          {
            id: "psd" as const,
            label: "PSD",
            icon: FORMAT_TILE_ICONS.psd,
            title: "PSD — layered Photoshop file. Activate with the PSD plugin in Settings.",
            hint: PSD_OFF_HINT,
            disabled: true,
          },
        ]),
  ];
  const tiles = kind === "raster" ? rasterTiles : kind === "vector" ? vectorTiles : layerTiles;
  const tileValue: FormatTileId = kind === "raster" ? (kindOfFormat(format) === "raster" ? format : zipFormat) : format;
  const pickedTile = tiles.find((t) => t.id === tileValue);
  const psdOff = kind === "layers" && !pluginIds.has("psd");
  const allSvg = scope === "all" && kind === "vector";

  const zipAs = allSvg ? "SVG" : recipe ? recipe.name : zipLabel;
  const zipCount = allSvg ? svg.all : photoCount;
  // The footer's "what you'll get" line.
  const formatName = downloadLabel.replace(/^Download\s+/, "");
  const fileTitle = `${fileName.value.trim() || fileName.defaultStem}${ext}`;

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
              label: "Selected image",
              active: scope === "selected",
              onToggle: () => pickScope("selected"),
            },
            {
              key: "all",
              icon: FolderArchive,
              label: `All images (${photoCount})`,
              active: scope === "all",
              onToggle: () => pickScope("all"),
              disabled: !multi,
            },
          ]}
        />

        {/* 2. File Name (Selected) or Recipe + Batch settings (All). Each
            image in a ZIP keeps its own name, so All has no name field; a
            recipe shapes a ZIP, so Selected has no recipe. An SVG ZIP is the
            uploaded files as they are, so it takes no recipe either. */}
        {scope === "selected" ? (
          <ExportFileNameField
            value={fileName.value}
            defaultStem={fileName.defaultStem}
            onChange={fileName.onChange}
            ext={ext}
            onSubmit={onDownload}
          />
        ) : (
          kind === "raster" && <ZipRecipePicker zipFormat={zipFormat} />
        )}

        {/* 3. Kind. With Layers is one file at a time, so All leaves it out. */}
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
            ...(scope === "selected"
              ? [
                  {
                    key: "layers",
                    icon: Layers,
                    label: "With Layers",
                    active: kind === "layers",
                    onToggle: () => pickKind("layers"),
                    tooltip: { label: "With Layers: every layer kept, to open in another editor" },
                  },
                ]
              : []),
          ]}
        />

        {/* 4. Format — the Shapes picker's tiles, named for the format, and
            one line saying what the picked one is for. */}
        <div className="space-y-2">
          <ToolButtonGroup<FormatTileId>
            aria-label="Format"
            stacked
            columns={kind === "raster" ? 4 : 3}
            value={tileValue}
            onChange={(id) => {
              const t = tiles.find((o) => o.id === id);
              if (t && !t.disabled) onFormatChange(id as DownloadFormat);
            }}
            options={tiles.map(({ hint: _hint, ...t }) => t)}
          />
          <p data-testid="export-format-says" className="text-2xs text-theme-muted-foreground">
            {pickedTile && !pickedTile.disabled ? `${pickedTile.label} — ${pickedTile.hint}` : ""}
            {psdOff ? ` ${PSD_OFF_HINT}` : ""}
          </p>
          {allSvg && svg.all < photoCount && (
            <p className="text-2xs text-theme-muted-foreground">
              {`Only the ${svg.all} images uploaded as SVG go in the ZIP; the others are left out.`}
            </p>
          )}
        </div>

        {/* 5. Privacy & metadata (ADR-108), a drop-down. An SVG carries no
            camera info. */}
        {kind !== "vector" && (
          <CameraInfoPicker variant="dropdown" recipeChoice={scope === "all" ? recipe?.cameraInfo : undefined} />
        )}

        {/* 6. Footer: what you'll get, the quiet actions, ONE primary — the
            confirm dialogs' solid "yes, do it" fill. */}
        <div data-slot="export-footer" className={cn(PANEL_DIVIDER, "space-y-3")}>
          <p id="export-summary" className="truncate text-2xs text-theme-muted-foreground">
            {scope === "selected" ? (
              <>
                <span className="font-mono text-text-primary">{fileTitle}</span>
                {` · 1 image · ${formatName}`}
              </>
            ) : (
              `${zipCount} images · ${zipAs} · ZIP`
            )}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {scope === "selected" ? (
              <>
                {shareAction}
                <PanelAction icon={ClipboardCopy} onClick={onCopy}>
                  Clipboard
                </PanelAction>
                <PanelAction
                  icon={Download}
                  onClick={onDownload}
                  aria-describedby="export-summary"
                  className={cn("ml-auto", CONFIRM_AFFIRMATIVE)}
                >
                  {downloadLabel}
                </PanelAction>
              </>
            ) : (
              <>
                <PanelAction icon={Share2} disabled title="Share all: a paid feature, coming soon">
                  Share All · Soon
                </PanelAction>
                <PanelAction
                  icon={FolderArchive}
                  onClick={onDownloadAll}
                  aria-describedby="export-summary"
                  className={cn("ml-auto", CONFIRM_AFFIRMATIVE)}
                >
                  Download ZIP
                </PanelAction>
              </>
            )}
          </div>
        </div>
      </DialogBody>
    </>
  );
}
