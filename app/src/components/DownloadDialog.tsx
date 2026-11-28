// The Export dialog: one step, and it adapts to the task (Chris, 11-24-2026,
// after a design review: "a settings panel, not an export dialog"). Nothing is
// shown grayed out just to keep the dialog's shape; a row that cannot apply is
// left out, and the dialog's height follows what you are doing.
//
//   Selected image                     All images (N)
//   1. What        Selected image | All images (N)
//   2. File Name   name + its extension, one box,    Recipe: menu + Save recipe,
//                  then Recipe (Raster): menu +       then Batch settings
//                  Save recipe, the image's settings
//   3. Format      ONE row of tiles named for the format, grouped:
//                  JPEG PNG WebP AVIF (+ plugins) · SVG · ORA PSD. A group
//                  that can't apply is left out: SVG unless an image was
//                  uploaded as SVG, ORA/PSD on All (no layers in a ZIP). A
//                  raster format on every open. One line under the row says
//                  what the picked one is for. (Until 11-28-2026 a "Kind of
//                  file" row, Raster | Vector | With Layers, sat above it.)
//   4. Privacy & Metadata   a drop-down, shut, its choice on the right (ADR-108)
//   5. Footer      what you'll get ("photo.jpg · 1 image · JPEG" / "3 images ·
//                  JPEG · ZIP") with how compressed it is pushed to the right
//                  ("42% compressed" / "2 of 3 compressed"), the quiet actions
//                  (Share link, Clipboard / Share All · Soon) and ONE solid
//                  primary: Download JPEG / Download ZIP
//
// A recipe (row 2) applies to a raster-format download of either scope (Chris,
// 11-24-2026: "can single image have recipe too"). On Selected it shapes the
// one file — size, format, quality, camera info — and the name stays the
// field's; the extension, the summary and the button follow its format.
//
// Row 1 is the top bar's ToggleButtonGroup in select mode — a radio group,
// one Tab stop, arrow keys. Row 3 is the Shapes picker's ToolButtonGroup
// (stacked, `columns="row"`): ONE radio group across all its groups.
//
// The parent (AppShell) still decides what a download writes from `format`:
// "svg" on All images zips the SVGs, anything else zips in `zipFormat`.
// Picking a tile here therefore just picks that format.
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
import { useGalleryStore } from "@/stores/useGalleryStore";
import { sizeDeltaPercent } from "@/lib/sizeDelta";
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

/** What a recipe's format writes — local copies, because lib/exportImage
 *  pulls in the engine and this dialog imports its types only. */
const RECIPE_EXT: Record<ExportFormat, string> = { jpeg: ".jpg", png: ".png", webp: ".webp", avif: ".avif" };
const RECIPE_LABEL: Record<ExportFormat, string> = { jpeg: "JPEG", png: "PNG", webp: "WebP", avif: "AVIF" };

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
  const pickedRecipe = useZipRecipe();
  const photos = useGalleryStore((s) => s.photos);
  const activePhotoId = useGalleryStore((s) => s.activePhotoId);
  const imageSavings = useGalleryStore((s) => s.imageSavings);
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

  const pickScope = (next: Scope) => {
    setPicked(next);
    // Leaving a kind the new scope cannot have: the parent writes from
    // `format`, so it moves to the raster format too.
    // A plugin format is Selected only too: kept on All it would hide the
    // recipe while the ZIP still used it (camera info included).
    const k = kindOfFormat(format);
    if (
      (next === "all" && (k === "layers" || pluginIds.has(format))) ||
      (k === "vector" && !(next === "selected" ? svg.selected : svg.all > 0))
    ) {
      onFormatChange(zipFormat);
    }
  };

  // ── Row 4's tiles, per kind ────────────────────────────────────────────
  // Each tile is named for its format; `hint` is the line under the row.
  type Tile = {
    id: FormatTileId;
    label: string;
    icon: React.ComponentType;
    title: string;
    hint: string;
    disabled?: boolean;
    groupStart?: boolean;
  };
  const pluginTile = ({ plugin, format: f }: ActiveFormat): Tile => ({
    id: f.id as FormatTileId,
    label: f.label,
    icon: FORMAT_TILE_ICONS[f.id] ?? pluginTileIcon(f.label),
    title: `${f.label} — ${f.hint} (${plugin.name} plugin).`,
    hint: f.hint,
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
  // ONE Format row (11-28-2026, the A/B the 11-24 plan asked for): the
  // groups side by side, JPEG PNG WebP AVIF · SVG · ORA PSD. A group that
  // can't apply is LEFT OUT, the dialog's rule since 11-24: SVG unless an
  // image was uploaded as SVG, the layered files on All (one file at a time).
  const startGroup = (group: Tile[]): Tile[] =>
    group.map((t, i) => (i === 0 ? { ...t, groupStart: true } : t));
  const tiles: Tile[] = [
    ...rasterTiles,
    ...(vectorOn ? startGroup(vectorTiles) : []),
    ...(layersOn ? startGroup(layerTiles) : []),
  ];
  const tileValue: FormatTileId = kind === "raster" ? (kindOfFormat(format) === "raster" ? format : zipFormat) : format;
  const pickedTile = tiles.find((t) => t.id === tileValue);
  const psdOff = kind === "layers" && !pluginIds.has("psd");
  const allSvg = scope === "all" && kind === "vector";
  // A recipe shapes a Raster download in a built-in format; a plugin format
  // writes its own file and takes none.
  const recipeFits = kind === "raster" && !pluginIds.has(tileValue);
  const recipe = recipeFits ? pickedRecipe : null;

  const zipAs = allSvg ? "SVG" : recipe ? recipe.name : zipLabel;
  const zipCount = allSvg ? svg.all : photoCount;
  // On Selected the recipe's format is what gets written.
  const fileExt = scope === "selected" && recipe ? RECIPE_EXT[recipe.format] : ext;
  const primaryLabel = scope === "selected" && recipe ? `Download ${RECIPE_LABEL[recipe.format]}` : downloadLabel;
  // The footer's "what you'll get" line.
  const formatName = recipe ? recipe.name : downloadLabel.replace(/^Download\s+/, "");
  const fileTitle = `${fileName.value.trim() || fileName.defaultStem}${fileExt}`;

  // How compressed it is, on the footer's right: the open image's size against
  // its upload (the gallery badge's number, lib/sizeDelta), or how many of the
  // ZIP's images are smaller than their upload. An SVG ZIP is the uploads as
  // they are, so it says nothing. Neither does a recipe: it re-encodes, so the
  // gallery's number is not what it downloads (QC 11-26-2026).
  const deltaOf = (p: (typeof photos)[number]) => sizeDeltaPercent(p) ?? imageSavings[p.id]?.savingsPercent ?? 0;
  const active = photos.find((p) => p.id === activePhotoId);
  let compressed = "";
  if (recipe) {
    // Left empty: see above.
  } else if (scope === "selected") {
    const d = active ? deltaOf(active) : 0;
    compressed = d > 0 ? `${d}% compressed` : d < 0 ? `${-d}% larger` : "Not compressed";
  } else if (!allSvg) {
    compressed = `${photos.filter((p) => deltaOf(p) > 0).length} of ${photos.length} compressed`;
  }

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

        {/* 2. File Name + Recipe (Selected) or Recipe + Batch settings (All).
            Each image in a ZIP keeps its own name, so All has no name field.
            A recipe is for Raster: an SVG is the uploaded file as it is, a
            layered file is the whole project, and a plugin format writes
            its own file. */}
        {scope === "selected" ? (
          <>
            <ExportFileNameField
              value={fileName.value}
              defaultStem={fileName.defaultStem}
              onChange={fileName.onChange}
              ext={fileExt}
              onSubmit={onDownload}
            />
            {recipeFits && <ZipRecipePicker zipFormat={zipFormat} scope="selected" />}
          </>
        ) : (
          recipeFits && <ZipRecipePicker zipFormat={zipFormat} />
        )}

        {/* 3. Format — ONE row of the Shapes picker's tiles, named for the
            format, grouped raster · vector · layered, and one line saying
            what the picked one is for. There is no Kind row: the groups ARE
            the kinds, and a group that can't apply is left out. */}
        <div className="space-y-2">
          <ToolButtonGroup<FormatTileId>
            aria-label="Format"
            stacked
            columns="row"
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

        {/* 4. Privacy & Metadata (ADR-108), a drop-down. An SVG carries no
            camera info. */}
        {kind !== "vector" && (
          <CameraInfoPicker variant="dropdown" recipeChoice={recipe?.cameraInfo} />
        )}

        {/* 5. Footer: what you'll get, the quiet actions, ONE primary — the
            confirm dialogs' solid "yes, do it" fill. */}
        <div data-slot="export-footer" className={cn(PANEL_DIVIDER, "space-y-3")}>
          {/* What you'll get on the left, how compressed on the right. */}
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 text-2xs text-theme-muted-foreground">
            <p id="export-summary" className="truncate">
              {scope === "selected" ? (
                <>
                  <span className="font-mono text-text-primary">{fileTitle}</span>
                  {` · 1 image · ${formatName}`}
                </>
              ) : (
                `${zipCount} images · ${zipAs} · ZIP`
              )}
            </p>
            {compressed && (
              <p data-testid="export-compressed" className="text-right tabular-nums">
                {compressed}
              </p>
            )}
          </div>
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
                  {primaryLabel}
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
