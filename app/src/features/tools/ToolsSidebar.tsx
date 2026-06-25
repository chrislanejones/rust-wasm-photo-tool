// ===== FILE: app/src/features/tools/ToolsSidebar.tsx =====
// Item 7: "effects" replaces "blur" — includes brightness, contrast, blur
import { motion } from "framer-motion";
import { Download } from "lucide-react";
import { slideFromLeft } from "@/lib/animations";
import { LargeButton } from "@/components/ui/large-button";
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
import type { EffectsMode } from "./settings/EffectsSettings";
import type { StampMode } from "./settings/StampSettings";
import type { ShapesMode } from "./settings/ShapeSettings";
import { ToolGrid } from "./ToolGrid";
import { StampSettingsPanel } from "./settings/StampSettings";
import { TransformCropSettings } from "./settings/TransformCropSettings";
import type { AlignMode, SelectionControls } from "./settings/TransformCropSettings";
import { ResizeSettings } from "./settings/ResizeSettings";
import { EffectsSettings } from "./settings/EffectsSettings";
import { ArrowSettings } from "./settings/ArrowSettings";
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
  /** Align the selected object's bounding box (Edit & Move → Align). */
  onAlign?: (mode: AlignMode) => void;
  /** Whether an object is selected on the canvas (enables the Align row). */
  hasSelection?: boolean;
  /** Select the last-added object's bounding box as the align target. */
  onSelectBoundingBox?: () => void;
  /** Selection Marker (magic-wand) controls. */
  selection?: SelectionControls;
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
  onBrightness: (delta: number) => void;
  onContrast: (factor: number) => void;
  imageReady: boolean;
  /** Apply Compression & Resize (w, h, Rust resampling-filter code). */
  onResize: (newW: number, newH: number, filter: number) => void;
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
  /** EXIF padlock: keep vs strip metadata on export. */
  exifKeep: boolean;
  onExifKeepChange: (keep: boolean) => void;
  hasBeenModified: boolean;
  compareActive: boolean;
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
  // Paint sub-mode (paint vs blur brush)
  brushMode?: "paint" | "blur" | "pen";
  onBrushModeChange?: (mode: "paint" | "blur" | "pen") => void;
  // Effects sub-mode + color picker
  effectsMode?: EffectsMode;
  onEffectsModeChange?: (mode: EffectsMode) => void;
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
  onAlign,
  hasSelection,
  onSelectBoundingBox,
  selection,
  onExport,
  canExport,
  photoCount,
  exportFormat,
  onExportFormatChange,
  onFlipH,
  onFlipV,
  onRotate90Cw,
  onBrightness,
  onContrast,
  imageReady,
  onResize,
  imageWidth,
  imageHeight,
  currentByteSize,
  currentMime,
  originalByteSize,
  activePhotoId,
  undoCount,
  quality,
  onQualityChange,
  exifKeep,
  onExifKeepChange,
  hasBeenModified,
  compareActive,
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
  effectsMode,
  onEffectsModeChange,
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
      variants={slideFromLeft}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="fixed left-3 top-3 bottom-[var(--panel-bottom)] z-[var(--z-panel)] w-[260px] rounded-xl bg-bg-secondary border border-border flex flex-col overflow-hidden"
      style={{
        boxShadow: "var(--shadow-panel)",
      }}
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
            exifKeep={exifKeep}
            onExifKeepChange={onExifKeepChange}
            onResize={onResize}
            exportFormat={exportFormat}
            onExportFormatChange={onExportFormatChange ?? (() => {})}
            compareActive={compareActive}
            onToggleCompare={onToggleCompare}
            hasBeenModified={hasBeenModified}
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
            onAlign={onAlign}
            hasSelection={hasSelection}
            onSelectBoundingBox={onSelectBoundingBox}
            selection={selection}
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
            imageReady={imageReady}
            colorPickerActive={colorPickerActive}
            onSetColorPickerActive={onSetColorPickerActive}
            pickedColor={pickedColor}
            activeMode={effectsMode}
            onModeChange={onEffectsModeChange}
            undoCount={undoCount}
            activePhotoId={activePhotoId}
          />
        )}

        {activeTool === "arrow" && (
          <ArrowSettings
            settings={toolSettings}
            onChange={onToolSettingsChange}
          />
        )}

        {activeTool === "shapes" && (
          <ShapesSettings
            settings={toolSettings}
            onChange={onToolSettingsChange}
            activeMode={shapesMode}
            onModeChange={onShapesModeChange}
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
              <LargeButton
                onClick={onExport}
                disabled={!canExport}
                className="w-full"
              >
                <Download className="h-4 w-4" />
                Download {exportFormat.toUpperCase()}
                {photoCount > 1 ? "s" : ""}
              </LargeButton>
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
