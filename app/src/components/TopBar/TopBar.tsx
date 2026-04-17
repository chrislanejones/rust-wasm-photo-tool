// app/src/components/TopBar/TopBar.tsx
import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { slideFromTop, panelSpacingTransition } from "@/lib/animations";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { ExportFormat } from "@/app/AppShell";
import {
  Upload,
  Image,
  Wrench,
  History,
  Trash2,
  ChevronDown,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { UserMenu } from "@/components/UserMenu";

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

  useEffect(() => {
    if (!formatOpen) return;
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      )
        setFormatOpen(false);
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
      shortcut: "Alt + U",
    },
    {
      key: "S",
      icon: Wrench,
      label: "Tools",
      state: showTools,
      toggle: onToggleTools,
      shortcut: "Alt + S",
    },
    {
      key: "I",
      icon: Image,
      label: "Gallery",
      state: showGallery,
      toggle: onToggleGallery,
      shortcut: "Alt + G",
    },
    {
      key: "H",
      icon: History,
      label: "History",
      state: showHistory,
      toggle: onToggleHistory,
      shortcut: "Alt + H",
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
          paddingRight: showHistory ? 284 : 12,
        }}
        transition={panelSpacingTransition}
      >
        <div className="pointer-events-auto">
          <div className="flex items-center gap-3 px-4 py-2.5 bg-bg-secondary/90 backdrop-blur-sm rounded-xl border border-border">
            {/* Zoom */}
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1 p-1 rounded-lg bg-bg-tertiary shrink-0">
                  <button
                    onClick={onZoomOut}
                    disabled={zoom <= 0.25}
                    className="btn-icon"
                  >
                    <ZoomOut className="h-4 w-4" />
                  </button>
                  <span className="text-sm font-semibold font-mono w-12 text-center tabular-nums text-text-primary">
                    {Math.round(zoom * 100)}%
                  </span>
                  <button
                    onClick={onZoomIn}
                    disabled={zoom >= 4}
                    className="btn-icon"
                  >
                    <ZoomIn className="h-4 w-4" />
                  </button>
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p className="font-medium">Zoom</p>
                <p className="text-muted-foreground text-xs">
                  Alt + Scroll · Alt + / Alt −
                </p>
              </TooltipContent>
            </Tooltip>

            <div className="w-px h-6 bg-border shrink-0" />

            <div className="flex-1 flex justify-center">
              <div className="flex gap-1 p-1 rounded-lg bg-bg-tertiary">
                {toggleButtons.map(
                  ({ key, icon: Icon, label, state, toggle, shortcut }) => (
                    <Tooltip key={key}>
                      <TooltipTrigger asChild>
                        <button
                          onClick={toggle}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold font-mono transition-all ${
                            state
                              ? "bg-accent text-text-primary shadow-md"
                              : "text-text-muted hover:text-text-primary hover:bg-bg-elevated"
                          }`}
                        >
                          <Icon className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">{label}</span>
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">
                        <p className="font-medium">{label}</p>
                        <p className="text-muted-foreground text-xs">
                          {shortcut}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  ),
                )}
              </div>
            </div>

            <div className="w-px h-6 bg-border shrink-0" />

            {/* Export format picker */}
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="relative" ref={dropdownRef}>
                  <button
                    onClick={() => setFormatOpen((v) => !v)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-semibold font-mono bg-bg-elevated border border-border text-text-secondary hover:text-text-primary hover:border-border-active transition-all"
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
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p className="font-medium">Export Format</p>
                <p className="text-muted-foreground text-xs">
                  Choose output format
                </p>
              </TooltipContent>
            </Tooltip>

            {/* Delete All */}
            <Tooltip>
              <TooltipTrigger asChild>
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
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p className="font-medium">Delete All Images</p>
                <p className="text-muted-foreground text-xs">Alt + D</p>
              </TooltipContent>
            </Tooltip>

            {/* Clerk User */}
            <div className="w-px h-6 bg-border shrink-0" />
            <UserMenu />
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
