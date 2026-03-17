// ===== FILE: app/src/features/tools/ToolsSidebar.tsx =====
import { motion } from "framer-motion";
import { X, Wrench, Undo, Redo, Download } from "lucide-react";

import { slideFromLeft } from "@/lib/animations";
import type { ToolType, StampSettings, ToolSettings } from "@/lib/types";

import { ToolGrid } from "./ToolGrid";
import { StampSettings as StampSettingsPanel } from "./settings/StampSettings";
import { TransformCropSettings } from "./settings/TransformCropSettings";
import { ResizeSettings } from "./settings/ResizeSettings";
import { BlurSettings } from "./settings/BlurSettings";
import { ArrowSettings } from "./settings/ArrowSettings";
import { ShapesSettings } from "./settings/ShapeSettings";
import { EmojiSettings } from "./settings/EmojiSettings";

/* ------------------------------------------------------------------ */
/* Props                                                              */
/* ------------------------------------------------------------------ */

interface ToolsSidebarProps {
  onClose: () => void;
  activeTool: ToolType;
  onToolChange: (t: ToolType) => void;
  stampSettings: StampSettings;
  onStampSettingsChange: (s: StampSettings) => void;
  hasSource: boolean;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onExport: () => void;
  canExport: boolean;
  exportFormat: string;
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
}

/* ------------------------------------------------------------------ */
/* Sidebar                                                            */
/* ------------------------------------------------------------------ */

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
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-text-primary font-mono">
          <Wrench className="h-4 w-4 text-white" /> Tools
        </h2>
        <button
          onClick={onClose}
          className="p-1.5 rounded-md hover:bg-bg-elevated transition-colors text-text-muted hover:text-text-primary"
          aria-label="Close tools"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Tool Grid — 10 tools, 5 columns */}
      <div className="p-4 border-b border-border">
        <ToolGrid activeTool={activeTool} onToolChange={onToolChange} />
      </div>

      {/* Active Tool Panel */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {activeTool === "stamp" && (
          <StampSettingsPanel
            settings={stampSettings}
            onChange={onStampSettingsChange}
            hasSource={hasSource}
          />
        )}

        {activeTool === "compress" && (
          <ResizeSettings
            imageWidth={imageWidth}
            imageHeight={imageHeight}
            onResize={onResize}
            quality={quality}
            onQualityChange={onQualityChange}
            disabled={!imageReady}
            hasBeenModified={hasBeenModified}
            compareActive={compareActive}
            onToggleCompare={onToggleCompare}
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

        {/* Coming soon — only tools without panels */}
        {![
          "stamp",
          "compress",
          "crop",
          "blur",
          "arrow",
          "shapes",
          "emoji",
        ].includes(activeTool) && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <span className="text-2xl mb-3">🚧</span>
            <p className="text-xs text-text-muted font-mono">
              {activeTool.toUpperCase()} tool coming soon
            </p>
            <p className="text-[10px] text-text-muted mt-1 opacity-60">
              Powered by Rust / WASM
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

      {/* Undo / Redo */}
      <div className="px-4 pb-4 flex gap-2">
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
    </motion.div>
  );
}
