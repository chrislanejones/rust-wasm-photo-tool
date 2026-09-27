// The chrome around the canvas: the narrow-window drawer scrim, the compact
// master bar (≤1000px) or the wide top bar, and the Tools sidebar — moved out
// of AppShell's return (B3, docs/AppShell-Refactor-Plan.md), together with
// the drawer bookkeeping that decides which panel closes when both open in a
// narrow window. Panel open/closed state is the UI store's; the session
// handlers ToolsSidebar still needs arrive as ONE `tools` object, so a new
// handler is a field on a type, not a prop at every hop.
import { lazy, Suspense, useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useEngineState } from "@/app/session/SessionContext";
import { useUIStore } from "@/stores/useUIStore";
import { fadeIn } from "@/lib/animations";
import { panelsClosable } from "@/lib/layout";
import type { Breakpoint } from "@/lib/useBreakpoint";
import { TopBar } from "@/components/TopBar";
import { ToolsSidebar } from "@/features/tools";
import type { ToolsSidebarProps } from "@/features/tools/ToolsSidebar";
import { UserMenu } from "@/components/UserMenu";
import { SubscriptionButton } from "@/components/SubscriptionButton";
import type { OpenRasterControls } from "@/components/ExportPane";
import type { SuperUserControls } from "@/components/SuperUserPane";
import type { GeneralControls } from "@/components/GeneralPane";
// Code-split: the compact-mode master bar only loads the first time the window
// goes ≤1000px, so desktop sessions never download its chunk.
const MasterBar = lazy(() =>
  import("@/components/master-bar/MasterBar").then((m) => ({
    default: m.MasterBar,
  })),
);

/** The session-owned ToolsSidebar props: everything the dock doesn't decide. */
export type ToolsSidebarSessionProps = Omit<
  ToolsSidebarProps,
  "embedded" | "closable" | "rulersPrefs" | "onRulersChange"
>;

export interface SidebarDockProps {
  bp: Breakpoint;
  /** A start surface covers the workspace — the compact chrome hides. */
  startSurfaceOpen: boolean;
  general: GeneralControls;
  superUser: SuperUserControls | null;
  openRaster: OpenRasterControls;
  onZoomIn: () => void;
  onZoomOut: () => void;
  tools: ToolsSidebarSessionProps;
}

export function SidebarDock({
  bp,
  startSurfaceOpen,
  general,
  superUser,
  openRaster,
  onZoomIn,
  onZoomOut,
  tools,
}: SidebarDockProps) {
  const { ready } = useEngineState();
  const showTopBar = useUIStore((s) => s.showTopBar);
  const masterTab = useUIStore((s) => s.masterTab);
  const setMasterTab = useUIStore((s) => s.setMasterTab);
  const showUpload = useUIStore((s) => s.showUpload);
  const setShowUpload = useUIStore((s) => s.setShowUpload);
  const showTools = useUIStore((s) => s.showTools);
  const setShowTools = useUIStore((s) => s.setShowTools);
  const showHistory = useUIStore((s) => s.showHistory);
  const setShowHistory = useUIStore((s) => s.setShowHistory);
  const setExportDialogOpen = useUIStore((s) => s.setExportDialogOpen);
  const closable = panelsClosable(bp, showTools, showHistory);
  // Most-recently-opened side panel — narrow mode closes the *other* one.
  const lastPanelRef = useRef<"tools" | "history" | null>(null);
  // ── Narrow-window (overlay-drawer) bookkeeping ──────────────────────────
  useEffect(() => {
    if (showTools) lastPanelRef.current = "tools";
  }, [showTools]);
  useEffect(() => {
    if (showHistory) lastPanelRef.current = "history";
  }, [showHistory]);
  // Below BP_NARROW the side panels are overlay drawers that can't coexist —
  // when both end up open, close whichever opened first.
  useEffect(() => {
    if (bp.narrow && showTools && showHistory) {
      if (lastPanelRef.current === "history") setShowTools(false);
      else setShowHistory(false);
    }
  }, [bp.narrow, showTools, showHistory]);

  return (
    <>
      {/* Narrow-window drawer scrim — dims the canvas behind an open side panel
          and click-to-closes it. Sits above the canvas (z 10) but below the top
          bar (30) / panels (40) so all chrome stays bright + interactive. */}
      <AnimatePresence>
        {bp.narrow && !bp.dock && (showTools || showHistory) && (
          <motion.div
            key="drawer-scrim"
            variants={fadeIn}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={() => {
              setShowTools(false);
              setShowHistory(false);
            }}
            className="fixed inset-0 z-[20] bg-black/40"
          />
        )}
      </AnimatePresence>

      {/* Compact master bar (≤1000px): the entire top-bar chrome lives here as
          a left column with Tools/Gallery/Review tabs; the horizontal TopBar is
          hidden in this mode. Lazily loaded — Suspense sits outside
          AnimatePresence so the slide-out still works once the chunk is in. */}
      <Suspense fallback={null}>
        <AnimatePresence>
          {bp.dock && showTopBar && !startSurfaceOpen && (
            <MasterBar
              activeTab={masterTab}
              onTab={setMasterTab}
              onNew={() => setShowUpload(true)}
              newActive={showUpload}
              onExport={() => setExportDialogOpen(true)}
              canExport={ready}
              settingsSlot={
                <SubscriptionButton
                  general={general}
                  superUser={superUser}
                  openRaster={openRaster}
                  // Standalone: the master bar is one flat row with no pills now, so
                  // each control carries its own fill (same as the compact top bar).
                  grouped={false}
                />
              }
              userSlot={<UserMenu grouped={false} />}
            />
          )}
        </AnimatePresence>
      </Suspense>

      <AnimatePresence>
        {!bp.dock && showTopBar && (
          <TopBar
            onZoomIn={onZoomIn}
            onZoomOut={onZoomOut}
            winWidth={bp.width}
            drawerMode={bp.narrow}
            reduceMotion={general.current.reduceMotion}
            general={general}
            superUser={superUser}
            openRaster={openRaster}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {(bp.dock ? masterTab === "tools" && !startSurfaceOpen : showTools) && (
          <ToolsSidebar
            rulersPrefs={general.current}
            onRulersChange={(p) => general.onApply({ ...general.current, ...p })}
            embedded={bp.dock}
            closable={closable}
            {...tools}
          />
        )}
      </AnimatePresence>
    </>
  );
}
