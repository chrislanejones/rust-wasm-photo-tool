// ===== FILE: app/src/features/tools/ToolsSidebar.tsx =====
// Item 7: "effects" replaces "blur" — includes brightness, contrast, blur
import { motion } from "framer-motion";
import { Download } from "lucide-react";
import { slideFromLeft } from "@/lib/animations";
import type {
  ToolType,
  StampSettings as StampSettingsType,
  ToolSettings,
} from "@/lib/types";
import type { ExportFormat } from "@/app/AppShell";
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
import { PaintSettings } from "./settings/PaintSettings";
import { TextSettings } from "./settings/TextSettings";

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
  activePhotoId: string | null;
  quality: number;
  onQualityChange: (q: number) => void;
  hasBeenModified: boolean;
  compareActive: boolean;
  onToggleCompare: () => void;
  onAutoCompress: () => void;
  isCompressing: boolean;
  compressProgress: { completed: number; total: number };
  onApplyCrop?: () => void;
  toolSettings: ToolSettings;
  onToolSettingsChange: (s: ToolSettings) => void;
  recentTexts: TextMemory[];
  onSelectRecentText: (m: TextMemory) => void;
  onStartTextExtract?: () => void;
  textExtractActive?: boolean;
  recognizedText?: string;
  isRecognizing?: boolean;
  onClearRecognizedText?: () => void;
  // Paint sub-mode (paint vs blur brush)
  brushMode?: "paint" | "blur";
  onBrushModeChange?: (mode: "paint" | "blur") => void;
  // Effects sub-mode + color picker
  effectsMode?: EffectsMode;
  onEffectsModeChange?: (mode: EffectsMode) => void;
  colorPickerActive?: boolean;
  onSetColorPickerActive?: (active: boolean) => void;
  pickedColor?: string;
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
}

export function ToolsSidebar({
  onClose: _onClose,
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
  activePhotoId,
  quality,
  onQualityChange,
  hasBeenModified,
  compareActive,
  onToggleCompare,
  onAutoCompress,
  isCompressing,
  compressProgress,
  onApplyCrop,
  toolSettings,
  onToolSettingsChange,
  recentTexts,
  onSelectRecentText,
  onStartTextExtract,
  textExtractActive,
  recognizedText,
  isRecognizing,
  onClearRecognizedText,
  brushMode,
  onBrushModeChange,
  effectsMode,
  onEffectsModeChange,
  colorPickerActive,
  onSetColorPickerActive,
  pickedColor,
  shapesMode,
  onShapesModeChange,
  stampSubMode,
  onStampSubModeChange,
  stampEmoji,
  stampEmojiSize,
  onStampEmojiChange,
  onStampEmojiSizeChange,
}: ToolsSidebarProps) {
  return (
    <motion.div
      variants={slideFromLeft}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="fixed left-3 top-3 bottom-[48px] z-40 w-[296px] rounded-xl bg-bg-secondary border border-border flex flex-col overflow-hidden"
      style={{
        boxShadow:
          "0 4px 24px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.03)",
      }}
    >
      <div className="p-4 border-b border-border">
        <ToolGrid activeTool={activeTool} onToolChange={onToolChange} />
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5 scrollbar-thin">
        {activeTool === "compress" && (
          <ResizeSettings
            disabled={!imageReady}
            imageWidth={imageWidth}
            imageHeight={imageHeight}
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
          />
        )}

        {activeTool === "crop" && (
          <TransformCropSettings
            disabled={!imageReady}
            onFlipH={onFlipH}
            onFlipV={onFlipV}
            onRotate90Cw={onRotate90Cw}
            onApplyCrop={onApplyCrop}
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
            imageReady={imageReady}
            colorPickerActive={colorPickerActive}
            onSetColorPickerActive={onSetColorPickerActive}
            pickedColor={pickedColor}
            activeMode={effectsMode}
            onModeChange={onEffectsModeChange}
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

        {activeTool === "emoji" && <BatchSettings />}

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
            onStartTextExtract={onStartTextExtract}
            textExtractActive={textExtractActive}
            imageReady={imageReady}
            recognizedText={recognizedText}
            isRecognizing={isRecognizing}
            onClearRecognizedText={onClearRecognizedText}
          />
        )}

        {/* Item 5: AI Panel ideas */}
        {activeTool === "ai" && (
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-text-muted font-mono">
              AI Tools
            </h3>

            {[
              {
                title: "Remove Background",
                desc: "One-click background removal powered by rembg",
                badge: "free",
                icon: "🪄",
              },
              {
                title: "4× Upscale",
                desc: "Enhance resolution with Real-ESRGAN",
                badge: "pro",
                icon: "🔍",
              },
              {
                title: "Object Removal",
                desc: "Brush over objects to remove them with SD Inpaint",
                badge: "pro",
                icon: "🧹",
              },
              {
                title: "Auto Alt Text",
                desc: "Generate accessibility descriptions with BLIP",
                badge: "free",
                icon: "💬",
              },
              {
                title: "Smart Crop",
                desc: "AI-suggested crop regions based on subject detection",
                badge: "pro",
                icon: "✂️",
              },
              {
                title: "Auto-Enhance",
                desc: "One-click brightness/contrast/saturation optimization via WASM histogram analysis",
                badge: "free",
                icon: "✨",
              },
            ].map((feature) => (
              <div
                key={feature.title}
                className="flex items-start gap-3 p-3 rounded-lg bg-bg-elevated/50 border border-border/50 opacity-60"
              >
                <span className="text-lg shrink-0">{feature.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-text-primary">
                      {feature.title}
                    </span>
                    <span
                      className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${
                        feature.badge === "free"
                          ? "bg-emerald-500/20 text-emerald-400"
                          : "bg-violet-500/20 text-violet-400"
                      }`}
                    >
                      {feature.badge}
                    </span>
                  </div>
                  <p className="text-[10px] text-text-muted mt-0.5 leading-relaxed">
                    {feature.desc}
                  </p>
                </div>
              </div>
            ))}

            <p className="text-[10px] text-text-muted/60 text-center pt-2">
              Coming soon — Replicate + Convex pipeline
            </p>
          </div>
        )}
      </div>

      <div className="p-4 border-t border-border flex gap-2">
        <button
          onClick={onExport}
          disabled={!canExport}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold bg-accent text-text-primary hover:brightness-110 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <Download className="h-4 w-4" /> Export {exportFormat.toUpperCase()}
        </button>
        <button
          onClick={onExportAll}
          disabled={!canExport}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold bg-bg-elevated border border-border text-text-secondary hover:text-text-primary hover:border-border-active transition-all disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <Download className="h-4 w-4" /> Export All
        </button>
      </div>
    </motion.div>
  );
}
