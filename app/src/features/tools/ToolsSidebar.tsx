import { motion } from "framer-motion";
import { X, Wrench, Undo, Redo, Download } from "lucide-react";
import { slideFromLeft } from "@/lib/animations";
import type {
  ToolType,
  StampSettings as StampSettingsType,
  ToolSettings,
} from "@/lib/types";
import type { ExportFormat } from "@/app/AppShell";
import type { TextMemory } from "./settings/TextSettings";
import { ToolGrid } from "./ToolGrid";
import * as StampSettingsModule from "./settings/StampSettings";
import { TransformCropSettings } from "./settings/TransformCropSettings";
import { ResizeSettings } from "./settings/ResizeSettings";
import { BlurSettings } from "./settings/BlurSettings";
import { ArrowSettings } from "./settings/ArrowSettings";
import { ShapesSettings } from "./settings/ShapeSettings";
import { EmojiSettings } from "./settings/EmojiSettings";
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
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onExport: () => void;
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
}

export function ToolsSidebar({
  onClose,
  activeTool,
  onToolChange,
  stampSettings,
  onStampSettingsChange,
  hasSource,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onExport,
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
      {/* Tool Grid */}
      <div className="p-4 border-b border-border">
        <ToolGrid activeTool={activeTool} onToolChange={onToolChange} />
      </div>

      {/* Undo / Redo */}
      <div className="flex gap-2 px-4 py-3 border-b border-border">
        <button
          onClick={onUndo}
          disabled={!canUndo}
          className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold font-mono bg-bg-elevated border border-border text-text-secondary hover:border-border-active hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-all"
        >
          <Undo className="h-3.5 w-3.5" /> Undo
        </button>
        <button
          onClick={onRedo}
          disabled={!canRedo}
          className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold font-mono bg-bg-elevated border border-border text-text-secondary hover:border-border-active hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-all"
        >
          <Redo className="h-3.5 w-3.5" /> Redo
        </button>
      </div>

      {/* Tool-specific settings — ONE panel per tool, no cross-contamination */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5 scrollbar-thin">
        {activeTool === "compress" && (
          <ResizeSettings
            disabled={!imageReady}
            imageWidth={imageWidth}
            imageHeight={imageHeight}
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
            onBrightness={onBrightness}
            onContrast={onContrast}
            onApplyCrop={onApplyCrop}
          />
        )}

        {activeTool === "stamp" && StampSettingsPanel && (
          <StampSettingsPanel
            settings={stampSettings}
            onChange={onStampSettingsChange}
            hasSource={hasSource}
          />
        )}

        {activeTool === "blur" && (
          <BlurSettings
            settings={toolSettings}
            onChange={onToolSettingsChange}
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
          />
        )}

        {activeTool === "emoji" && (
          <EmojiSettings
            emoji={toolSettings.emoji}
            emojiSize={toolSettings.emojiSize}
            onEmojiChange={(e) =>
              onToolSettingsChange({ ...toolSettings, emoji: e })
            }
            onSizeChange={(s) =>
              onToolSettingsChange({ ...toolSettings, emojiSize: s })
            }
          />
        )}

        {activeTool === "brush" && (
          <PaintSettings
            settings={toolSettings}
            onChange={onToolSettingsChange}
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

        {activeTool === "ai" && (
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-widest text-text-muted font-mono">
              AI Tools
            </h3>
            <p className="text-xs text-text-muted leading-relaxed">
              AI-powered features coming soon. Background removal, upscaling,
              and inpainting.
            </p>
          </div>
        )}
      </div>

      {/* Export */}
      <div className="p-4 border-t border-border">
        <button
          onClick={onExport}
          disabled={!canExport}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold bg-accent text-text-primary hover:brightness-110 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <Download className="h-4 w-4" /> Export {exportFormat.toUpperCase()}
        </button>
      </div>
    </motion.div>
  );
}
