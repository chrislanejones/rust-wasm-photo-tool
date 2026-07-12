// UI-chrome store: panel/dialog visibility and the compact master-bar tab.
//
// These flags used to be ~15 separate `useState`s in AppShell that got
// prop-drilled into the master bar, sidebars, status bar, and dialogs. Lifting
// them here lets any component subscribe directly (see Grok's blueprint in
// /zustand) and is the first slice of slimming the 3k-line AppShell down.
//
// Boot/lifecycle flags (booting, firstRun), the image-load indicator
// (isImageLoading/loadProgress + the fake-progress interval, encapsulated in the
// startImageLoad/finishImageLoad action pair), the A/B compare view state
// (compareActive/originalUrl), the spacebar pan flag (isPanning), and the
// resolved auth tier (userMode/authResolved/devTierOverride) also live here now —
// evicted from AppShell's local useState in the stage-1 dismantle.
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { resolveSet, type SetArg } from "./_shared";
import { idbStorage } from "./storage/idbStorage";
import type { UserMode } from "@/components/StatusBar";
import type { SettingsTab } from "@/components/SubscriptionButton";

// Module-scoped handles for the fake image-load progress interval and the
// hide-after-finish timer. Kept out of store state (they're imperative timer
// ids, not render inputs) — mirrors the loadIntervalRef AppShell used to hold.
let loadInterval: ReturnType<typeof setInterval> | null = null;
let finishTimer: ReturnType<typeof setTimeout> | null = null;

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
  /** Command palette (Alt+,). Transient — never persisted. */
  showCommandPalette: boolean;
  /** Most-recently-run palette command ids, newest first (persisted — drives
   *  the "Recent" group shown when the palette query is empty). */
  recentCommands: string[];
  /** One-shot "open the Settings modal on tab X" request. SubscriptionButton
   *  (the modal's owner) handles it and clears it — the store-routed
   *  replacement for the grandfathered `image-horse:open-settings`
   *  CustomEvent. Transient — never persisted. */
  settingsRequest: { tab: SettingsTab } | null;

  // Cold-start boot splash: true until WASM is up + the session check resolves.
  booting: boolean;
  // True until the user first enters the editor (a photo becomes active).
  firstRun: boolean;
  // Image-load indicator (top progress bar + New/Upload spinners).
  isImageLoading: boolean;
  loadProgress: number;
  // A/B compare: the "before" original blob URL + whether the slider is on.
  originalUrl: string | null;
  compareActive: boolean;
  // Spacebar-held pan mode.
  isPanning: boolean;
  // Resolved auth tier + the Super-User client-side override.
  userMode: UserMode;
  authResolved: boolean;
  devTierOverride: UserMode | null;

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
  setShowCommandPalette: (v: SetArg<boolean>) => void;
  /** Record a palette command run: dedupes, caps at 8. */
  pushRecentCommand: (id: string) => void;
  /** Ask the Settings modal to open on `tab` (default "general"). */
  requestSettings: (tab?: SettingsTab) => void;
  clearSettingsRequest: () => void;

  setBooting: (v: SetArg<boolean>) => void;
  setFirstRun: (v: SetArg<boolean>) => void;
  setIsImageLoading: (v: SetArg<boolean>) => void;
  setLoadProgress: (v: SetArg<number>) => void;
  /** Begin the fake-progress indicator: reset to 0, tick up toward 90%. */
  startImageLoad: () => void;
  /** Finish it: snap to 100%, then hide + reset after a short beat. */
  finishImageLoad: () => void;
  setOriginalUrl: (v: SetArg<string | null>) => void;
  setCompareActive: (v: SetArg<boolean>) => void;
  setIsPanning: (v: SetArg<boolean>) => void;
  setUserMode: (v: SetArg<UserMode>) => void;
  setAuthResolved: (v: SetArg<boolean>) => void;
  setDevTierOverride: (v: SetArg<UserMode | null>) => void;
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
      showCommandPalette: false,
      recentCommands: [],
      settingsRequest: null,

      booting: true,
      firstRun: true,
      isImageLoading: false,
      loadProgress: 0,
      originalUrl: null,
      compareActive: false,
      isPanning: false,
      userMode: "demo",
      authResolved: false,
      devTierOverride: null,

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
      setShowCommandPalette: (v) =>
        set((s) => ({ showCommandPalette: resolveSet(v, s.showCommandPalette) })),
      pushRecentCommand: (id) =>
        set((s) => ({
          recentCommands: [id, ...s.recentCommands.filter((x) => x !== id)].slice(0, 8),
        })),
      requestSettings: (tab = "general") => set({ settingsRequest: { tab } }),
      clearSettingsRequest: () => set({ settingsRequest: null }),

      setBooting: (v) => set((s) => ({ booting: resolveSet(v, s.booting) })),
      setFirstRun: (v) => set((s) => ({ firstRun: resolveSet(v, s.firstRun) })),
      setIsImageLoading: (v) =>
        set((s) => ({ isImageLoading: resolveSet(v, s.isImageLoading) })),
      setLoadProgress: (v) =>
        set((s) => ({ loadProgress: resolveSet(v, s.loadProgress) })),
      startImageLoad: () => {
        if (loadInterval) clearInterval(loadInterval);
        if (finishTimer) {
          clearTimeout(finishTimer);
          finishTimer = null;
        }
        set({ isImageLoading: true, loadProgress: 0 });
        loadInterval = setInterval(() => {
          set((s) => ({
            loadProgress: s.loadProgress >= 90 ? 90 : s.loadProgress + Math.random() * 15,
          }));
        }, 100);
      },
      finishImageLoad: () => {
        if (loadInterval) {
          clearInterval(loadInterval);
          loadInterval = null;
        }
        set({ loadProgress: 100 });
        if (finishTimer) clearTimeout(finishTimer);
        finishTimer = setTimeout(() => {
          set({ isImageLoading: false, loadProgress: 0 });
          finishTimer = null;
        }, 500);
      },
      setOriginalUrl: (v) => set((s) => ({ originalUrl: resolveSet(v, s.originalUrl) })),
      setCompareActive: (v) =>
        set((s) => ({ compareActive: resolveSet(v, s.compareActive) })),
      setIsPanning: (v) => set((s) => ({ isPanning: resolveSet(v, s.isPanning) })),
      setUserMode: (v) => set((s) => ({ userMode: resolveSet(v, s.userMode) })),
      setAuthResolved: (v) =>
        set((s) => ({ authResolved: resolveSet(v, s.authResolved) })),
      setDevTierOverride: (v) =>
        set((s) => ({ devTierOverride: resolveSet(v, s.devTierOverride) })),
    }),
    {
      name: "image-horse-ui-v1",
      storage: createJSONStorage(() => idbStorage),
      version: 1,
      // Persist ONLY the master-bar tab — a pure "remember my last view" pref.
      // The notice-dismissed flags are deliberately NOT persisted: they're
      // session/stretch-scoped by design (re-armed on resize — see the bp
      // effects in AppShell), so persisting them would contradict that intent.
      // Transient dialog / celebration / diagnostics / upload flags are excluded
      // for the obvious reason (they'd re-open on reload). See
      // docs/State-Management.md §6.
      partialize: (s): Partial<UIState> => ({
        masterTab: s.masterTab,
        // Palette recents are a pure "remember my habits" pref, same class as
        // masterTab. The palette OPEN flag stays transient.
        recentCommands: s.recentCommands,
      }),
    },
  ),
);
