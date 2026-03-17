import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { slideFromTop, panelSpacingTransition } from "@/lib/animations";
import type { ExportFormat } from "@/app/AppShell";
import {
  Upload,
  Image,
  Wrench,
  ZoomIn,
  ZoomOut,
  History,
  Download,
  Trash2,
  ChevronDown,
} from "lucide-react";

const FORMAT_LABELS: Record<ExportFormat, string> = {
  png: "PNG",
  jpeg: "JPEG",
  webp: "WebP",
  avif: "AVIF",
};

interface TopBarProps {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  showUpload: boolean;
  showTools: boolean;
  showGallery: boolean;
  showHistory: boolean;
  showKbdHints: boolean;
  onToggleUpload: () => void;
  onToggleTools: () => void;
  onToggleGallery: () => void;
  onToggleHistory: () => void;
  imageCount: number;
  exportFormat: ExportFormat;
  onExportFormatChange: (f: ExportFormat) => void;
  onExport: () => void;
  hasSelectedImage: boolean;
  onDeleteAll: () => void;
}

export function TopBar({
  zoom,
  onZoomIn,
  onZoomOut,
  showUpload,
  showTools,
  showGallery,
  showHistory,
  showKbdHints,
  onToggleUpload,
  onToggleTools,
  onToggleGallery,
  onToggleHistory,
  imageCount,
  exportFormat,
  onExportFormatChange,
  onExport,
  hasSelectedImage,
  onDeleteAll,
}: TopBarProps) {
  const [formatOpen, setFormatOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!formatOpen) return;
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setFormatOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [formatOpen]);

  const toggleButtons = [
    {
      key: "U",
      icon: Upload,
      label: "Upload",
      state: showUpload,
      toggle: onToggleUpload,
      shortcut: "Alt U",
    },
    {
      key: "S",
      icon: Wrench,
      label: "Tools",
      state: showTools,
      toggle: onToggleTools,
      shortcut: "Alt S",
    },
    {
      key: "I",
      icon: Image,
      label: "Gallery",
      state: showGallery,
      toggle: onToggleGallery,
      shortcut: "Alt G",
    },
    {
      key: "H",
      icon: History,
      label: "History",
      state: showHistory,
      toggle: onToggleHistory,
      shortcut: "Alt H",
    },
  ];

  return (
    <motion.div
      variants={slideFromTop}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="fixed top-3 left-0 right-0 z-30 pointer-events-none"
    >
      <motion.div
        animate={{
          paddingLeft: showTools ? 320 : 12,
          paddingRight: showHistory ? 244 : 12,
        }}
        transition={panelSpacingTransition}
      >
        <div className="pointer-events-auto">
          <div className="flex items-center gap-3 px-4 py-2.5 bg-bg-secondary/90 backdrop-blur-sm rounded-xl border border-border">
            {/* ── Zoom ─────────────────────────────────────────────── */}
            <div className="flex items-center gap-1 p-1 rounded-lg bg-bg-tertiary shrink-0">
              <button
                onClick={onZoomOut}
                disabled={zoom <= 0.25}
                className="btn-icon"
              >
                <ZoomOut className="h-4 w-4" />
              </button>
              <div className="flex flex-col items-center leading-none px-2">
                <span className="text-sm font-semibold font-mono w-12 text-center tabular-nums text-text-primary">
                  {Math.round(zoom * 100)}%
                </span>
                {showKbdHints && (
                  <kbd className="text-[9px] mt-0.5 px-1">Alt Scroll</kbd>
                )}
              </div>
              <button
                onClick={onZoomIn}
                disabled={zoom >= 4}
                className="btn-icon"
              >
                <ZoomIn className="h-4 w-4" />
              </button>
            </div>

            <div className="w-px h-6 bg-border shrink-0" />

            {/* ── Panel Toggles (center, takes remaining space) ──── */}
            <div className="flex-1 flex justify-center">
              <div className="flex gap-1 p-1 rounded-lg bg-bg-tertiary">
                {toggleButtons.map(
                  ({ key, icon: Icon, label, state, toggle, shortcut }) => (
                    <button
                      key={key}
                      onClick={toggle}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold font-mono transition-all ${
                        state
                          ? "bg-accent text-text-primary shadow-md"
                          : "text-text-muted hover:text-text-primary hover:bg-bg-elevated"
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">{label}</span>
                      {showKbdHints && (
                        <kbd className="hidden sm:inline text-[9px] px-1 ml-0.5 opacity-70">
                          {shortcut}
                        </kbd>
                      )}
                    </button>
                  ),
                )}
              </div>
            </div>

            <div className="w-px h-6 bg-border shrink-0" />

            {/* ── Right: export + delete ──────────── */}
            <div className="flex items-center gap-2 shrink-0">
              {/* Export buttons group */}
              <div
                className="flex gap-1 p-1 rounded-lg bg-bg-tertiary"
                ref={dropdownRef}
              >
                {/* Format selector */}
                <div className="relative">
                  <button
                    onClick={() => setFormatOpen((v) => !v)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-semibold font-mono text-text-muted hover:text-text-primary hover:bg-bg-elevated transition-all"
                  >
                    {FORMAT_LABELS[exportFormat]}
                    <ChevronDown className="h-3 w-3 opacity-50" />
                  </button>
                  {formatOpen && (
                    <div className="absolute top-full left-0 mt-1 bg-bg-secondary border border-border rounded-lg shadow-lg overflow-hidden z-50 min-w-[80px]">
                      {(Object.keys(FORMAT_LABELS) as ExportFormat[]).map(
                        (fmt) => (
                          <button
                            key={fmt}
                            onClick={() => {
                              onExportFormatChange(fmt);
                              setFormatOpen(false);
                            }}
                            className={`w-full px-3 py-1.5 text-left text-xs font-mono transition-colors ${
                              fmt === exportFormat
                                ? "bg-accent text-text-primary"
                                : "text-text-secondary hover:bg-bg-elevated"
                            }`}
                          >
                            {FORMAT_LABELS[fmt]}
                          </button>
                        ),
                      )}
                    </div>
                  )}
                </div>
                {/* Export button */}
                <button
                  onClick={onExport}
                  disabled={!hasSelectedImage}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold font-mono bg-accent text-text-primary shadow-md disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Export</span>
                </button>
              </div>

              {/* Delete all - separate button */}
              <button
                onClick={onDeleteAll}
                disabled={imageCount === 0}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-bg-elevated border border-border text-text-muted hover:text-red-400 hover:border-border-active disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                title="Delete all images"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline text-xs font-semibold font-mono">
                  Delete All
                </span>
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
