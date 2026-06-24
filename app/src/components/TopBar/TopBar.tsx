// app/src/components/TopBar/TopBar.tsx
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { slideFromTop, panelSpacingTransition } from "@/lib/animations";
import { PANEL_OPEN_GUTTER } from "@/lib/layout";
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
  Search,
  ZoomIn,
  ZoomOut,
  Undo2,
  Redo2,
} from "lucide-react";
import { UserMenu } from "@/components/UserMenu";
import { SubscriptionButton } from "@/components/SubscriptionButton";
import type { SuperUserControls } from "@/components/SuperUserPane";
import type { GeneralControls } from "@/components/GeneralPane";

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
  /** App-wide preferences for the Settings → General tab. */
  general: GeneralControls;
  /** Admin-only: adds the Super User tab to the Settings modal. */
  superUser?: SuperUserControls | null;
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
  general,
  superUser,
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
      key: "N",
      icon: Upload,
      label: "New",
      active: showUpload,
      onToggle: onToggleUpload,
      tooltip: { label: "New", shortcut: "Alt + N" },
    },
    {
      key: "T",
      icon: Wrench,
      label: "Tools",
      active: showTools,
      onToggle: onToggleTools,
      tooltip: { label: "Tools", shortcut: "Alt + T" },
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
      key: "R",
      icon: Search,
      label: "Review",
      active: showHistory,
      onToggle: onToggleHistory,
      tooltip: { label: "Review", shortcut: "Alt + R" },
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
          paddingLeft: showTools ? PANEL_OPEN_GUTTER : 12,
          paddingRight: showHistory ? PANEL_OPEN_GUTTER : 12,
        }}
        transition={panelSpacingTransition}
      >
        <div className="pointer-events-auto">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 py-2.5 bg-bg-secondary/90 backdrop-blur-sm rounded-xl border border-border">
            {/* Left cluster: Undo/Redo + Zoom, anchored left */}
            <div className="flex items-center gap-3 min-w-0">
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
            </div>

            {/* Center cluster: the four panel toggles, flanked by dividers and
                kept dead-centered on the bar by the grid's 1fr/auto/1fr cols. */}
            <div className="flex items-center gap-3">
              <div className="w-px h-6 bg-border shrink-0" />
              <ToggleButtonGroup items={toggleButtons} compact={compact} />
              <div className="w-px h-6 bg-border shrink-0" />
            </div>

            {/* Right cluster: Clerk user menu, anchored right */}
            <div className="flex items-center justify-end gap-1 min-w-0">
              <SubscriptionButton general={general} superUser={superUser} />
              <UserMenu />
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
