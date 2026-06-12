// ===== FILE: app/src/features/tools/ToolsSidebar.tsx =====
// Item 7: "effects" replaces "blur" — includes brightness, contrast, blur
import { motion } from "framer-motion";
import { Download, Wrench, X } from "lucide-react";
import { slideFromLeft } from "@/lib/animations";
import { LargeButton } from "@/components/ui/large-button";
import { TinyButton } from "@/components/ui/tiny-button";
import type {
  ToolType,
  StampSettings as StampSettingsType,
  ToolSettings,
} from "@/lib/types";
import type { ExportFormat } from "@/lib/exportImage";
import type { TextMemory } from "./settings/TextSettings";
import type { EffectsMode } from "./settings/EffectsSettings";
import type { StampMode } from "./settings/StampSettings";
import type { ShapesMode } from "./settings/ShapeSettings";
import { ToolGrid } from "./ToolGrid";
import * as StampSettingsModule from "./settings/StampSettings";
import { TransformCropSettings } from "./settings/TransformCropSettings";
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

const StampSettingsPanel =
  (StampSettingsModule as any).StampSettingsPanel ??
  (StampSettingsModule as any).StampSettings ??
  (StampSettingsModule as any).default;

interface ToolsSidebarProps {
  onClose: () => void;
  activeTool: ToolType;
  onToolChange: (t: ToolType) => void;
  stampSettings: StampSettingsType;
  onStampSettingsChange: (s: StampSettingsType) => void;
  hasSource: boolean;
  onExport: () => void;
  onExportAll: () => void;
  canExport: boolean;
  exportFormat: ExportFormat;
  onExportFormatChange?: (f: ExportFormat) => void;
  onFlipH: () => void;
  onFlipV: () => void;
  onRotate90Cw: () => void;
  onBrightness: (delta: number) => void;
  onContrast: (factor: number) => void;
  imageReady: boolean;
  onResize: (newW: number, newH: number) => void;
  imageWidth: number;
  imageHeight: number;
  currentByteSize: number;
  originalByteSize: number;
  activePhotoId: string | null;
  /** WASM undo count of the active photo (used to re-sync Effects sliders). */
  undoCount: number;
  quality: number;
  onQualityChange: (q: number) => void;
  hasBeenModified: boolean;
  compareActive: boolean;
  onToggleCompare: () => void;
  onAutoCompress: () => void;
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
  recentTexts: TextMemory[];
  onSelectRecentText: (m: TextMemory) => void;
  // Paint sub-mode (paint vs blur brush)
  brushMode?: "paint" | "blur";
  onBrushModeChange?: (mode: "paint" | "blur") => void;
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
}

export function ToolsSidebar({
  onClose,
  activeTool,
  onToolChange,
  stampSettings,
  onStampSettingsChange,
  hasSource,
  onExport,
  onExportAll,
  canExport,
  exportFormat,
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
  originalByteSize,
  activePhotoId,
  undoCount,
  quality,
  onQualityChange,
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
  recentTexts,
  onSelectRecentText,
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
}: ToolsSidebarProps) {
  return (
    <motion.div
      variants={slideFromLeft}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="fixed left-3 top-3 bottom-[48px] z-40 w-[296px] max-[999px]:w-[260px] rounded-xl bg-bg-secondary border border-border flex flex-col overflow-hidden"
      style={{
        boxShadow:
          "0 4px 24px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.03)",
      }}
    >
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <h2 className="flex items-center gap-2 text-xs font-semibold">
          <Wrench className="h-3.5 w-3.5" />
          Toolbar
        </h2>
        <TinyButton onClick={onClose} title="Close toolbar">
          <X className="h-4 w-4" />
        </TinyButton>
      </div>

      <div className="px-4 pb-4 border-b border-border">
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
            originalByteSize={originalByteSize}
            activePhotoId={activePhotoId}
            quality={quality}
            onQualityChange={onQualityChange}
            onResize={onResize}
            compareActive={compareActive}
            onToggleCompare={onToggleCompare}
            hasBeenModified={hasBeenModified}
            onAutoCompress={onAutoCompress}
            isCompressing={isCompressing}
            compressProgress={compressProgress}
            selectedCount={selectedCount}
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
          />
        )}

        {activeTool === "stamp" && StampSettingsPanel && (
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
            recentTexts={recentTexts}
            onSelectRecentText={onSelectRecentText}
          />
        )}

        {activeTool === "ai" && <AISettings />}
      </div>

      <div className="p-4 border-t border-border flex gap-2">
        <LargeButton onClick={onExport} disabled={!canExport} className="flex-1">
          <Download className="h-4 w-4" /> Export {exportFormat.toUpperCase()}
        </LargeButton>
        <LargeButton onClick={onExportAll} disabled={!canExport} className="flex-1">
          <Download className="h-4 w-4" /> Export All
        </LargeButton>
      </div>
    </motion.div>
  );
}
