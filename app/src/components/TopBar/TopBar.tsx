// app/src/components/TopBar/TopBar.tsx
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { slideFromTop, panelSpacingTransition } from "@/lib/animations";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ToggleButtonGroup,
  type ToggleGroupItem,
} from "@/components/ui/toggle-button-group";
import {
  Upload,
  Image,
  Wrench,
  History,
  ZoomIn,
  ZoomOut,
  Undo2,
  Redo2,
} from "lucide-react";
import { UserMenu } from "@/components/UserMenu";

interface TopBarProps {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  showUpload: boolean;
  showTools: boolean;
  showGallery: boolean;
  showHistory: boolean;
  onToggleUpload: () => void;
  onToggleTools: () => void;
  onToggleGallery: () => void;
  onToggleHistory: () => void;
}

export function TopBar({
  zoom,
  onZoomIn,
  onZoomOut,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  showUpload,
  showTools,
  showGallery,
  showHistory,
  onToggleUpload,
  onToggleTools,
  onToggleGallery,
  onToggleHistory,
}: TopBarProps) {
  // Collapse the top bar to icon-only buttons (and drop the zoom %) when space
  // is tight: always under 1000px, and under 1200px when both side panels
  // (toolbar + history) are open and eating the horizontal room.
  const [winWidth, setWinWidth] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth : 1280,
  );
  useEffect(() => {
    const onResize = () => setWinWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  const compact =
    winWidth < 1000 || (winWidth < 1200 && showTools && showHistory);

  const toggleButtons: ToggleGroupItem[] = [
    {
      key: "U",
      icon: Upload,
      label: "Upload",
      active: showUpload,
      onToggle: onToggleUpload,
      tooltip: { label: "Upload", shortcut: "Alt + U" },
    },
    {
      key: "S",
      icon: Wrench,
      label: "Tools",
      active: showTools,
      onToggle: onToggleTools,
      tooltip: { label: "Tools", shortcut: "Alt + S" },
    },
    {
      key: "I",
      icon: Image,
      label: "Gallery",
      active: showGallery,
      onToggle: onToggleGallery,
      tooltip: { label: "Gallery", shortcut: "Alt + G" },
    },
    {
      key: "H",
      icon: History,
      label: "Review",
      active: showHistory,
      onToggle: onToggleHistory,
      tooltip: { label: "Review", shortcut: "Alt + H" },
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
            {/* Undo / Redo */}
            <div className="flex items-center gap-1 p-1 rounded-lg bg-bg-tertiary shrink-0">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={onUndo}
                    disabled={!canUndo}
                    className="btn-icon"
                  >
                    <Undo2 className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p className="font-medium">Undo</p>
                  <p className="text-muted-foreground text-xs">Ctrl+Z</p>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={onRedo}
                    disabled={!canRedo}
                    className="btn-icon"
                  >
                    <Redo2 className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p className="font-medium">Redo</p>
                  <p className="text-muted-foreground text-xs">Ctrl+Shift+Z</p>
                </TooltipContent>
              </Tooltip>
            </div>

            <div className="w-px h-6 bg-border shrink-0" />

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
                  {!compact && (
                    <span className="text-xs font-medium font-mono w-12 text-center tabular-nums text-text-primary">
                      {Math.round(zoom * 100)}%
                    </span>
                  )}
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
              <ToggleButtonGroup items={toggleButtons} compact={compact} />
            </div>

            {/* Clerk User */}
            <div className="w-px h-6 bg-border shrink-0" />
            <UserMenu />
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
