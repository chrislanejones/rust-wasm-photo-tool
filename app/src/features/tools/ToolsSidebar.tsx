// ===== FILE: app/src/features/tools/ToolsSidebar.tsx =====
// Item 7: "effects" replaces "blur" — includes brightness, contrast, blur
import { motion } from "framer-motion";
import { Download } from "lucide-react";
import { slideFromLeft } from "@/lib/animations";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type {
  ToolType,
  StampSettings as StampSettingsType,
  ToolSettings,
} from "@/lib/types";
import type { ExportFormat } from "@/lib/exportImage";
import type { StampMode } from "./settings/StampSettings";
import type { ShapesMode } from "./settings/ShapeSettings";
import { ToolGrid } from "./ToolGrid";
import { StampSettingsPanel } from "./settings/StampSettings";
import { TransformCropSettings } from "./settings/TransformCropSettings";
import { LayerSettings } from "./settings/LayerSettings";
import type { SelectionControls } from "./settings/LayerSettings";
import type { PlacementCell } from "@/components/PlacementGrid";
import { ResizeSettings } from "./settings/ResizeSettings";
import { EffectsSettings } from "./settings/EffectsSettings";
import { ShapesSettings } from "./settings/ShapeSettings";
import { BatchSettings } from "./settings/BatchSettings";
import type { PhotoEntry } from "@/features/gallery/GalleryBar";
import type { ImageHorseTool } from "stamp_tool";
import { PaintSettings } from "./settings/PaintSettings";
import { TextSettings } from "./settings/TextSettings";
import { AISettings } from "./settings/AISettings";
import type { AIResultPixels } from "@/hooks/useAIJob";

interface ToolsSidebarProps {
  onClose: () => void;
  activeTool: ToolType;
  onToolChange: (t: ToolType) => void;
  stampSettings: StampSettingsType;
  onStampSettingsChange: (s: StampSettingsType) => void;
  hasSource: boolean;
  /** Place the selected object into one of the nine grid cells (Text / Shape). */
  onPlace?: (cell: PlacementCell) => void;
  /** Kind of the currently-selected object — gates the placement grid to the
   *  matching panel (text grid only when a text is selected, etc.). */
  selectedKind?: "text" | "shape" | null;
  /** Selection Marker (magic-wand) controls — Layer Settings tool. */
  selection?: SelectionControls;
  /** Move-layer toggle — Layer Settings tool. */
  moveActive?: boolean;
  onToggleMove?: () => void;
  /** Embedded mode: render the inner content as a plain flex column (no fixed
   *  positioning / panel chrome / slide animation) so it can fill the compact
   *  master bar's content area instead of floating as its own panel. */
  embedded?: boolean;
  /** Download button: exports the single photo, or opens the chooser dialog
   *  when the gallery holds more than one. */
  onExport: () => void;
  canExport: boolean;
  /** Total photos in the gallery — pluralizes the Download label. */
  photoCount: number;
  exportFormat: ExportFormat;
  onExportFormatChange?: (f: ExportFormat) => void;
  onFlipH: () => void;
  onFlipV: () => void;
  onRotate90Cw: () => void;
  /** "Resize Layer" — see `TransformCropSettingsProps.onResizeLayer`. */
  onResizeLayer?: () => void;
  onBrightness: (delta: number) => void;
  onContrast: (factor: number) => void;
  onSaturation?: (factor: number) => void;
  onShadows?: (amount: number) => void;
  onHighlights?: (amount: number) => void;
  onSharpen?: (amount: number) => void;
  imageReady: boolean;
  /** Apply Compression & Resize (w, h, Rust resampling-filter code). */
  onResize: (newW: number, newH: number, filter: number) => void;
  /** Photoshop-style Canvas Size resize (no resample) — Layer Settings tool. */
  onResizeCanvas: (w: number, h: number) => void;
  imageWidth: number;
  imageHeight: number;
  currentByteSize: number;
  currentMime?: string;
  originalByteSize: number;
  activePhotoId: string | null;
  /** WASM undo count of the active photo (used to re-sync Effects sliders). */
  undoCount: number;
  quality: number;
  onQualityChange: (q: number) => void;
  onToggleCompare: () => void;
  onAutoCompress: (scope: "selected" | "all") => void;
  isCompressing: boolean;
  compressProgress: { completed: number; total: number };
  /** Number of gallery photos currently selected (drives "Compress Selected"). */
  selectedCount: number;
  onApplyCrop?: () => void;
  /** Allows the Crop tool ratio buttons to drop a centred crop selection
   *  computed in Rust. Optional — omit to disable ratio buttons. */
  onSetCropSelection?: (
    sel: { x: number; y: number; width: number; height: number } | null,
  ) => void;
  /** Locked aspect ratio for crop drags. `null` = Free (no constraint). */
  cropRatio?: [number, number] | null;
  onCropRatioChange?: (lock: [number, number] | null) => void;
  toolSettings: ToolSettings;
  onToolSettingsChange: (s: ToolSettings) => void;
  // Paint sub-mode (paint / blur / pen / erase)
  brushMode?: "paint" | "blur" | "pen" | "erase";
  onBrushModeChange?: (mode: "paint" | "blur" | "pen" | "erase") => void;
  // Color Picker — Edit & Transform tool (bottom of the panel).
  colorPickerActive?: boolean;
  onSetColorPickerActive?: (active: boolean) => void;
  pickedColor?: string;
  onGlobalBlur?: (intensity: number) => void;
  // Shapes sub-mode
  shapesMode?: ShapesMode;
  onShapesModeChange?: (mode: ShapesMode) => void;
  // Stamp sub-mode + emoji
  stampSubMode?: StampMode;
  onStampSubModeChange?: (mode: StampMode) => void;
  stampEmoji?: string;
  stampEmojiSize?: number;
  onStampEmojiChange?: (e: string) => void;
  onStampEmojiSizeChange?: (s: number) => void;
  // Bulk-logo (Images / "emoji" tool)
  photos: PhotoEntry[];
  setPhotos: React.Dispatch<React.SetStateAction<PhotoEntry[]>>;
  stampToolRef: React.MutableRefObject<ImageHorseTool | null>;
  flushToCanvas: () => void;
  syncState: () => void;
  /** Whether the current tier may use Replicate AI (Paid only). */
  aiEnabled?: boolean;
  /** Apply a finished AI image result (decoded RGBA) back to the canvas. */
  onAIResult: (r: AIResultPixels) => void;
}

export function ToolsSidebar({
  activeTool,
  onToolChange,
  stampSettings,
  onStampSettingsChange,
  hasSource,
  onPlace,
  selectedKind,
  selection,
  moveActive,
  onToggleMove,
  embedded = false,
  onExport,
  canExport,
  photoCount,
  exportFormat,
  onExportFormatChange,
  onFlipH,
  onFlipV,
  onRotate90Cw,
  onResizeLayer,
  onBrightness,
  onContrast,
  onSaturation,
  onShadows,
  onHighlights,
  onSharpen,
  imageReady,
  onResize,
  onResizeCanvas,
  imageWidth,
  imageHeight,
  currentByteSize,
  currentMime,
  originalByteSize,
  activePhotoId,
  undoCount,
  quality,
  onQualityChange,
  onToggleCompare,
  onAutoCompress,
  isCompressing,
  compressProgress,
  selectedCount,
  onApplyCrop,
  onSetCropSelection,
  cropRatio,
  onCropRatioChange,
  toolSettings,
  onToolSettingsChange,
  brushMode,
  onBrushModeChange,
  colorPickerActive,
  onSetColorPickerActive,
  pickedColor,
  onGlobalBlur,
  shapesMode,
  onShapesModeChange,
  stampSubMode,
  onStampSubModeChange,
  stampEmoji,
  stampEmojiSize,
  onStampEmojiChange,
  onStampEmojiSizeChange,
  photos,
  setPhotos,
  stampToolRef,
  flushToCanvas,
  syncState,
  aiEnabled = false,
  onAIResult,
}: ToolsSidebarProps) {
  return (
    <motion.div
      variants={embedded ? undefined : slideFromLeft}
      initial={embedded ? undefined : "hidden"}
      animate={embedded ? undefined : "visible"}
      exit={embedded ? undefined : "exit"}
      role="region"
      aria-label="Tool options"
      className={
        embedded
          ? // Compact master-bar content box: flush below the chrome (top 56 =
            // top-2 + 48px chrome), filling to the status bar.
            "fixed left-2 top-[56px] bottom-[var(--panel-bottom)] z-[var(--z-panel)] w-[252px] rounded-b-xl border border-t-0 border-border bg-bg-secondary flex flex-col overflow-hidden"
          : "fixed left-3 top-3 bottom-[var(--panel-bottom)] z-[var(--z-panel)] w-[260px] rounded-xl bg-bg-secondary border border-border flex flex-col overflow-hidden"
      }
      style={embedded ? { boxShadow: "var(--shadow-panel)" } : { boxShadow: "var(--shadow-panel)" }}
    >
      {/* No title/close — the 10 tool icons are the only thing in the header. */}
      <div className="px-4 pt-3 pb-4 border-b border-border">
        <ToolGrid
          activeTool={activeTool}
          onToolChange={onToolChange}
          disabledTools={{
            emoji:
              photos.length <= 1
                ? "Upload another image to run a batch edit"
                : false,
          }}
        />
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5 scrollbar-thin">
        {activeTool === "compress" && (
          <ResizeSettings
            disabled={!imageReady}
            imageWidth={imageWidth}
            imageHeight={imageHeight}
            currentByteSize={currentByteSize}
            currentMime={currentMime}
            originalByteSize={originalByteSize}
            activePhotoId={activePhotoId}
            quality={quality}
            onQualityChange={onQualityChange}
            onResize={onResize}
            exportFormat={exportFormat}
            onExportFormatChange={onExportFormatChange ?? (() => {})}
            onToggleCompare={onToggleCompare}
            onAutoCompress={onAutoCompress}
            isCompressing={isCompressing}
            compressProgress={compressProgress}
            selectedCount={selectedCount}
            totalCount={photoCount}
          />
        )}

        {activeTool === "crop" && (
          <TransformCropSettings
            disabled={!imageReady}
            onFlipH={onFlipH}
            onFlipV={onFlipV}
            onRotate90Cw={onRotate90Cw}
            onApplyCrop={onApplyCrop}
            imageWidth={imageWidth}
            imageHeight={imageHeight}
            onSetCropSelection={onSetCropSelection}
            cropRatio={cropRatio ?? null}
            onCropRatioChange={onCropRatioChange ?? (() => {})}
            colorPickerActive={colorPickerActive}
            onSetColorPickerActive={onSetColorPickerActive}
            pickedColor={pickedColor}
          />
        )}

        {activeTool === "stamp" && (
          <StampSettingsPanel
            settings={stampSettings}
            onChange={onStampSettingsChange}
            hasSource={hasSource}
            activeMode={stampSubMode}
            onModeChange={onStampSubModeChange}
            emoji={stampEmoji}
            emojiSize={stampEmojiSize}
            onEmojiChange={onStampEmojiChange}
            onEmojiSizeChange={onStampEmojiSizeChange}
          />
        )}

        {activeTool === "effects" && (
          <EffectsSettings
            settings={toolSettings}
            onChange={onToolSettingsChange}
            onBrightness={onBrightness}
            onContrast={onContrast}
            onGlobalBlur={onGlobalBlur}
            onSaturation={onSaturation}
            onShadows={onShadows}
            onHighlights={onHighlights}
            onSharpen={onSharpen}
            imageReady={imageReady}
            undoCount={undoCount}
            activePhotoId={activePhotoId}
          />
        )}

        {activeTool === "arrow" && selection && (
          <LayerSettings
            disabled={!imageReady}
            moveActive={moveActive ?? false}
            onToggleMove={onToggleMove ?? (() => {})}
            onResizeLayer={onResizeLayer}
            selection={selection}
            imgW={imageWidth}
            imgH={imageHeight}
            canvasWidth={imageWidth}
            canvasHeight={imageHeight}
            onResizeCanvas={onResizeCanvas}
          />
        )}

        {activeTool === "shapes" && (
          <ShapesSettings
            settings={toolSettings}
            onChange={onToolSettingsChange}
            activeMode={shapesMode}
            onModeChange={onShapesModeChange}
            onPlace={onPlace}
            canPlace={selectedKind === "shape"}
          />
        )}

        {activeTool === "emoji" && (
          <BatchSettings
            photos={photos}
            activePhotoId={activePhotoId}
            setPhotos={setPhotos}
            stampToolRef={stampToolRef}
            flushToCanvas={flushToCanvas}
            syncState={syncState}
          />
        )}

        {activeTool === "brush" && (
          <PaintSettings
            settings={toolSettings}
            onChange={onToolSettingsChange}
            activeMode={brushMode}
            onModeChange={onBrushModeChange}
          />
        )}

        {activeTool === "text" && (
          <TextSettings
            settings={toolSettings}
            onChange={onToolSettingsChange}
            onPlace={onPlace}
            canPlace={selectedKind === "text"}
          />
        )}

        {activeTool === "ai" && (
          <AISettings
            aiEnabled={aiEnabled}
            activePhotoId={activePhotoId}
            stampToolRef={stampToolRef}
            onAIResult={onAIResult}
          />
        )}
      </div>

      <div className="p-4 border-t border-border">
        {/* One Download button. With a single photo it downloads directly;
            with several it opens the Selected / All / Cancel chooser (zip).
            Label pluralizes the format when the gallery holds more than one. */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div>
              <Button size="large"
                onClick={onExport}
                disabled={!canExport}
                className="w-full"
              >
                <Download className="h-4 w-4" />
                Download &amp; Share {exportFormat.toUpperCase()}
                {photoCount > 1 ? "s" : ""}
              </Button>
            </div>
          </TooltipTrigger>
          {!canExport && (
            <TooltipContent side="top" className="max-w-[200px] text-center">
              <p className="text-xs">Load an image first.</p>
            </TooltipContent>
          )}
        </Tooltip>
      </div>
    </motion.div>
  );
}
