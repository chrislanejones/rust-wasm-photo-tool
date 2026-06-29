// UI-chrome store: panel/dialog visibility and the compact master-bar tab.
//
// These flags used to be ~15 separate `useState`s in AppShell that got
// prop-drilled into the master bar, sidebars, status bar, and dialogs. Lifting
// them here lets any component subscribe directly (see Grok's blueprint in
// /zustand) and is the first slice of slimming the 3k-line AppShell down.
//
// Lifecycle flags (booting, firstRun) intentionally stay local in AppShell —
// they're wired to boot effects, not UI chrome.
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { resolveSet, type SetArg } from "./_shared";
import { idbStorage } from "./storage/idbStorage";

/** Compact master-bar active tab (≤1000px). */
export type MasterTab = "tools" | "gallery" | "review";

interface UIState {
  showUpload: boolean;
  showTopBar: boolean;
  masterTab: MasterTab;
  showTools: boolean;
  showGallery: boolean;
  showHistory: boolean;
  smallNoticeDismissed: boolean;
  tabletNoticeDismissed: boolean;
  showShortcutModal: boolean;
  showCelebration: boolean;
  showDiagnostics: boolean;
  deleteAllOpen: boolean;
  /** Id of the photo awaiting per-image delete confirmation (null = closed). */
  deletePhotoId: string | null;
  deleteSelectedOpen: boolean;
  exportDialogOpen: boolean;

  setShowUpload: (v: SetArg<boolean>) => void;
  setShowTopBar: (v: SetArg<boolean>) => void;
  setMasterTab: (v: SetArg<MasterTab>) => void;
  setShowTools: (v: SetArg<boolean>) => void;
  setShowGallery: (v: SetArg<boolean>) => void;
  setShowHistory: (v: SetArg<boolean>) => void;
  setSmallNoticeDismissed: (v: SetArg<boolean>) => void;
  setTabletNoticeDismissed: (v: SetArg<boolean>) => void;
  setShowShortcutModal: (v: SetArg<boolean>) => void;
  setShowCelebration: (v: SetArg<boolean>) => void;
  setShowDiagnostics: (v: SetArg<boolean>) => void;
  setDeleteAllOpen: (v: SetArg<boolean>) => void;
  setDeletePhotoId: (v: SetArg<string | null>) => void;
  setDeleteSelectedOpen: (v: SetArg<boolean>) => void;
  setExportDialogOpen: (v: SetArg<boolean>) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
  showUpload: false,
  showTopBar: false,
  masterTab: "tools",
  showTools: false,
  showGallery: false,
  showHistory: false,
  smallNoticeDismissed: false,
  tabletNoticeDismissed: false,
  showShortcutModal: false,
  showCelebration: false,
  showDiagnostics: false,
  deleteAllOpen: false,
  deletePhotoId: null,
  deleteSelectedOpen: false,
  exportDialogOpen: false,

  setShowUpload: (v) => set((s) => ({ showUpload: resolveSet(v, s.showUpload) })),
  setShowTopBar: (v) => set((s) => ({ showTopBar: resolveSet(v, s.showTopBar) })),
  setMasterTab: (v) => set((s) => ({ masterTab: resolveSet(v, s.masterTab) })),
  setShowTools: (v) => set((s) => ({ showTools: resolveSet(v, s.showTools) })),
  setShowGallery: (v) => set((s) => ({ showGallery: resolveSet(v, s.showGallery) })),
  setShowHistory: (v) => set((s) => ({ showHistory: resolveSet(v, s.showHistory) })),
  setSmallNoticeDismissed: (v) =>
    set((s) => ({ smallNoticeDismissed: resolveSet(v, s.smallNoticeDismissed) })),
  setTabletNoticeDismissed: (v) =>
    set((s) => ({ tabletNoticeDismissed: resolveSet(v, s.tabletNoticeDismissed) })),
  setShowShortcutModal: (v) =>
    set((s) => ({ showShortcutModal: resolveSet(v, s.showShortcutModal) })),
  setShowCelebration: (v) =>
    set((s) => ({ showCelebration: resolveSet(v, s.showCelebration) })),
  setShowDiagnostics: (v) =>
    set((s) => ({ showDiagnostics: resolveSet(v, s.showDiagnostics) })),
  setDeleteAllOpen: (v) =>
    set((s) => ({ deleteAllOpen: resolveSet(v, s.deleteAllOpen) })),
  setDeletePhotoId: (v) =>
    set((s) => ({ deletePhotoId: resolveSet(v, s.deletePhotoId) })),
  setDeleteSelectedOpen: (v) =>
    set((s) => ({ deleteSelectedOpen: resolveSet(v, s.deleteSelectedOpen) })),
  setExportDialogOpen: (v) =>
    set((s) => ({ exportDialogOpen: resolveSet(v, s.exportDialogOpen) })),
    }),
    {
      name: "image-horse-ui-v1",
      storage: createJSONStorage(() => idbStorage),
      version: 1,
      // Persist only durable "remember my choice" prefs. Transient flags
      // (dialogs, celebration, diagnostics, upload) are deliberately excluded —
      // persisting them would re-open a modal on reload. See
      // docs/State-Management.md §6.
      partialize: (s): Partial<UIState> => ({
        masterTab: s.masterTab,
        smallNoticeDismissed: s.smallNoticeDismissed,
        tabletNoticeDismissed: s.tabletNoticeDismissed,
      }),
    },
  ),
);
