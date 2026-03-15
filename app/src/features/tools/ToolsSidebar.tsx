import { motion } from "framer-motion";
import { X, Wrench, Undo, Redo, Download } from "lucide-react";

import { slideFromLeft } from "@/lib/animations";
import type { ToolType, StampSettings } from "@/lib/types";

import { ToolGrid } from "./ToolGrid";
import { StampSettings as StampSettingsPanel } from "./settings/StampSettings";

/* ------------------------------------------------------------------ */
/* Props                                                              */
/* ------------------------------------------------------------------ */

interface ToolsSidebarProps {
  onClose: () => void;
  activeTool: ToolType;
  onToolChange: (t: ToolType) => void;

  // Stamp settings
  stampSettings: StampSettings;
  onStampSettingsChange: (s: StampSettings) => void;
  hasSource: boolean;

  // History
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;

  // Export
  onExport: () => void;
  canExport: boolean;
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
}: ToolsSidebarProps) {
  return (
    <motion.div
      variants={slideFromLeft}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="
        fixed left-3 top-3 bottom-[48px] z-40
        w-[296px] rounded-xl
        bg-[var(--bg-secondary)] border border-[var(--border)]
        flex flex-col overflow-hidden
      "
      style={{
        boxShadow: "0 4px 24px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.03)",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)] font-mono">
          <Wrench className="h-4 w-4 text-[var(--accent)]" />
          Tools
        </h2>
        <button
          onClick={onClose}
          className="p-1.5 rounded-md hover:bg-[var(--bg-elevated)] transition-colors text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          aria-label="Close tools"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Tool Grid */}
      <div className="p-4 border-b border-[var(--border)]">
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

        {/* Placeholder for non-stamp tools */}
        {activeTool !== "stamp" && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <span className="text-2xl mb-3">🚧</span>
            <p className="text-xs text-[var(--text-muted)] font-mono">
              {activeTool.toUpperCase()} tool coming soon
            </p>
            <p className="text-[10px] text-[var(--text-muted)] mt-1 opacity-60">
              Powered by Rust / WASM
            </p>
          </div>
        )}
      </div>

      {/* Export */}
      <div className="p-4 border-t border-[var(--border)]">
        <button
          onClick={onExport}
          disabled={!canExport}
          className="
            w-full flex items-center justify-center gap-2 py-2.5 rounded-lg
            text-sm font-semibold
            bg-[var(--accent)] text-[var(--accent-foreground)]
            hover:brightness-110 transition-all
            disabled:opacity-30 disabled:cursor-not-allowed
          "
        >
          <Download className="h-4 w-4" />
          Export PNG
        </button>
      </div>

      {/* Undo / Redo */}
      <div className="px-4 pb-4 flex gap-2">
        <button
          onClick={onUndo}
          disabled={!canUndo}
          className="
            flex-1 flex items-center justify-center gap-2 py-2 rounded-lg
            text-xs font-semibold font-mono
            bg-[var(--bg-elevated)] border border-[var(--border)]
            text-[var(--text-secondary)]
            hover:border-[var(--border-active)] hover:text-[var(--text-primary)]
            disabled:opacity-30 disabled:cursor-not-allowed transition-all
          "
        >
          <Undo className="h-3.5 w-3.5" />
          Undo
        </button>
        <button
          onClick={onRedo}
          disabled={!canRedo}
          className="
            flex-1 flex items-center justify-center gap-2 py-2 rounded-lg
            text-xs font-semibold font-mono
            bg-[var(--bg-elevated)] border border-[var(--border)]
            text-[var(--text-secondary)]
            hover:border-[var(--border-active)] hover:text-[var(--text-primary)]
            disabled:opacity-30 disabled:cursor-not-allowed transition-all
          "
        >
          <Redo className="h-3.5 w-3.5" />
          Redo
        </button>
      </div>
    </motion.div>
  );
}
