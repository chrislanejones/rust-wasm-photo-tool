// app/src/components/TopBar/TopBar.tsx
import { motion } from "framer-motion";
import { slideFromTop, panelSpacingTransition, instantTransition } from "@/lib/animations";
import { PANEL_OPEN_GUTTER, BP_COMPACT, BP_TIGHT } from "@/lib/layout";
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
  BookOpenCheck,
  Download,
  ZoomIn,
  ZoomOut,
  Undo2,
  Redo2,
} from "lucide-react";
import { IconButton } from "@/components/ui/icon-button";
import { UserMenu } from "@/components/UserMenu";
import { SubscriptionButton } from "@/components/SubscriptionButton";
import type { SuperUserControls } from "@/components/SuperUserPane";
import type { GeneralControls } from "@/components/GeneralPane";
import type { OpenRasterControls } from "@/components/ExportPane";

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
  /** Export — the fifth item in the cluster and the only ACTION in it: it
   *  fires the download rather than toggling a panel, so it never renders
   *  active. It replaced the Tools panel's full-width "Download & Share
   *  {FORMAT}" footer, which took a whole row of the sidebar for one button. */
  onExport: () => void;
  canExport: boolean;
  /** Shared window width (from useBreakpoint) — drives the compact / narrow
   *  collapse; TopBar no longer owns a resize listener. */
  winWidth: number;
  /** Side panels are overlay drawers (window < BP_NARROW) — when true the bar
   *  stays full-bleed instead of padding to clear the panels. */
  drawerMode: boolean;
  /** Reduce Motion — make the panel-clearance padding snap instantly. */
  reduceMotion?: boolean;
  /** App-wide preferences for the Settings → General tab. */
  general: GeneralControls;
  /** Admin-only: adds the Super User tab to the Settings modal. */
  superUser?: SuperUserControls | null;
  /** Live-tool access for the Settings → Import / Export (.ora) tab. */
  openRaster: OpenRasterControls;
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
  onExport,
  canExport,
  onToggleUpload,
  onToggleTools,
  onToggleGallery,
  onToggleHistory,
  winWidth,
  drawerMode,
  reduceMotion,
  general,
  superUser,
  openRaster,
}: TopBarProps) {
  // Collapse the top bar to icon-only buttons (and drop the zoom %) when space
  // is tight: always under BP_COMPACT, and under BP_TIGHT when both side panels
  // (toolbar + history) are open and eating the horizontal room. Below
  // BP_COMPACT (`narrow`) we also drop Undo/Redo entirely — they live in the
  // Review panel (and Ctrl+Z) — leaving Zoom as the left cluster.
  const narrow = winWidth < BP_COMPACT;
  const compact =
    narrow || (winWidth < BP_TIGHT && showTools && showHistory);

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
      icon: BookOpenCheck,
      label: "Review",
      active: showHistory,
      onToggle: onToggleHistory,
      tooltip: { label: "Review", shortcut: "Alt + R" },
    },
    // The odd one out, deliberately: an ACTION in a group of toggles. It never
    // reports active — there is no "export mode" to be in — and disables
    // instead when there is nothing loaded to export.
    {
      key: "E",
      icon: Download,
      label: "Export",
      active: false,
      onToggle: onExport,
      disabled: !canExport,
      tooltip: { label: "Export", shortcut: "Alt + E" },
    },
  ];

  return (
    <motion.div
      variants={slideFromTop}
      initial="hidden"
      animate="visible"
      exit="exit"
      role="toolbar"
      aria-label="Editor controls"
      className="fixed top-3 left-0 right-0 z-[var(--z-topbar)] pointer-events-none"
    >
      <motion.div
        animate={{
          paddingLeft: !drawerMode && showTools ? PANEL_OPEN_GUTTER : 12,
          paddingRight: !drawerMode && showHistory ? PANEL_OPEN_GUTTER : 12,
        }}
        transition={reduceMotion ? instantTransition : panelSpacingTransition}
      >
        <div className="pointer-events-auto">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 py-2.5 bg-bg-secondary/90 backdrop-blur-sm rounded-xl border border-border">
            {/* Left cluster: Undo/Redo + Zoom, anchored left. Below BP_COMPACT
                Undo/Redo drop out (they live in the Review panel + Ctrl+Z),
                leaving Zoom as the left cluster. */}
            <div className="flex items-center gap-3 min-w-0">
            {!narrow && (
              <>
                {/* Undo / Redo — see the shape note on the Zoom group below. */}
                <div className="flex items-center gap-1 p-1 rounded-lg bg-bg-tertiary shrink-0">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <IconButton
                        icon={Undo2}
                        label="Undo"
                        onClick={onUndo}
                        disabled={!canUndo}
                      />
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      <p className="font-semibold">Undo</p>
                      <p className="text-muted-foreground text-xs">Ctrl+Z</p>
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <IconButton
                        icon={Redo2}
                        label="Redo"
                        onClick={onRedo}
                        disabled={!canRedo}
                      />
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      <p className="font-semibold">Redo</p>
                      <p className="text-muted-foreground text-xs">Ctrl+Shift+Z</p>
                    </TooltipContent>
                  </Tooltip>
                </div>

                <div className="w-px h-6 bg-border shrink-0" />
              </>
            )}

            {/* Zoom */}
            <Tooltip>
              <TooltipTrigger asChild>
                {/* THE REVIEW PANEL'S SECTION TOGGLES ARE THE REFERENCE for
                    every group in this bar (Chris, 2026-08-20). All four —
                    Undo/Redo, this one, the New/Tools/Gallery/Review toggles
                    and the cog/user pair — are that group's container copied
                    literally, `p-1 rounded-lg bg-bg-tertiary`, holding its
                    30px `rounded-md` buttons. The bar used to run three radii
                    and two heights across four clusters; one box is what makes
                    it read as a single object rather than four adjacent
                    widgets. Note the buttons and their container do NOT share
                    a radius, and should not: 6px inside 10px is the nesting,
                    and it is the panel's, not an invention here. */}
                <div className="flex items-center gap-1 p-1 rounded-lg bg-bg-tertiary shrink-0">
                  <IconButton
                    icon={ZoomOut}
                    label="Zoom out"
                    onClick={onZoomOut}
                    disabled={zoom <= 0.25}
                  />
                  {/* Show the % whenever there's room: wide, or narrow (where
                      Undo/Redo dropped out and freed space). Hidden only in the
                      cramped BP_TIGHT case (both side panels open, 1000–1200). */}
                  {(narrow || !compact) && (
                    <span className="text-xs font-semibold font-mono w-12 text-center tabular-nums text-text-primary">
                      {Math.round(zoom * 100)}%
                    </span>
                  )}
                  <IconButton
                    icon={ZoomIn}
                    label="Zoom in"
                    onClick={onZoomIn}
                    disabled={zoom >= 4}
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p className="font-semibold">Zoom</p>
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

            {/* Right cluster: Settings + Clerk user menu, anchored right.
                These two used to float loose against the bar background while
                every other control sat in a group — the same near-miss the
                toggle group had, one channel over. They are a group now: same
                `p-1 rounded-lg bg-bg-tertiary` container as Undo/Redo and
                Zoom, and `grouped` turns off their standalone fill so the
                container's own shows through. */}
            <div className="flex items-center justify-end min-w-0">
              <div className="flex items-center gap-1 p-1 rounded-lg bg-bg-tertiary shrink-0">
                <SubscriptionButton
                  general={general}
                  superUser={superUser}
                  openRaster={openRaster}
                  grouped
                />
                <UserMenu grouped />
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
