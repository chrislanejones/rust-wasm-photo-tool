// ===== FILE: app/src/app/AppShell.tsx =====
// Changes:
//   Item 2: Spacebar pan mode
//   Item 4: PgUp/PgDn gallery cycling
//   Item 7: blur → effects rename, brightness/contrast in effects panel
//   All other existing functionality preserved
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useUser } from "@clerk/clerk-react";
import { useStoreUser } from "@/hooks/useStoreUser";
import { AnimatePresence, motion } from "framer-motion";
import { useCloneStamp } from "@/hooks/useCloneStamp";
import { useBrushPreview } from "@/hooks/useBrushPreview";
import { useDrawingTools } from "@/hooks/useDrawingTools";
import { useEmojiTool } from "@/hooks/useEmojiTool";
import { usePaintTool } from "@/hooks/usePaintTool";
import { useTextTool } from "@/hooks/useTextTool";
import { useRedStampTool } from "@/hooks/useRedStampTool";
import type { ToolType, StampSettings, ToolSettings } from "@/lib/types";
import { defaultToolSettings } from "@/lib/defaultToolSettings";
import { panelSpacingTransition, imageLoadBarFade, imageLoadBarProgress } from "@/lib/animations";
import { TopBar } from "@/components/TopBar";
import { StatusBar, type UserMode, type ShortcutHint } from "@/components/StatusBar";
import { ShortcutModal } from "@/components/ShortcutModal";
import { DevTierDialog } from "@/components/DevTierDialog";
import { Toaster, toast } from "@/components/ui/sonner";
import { ToolsSidebar } from "@/features/tools";
import { CanvasArea } from "@/features/canvas/CanvasArea";
import { GridThumbnails } from "@/features/canvas/GridThumbnails";
import { ReviewPanel } from "@/features/canvas/ReviewPanel";
import type { ReselectObject } from "@/features/canvas/ReviewPanel";
import { GalleryBar, type PhotoEntry } from "@/features/gallery/GalleryBar";
import { UploadDialog } from "@/features/upload/UploadDialog";
import { getPhotoLimit, DEFAULT_PHOTO_LIMIT } from "@/lib/photoLimits";
import { hasReplicateAI } from "@/lib/tiers";
import { useKeyboardShortcuts } from "./useKeyboardShortcuts";
import { useColorPicker } from "@/hooks/useColorPicker";
import { MagnifierOverlay } from "@/components/MagnifierOverlay";
import type { EffectsMode } from "@/features/tools/settings/EffectsSettings";
import { useAutoCompress } from "@/hooks/useAutoCompress";
import { useEditPersistence } from "@/hooks/useEditPersistence";
import { useRecentTexts } from "@/hooks/useRecentTexts";
import { putOriginal, getOriginal, getOriginalAsBlobUrl, deleteOriginal } from "@/lib/originalsStore";
import { compositeSavedEdit, encodeRgba, EXT, extFromMime } from "@/lib/exportImage";
import type { ExportFormat } from "@/lib/exportImage";
import { makeWorkingCopy, makeThumbnail, makeThumbnailFromPixels, ImageTooLargeError } from "@/lib/workingCopy";
import { DiagnosticLogOverlay } from "@/components/DiagnosticLogOverlay";
import { logDiagnostic, installConsoleCapture } from "@/lib/diagnosticsLog";
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
} from "@/components/ui/context-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { LargeButton } from "@/components/ui/large-button";
import {
  Undo,
  Redo,
  Download,
  Clipboard,
  Trash2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Archive,
  ImagePlus,
  Pipette,
} from "lucide-react";

/** Digit-key shortcut + label per tool (mirrors TOOL_BY_DIGIT in useKeyboardShortcuts). */
const TOOL_SHORTCUT: Partial<Record<ToolType, ShortcutHint>> = {
  compress: { keys: "1", label: "compress" },
  crop: { keys: "2", label: "crop" },
  brush: { keys: "3", label: "brush" },
  text: { keys: "4", label: "text" },
  arrow: { keys: "5", label: "arrow" },
  ai: { keys: "6", label: "AI" },
  shapes: { keys: "7", label: "shapes" },
  effects: { keys: "8", label: "effects" },
  stamp: { keys: "9", label: "stamp" },
  emoji: { keys: "0", label: "batch" },
};

const AUTH_ENABLED = !!(
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY &&
  import.meta.env.VITE_CONVEX_URL
);

/** User-facing message when the gallery cap is reached, nudging toward the next tier. */
function capMessage(mode: UserMode, max: number): string {
  if (mode === "demo")
    return `Demo galleries hold ${max} photos. Sign in to load up to 24.`;
  if (mode === "loggedIn")
    return `Free accounts hold ${max} photos. Pro (100) is coming soon.`;
  return `Gallery is limited to ${max} photos.`;
}

function AuthModeWatcher({ onMode }: { onMode: (m: UserMode) => void }) {
  const { isLoaded, isSignedIn } = useUser();
  // Create/refresh the Convex users row on sign-in (tier lives there).
  useStoreUser();

  useEffect(() => {
    if (!isLoaded) return;
    onMode(isSignedIn ? "loggedIn" : "demo");
  }, [isLoaded, isSignedIn, onMode]);

  return null;
}

export function AppShell() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const stamp = useCloneStamp(canvasRef);
  const { savePhotoEdit, loadPhotoEdit, deletePhotoEdit, duplicatePhotoEdit, clearAllEdits } = useEditPersistence();
  const { addRecentText } = useRecentTexts();

  const [stampSettings, setStampSettings] = useState<StampSettings>({
    brushSize: 20,
    hardness: 0.8,
    opacity: 1.0,
  });

  const handleStampSettingsChange = useCallback(
    (s: StampSettings) => {
      setStampSettings(s);
      stamp.setBrushSize(s.brushSize);
      stamp.setHardness(s.hardness);
      stamp.setOpacity(s.opacity);
    },
    [stamp],
  );

  const [toolSettings, setToolSettings] =
    useState<ToolSettings>(defaultToolSettings);

  const [photos, setPhotos] = useState<PhotoEntry[]>([]);
  const [activePhotoId, setActivePhotoId] = useState<string | null>(null);
  const [imageSavings, setImageSavings] = useState<Record<string, { savingsPercent: number }>>({});
  const [modifiedPhotos, setModifiedPhotos] = useState<Set<string>>(new Set());
  // originalUrl is populated by the compare effect; not set on photo select
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [compareActive, setCompareActive] = useState(false);
  const [hasBeenModified, setHasBeenModified] = useState(false);
  const [isImageLoading, setIsImageLoading] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const loadIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Item 2: Pan mode state
  const [isPanning, setIsPanning] = useState(false);

  const [brushMode, setBrushMode] = useState<"paint" | "blur">("paint");
  const [effectsMode, setEffectsMode] = useState<EffectsMode>("levels");
  const [colorPickerActive, setColorPickerActive] = useState(false);
  const [stampSubMode, setStampSubMode] = useState<"clone" | "red" | "emojis">("clone");
  const [shapesMode, setShapesMode] = useState<"shapes" | "pens" | "arrows">("shapes");
  /** Active Crop-tool aspect ratio. `null` ≡ "Free" (no constraint).
   *  Drags in useDrawingTools snap to this ratio via Rust when set. */
  const [cropRatio, setCropRatio] = useState<[number, number] | null>(null);
  const [userMode, setUserMode] = useState<UserMode>("demo");
  const handleAuthMode = useCallback((m: UserMode) => setUserMode(m), []);

  // Dev-only tier override (Alt+L). When set, it wins over the Clerk-derived
  // mode so the No Login / Logged In / Paid versions can be tested without
  // real auth. Gated to dev builds at the render/shortcut sites.
  const [showDevTier, setShowDevTier] = useState(false);
  const [devTierOverride, setDevTierOverride] = useState<UserMode | null>(null);
  const effectiveUserMode = devTierOverride ?? userMode;

  // Hidden Dev Tools unlock: three clicks on the status-bar tiny button reveals
  // the diagnostics log + tier selector (always on in dev builds).
  const [devToolsUnlocked, setDevToolsUnlocked] = useState(false);
  const devUnlockCountRef = useRef(0);
  const devToolsEnabled = import.meta.env.DEV || devToolsUnlocked;
  const handleDevUnlockClick = useCallback(() => {
    devUnlockCountRef.current += 1;
    if (devUnlockCountRef.current >= 3) setDevToolsUnlocked(true);
  }, []);

  // Gallery photo cap for the current tier. Resolved from Rust (`photo_limit`)
  // so the WASM layer is the single source of truth. Starts at the most
  // restrictive limit until the wasm lookup resolves.
  const [maxPhotos, setMaxPhotos] = useState(DEFAULT_PHOTO_LIMIT);
  useEffect(() => {
    let alive = true;
    void getPhotoLimit(effectiveUserMode).then((n) => {
      if (alive) setMaxPhotos(n);
    });
    return () => {
      alive = false;
    };
  }, [effectiveUserMode]);

  const handleTextCommit = useCallback(
    (text: string) => {
      if (!text.trim()) return;
      void addRecentText({
        id: 0,
        text,
        fontSize: toolSettings.fontSize,
        fontFamily: toolSettings.fontFamily ?? "sans-serif",
        fontWeight: toolSettings.fontWeight,
        textColor: toolSettings.textColor,
      });
    },
    [addRecentText, toolSettings.fontSize, toolSettings.fontFamily, toolSettings.fontWeight, toolSettings.textColor],
  );

  useEffect(() => {
    const handler = (e: CustomEvent<{ text: string }>) =>
      handleTextCommit(e.detail.text);
    window.addEventListener("text-committed", handler as EventListener);
    return () =>
      window.removeEventListener("text-committed", handler as EventListener);
  }, [handleTextCommit]);

  // ── Pixel-based loading (downscaled working copy) ──────────────────────────
  const loadImageFromPixels = useCallback(
    (pixels: Uint8ClampedArray, width: number, height: number) => {
      setIsImageLoading(true);
      setLoadProgress(0);
      if (loadIntervalRef.current) clearInterval(loadIntervalRef.current);
      loadIntervalRef.current = setInterval(() => {
        setLoadProgress((prev) => (prev >= 90 ? 90 : prev + Math.random() * 15));
      }, 100);
      void stamp.loadImageFromPixels(pixels, width, height);
    },
    [stamp],
  );

  /** Apply a finished AI image result (decoded RGBA) back to the canvas as the
   *  new working image, and mark the photo modified so it persists. */
  const handleAIResult = useCallback(
    (r: { pixels: Uint8ClampedArray; width: number; height: number }) => {
      loadImageFromPixels(r.pixels, r.width, r.height);
      setHasBeenModified(true);
    },
    [loadImageFromPixels],
  );

  /** Load a photo entry from IndexedDB → downscale → hand to the tool. */
  const loadPhotoFromEntry = useCallback(
    async (entry: PhotoEntry) => {
      const original = await getOriginal(entry.originalKey);
      if (!original) return;
      const file = new File([original.bytes], original.name, { type: original.mimeType });
      const working = await makeWorkingCopy(file);
      loadImageFromPixels(working.pixels, working.width, working.height);
    },
    [loadImageFromPixels],
  );

  useEffect(() => {
    if (stamp.state.ready && isImageLoading) {
      if (loadIntervalRef.current) {
        clearInterval(loadIntervalRef.current);
        loadIntervalRef.current = null;
      }
      setLoadProgress(100);
      const t = setTimeout(() => {
        setIsImageLoading(false);
        setLoadProgress(0);
      }, 500);
      return () => clearTimeout(t);
    }
  }, [stamp.state.ready, isImageLoading]);

  // ── Compare: fetch original from IndexedDB when slider activates ───────────
  const activeEntry = photos.find((p) => p.id === activePhotoId) ?? null;
  const activeOriginalKey =
    activeEntry?.uploadKey ?? activeEntry?.originalKey ?? null;

  useEffect(() => {
    if (!compareActive || !activeOriginalKey) {
      if (originalUrl) URL.revokeObjectURL(originalUrl);
      setOriginalUrl(null);
      return;
    }
    let cancelled = false;
    let createdUrl: string | null = null;
    void (async () => {
      const u = await getOriginalAsBlobUrl(activeOriginalKey);
      if (cancelled || !u) return;
      createdUrl = u;
      setOriginalUrl(u);
    })();
    return () => {
      cancelled = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compareActive, activeOriginalKey]);

  // ── Add photos ─────────────────────────────────────────────────────────────
  const handleAddPhotos = useCallback(
    async (files: File[]) => {
      // ── Tier cap ─────────────────────────────────────────────────────────
      // Enforce the per-tier gallery limit (from Rust `photo_limit`). Accept
      // as many as fit, then notify if the batch was trimmed or already full.
      const remaining = Math.max(0, maxPhotos - photos.length);
      if (remaining <= 0) {
        toast.error(capMessage(effectiveUserMode, maxPhotos));
        return;
      }
      const accepted = files.length > remaining ? files.slice(0, remaining) : files;
      if (files.length > remaining) {
        toast.error(capMessage(effectiveUserMode, maxPhotos));
      }

      if (activePhotoId && (stamp.state.undoCount > 0 || hasBeenModified)) {
        setModifiedPhotos((prev) => {
          if (prev.has(activePhotoId)) return prev;
          const next = new Set(prev);
          next.add(activePhotoId);
          return next;
        });
      }
      if (activePhotoId && stamp.toolRef.current) {
        await savePhotoEdit(activePhotoId, stamp.toolRef);
      }

      let firstLoaded = false;
      for (const f of accepted) {
        try {
          const t0 = performance.now();
          const working = await makeWorkingCopy(f);
          logDiagnostic(
            "UI_THREAD",
            `decode ${f.name} → ${working.width}×${working.height}`,
            performance.now() - t0,
          );
          // Build the gallery thumbnail from the already-decoded working pixels
          // (downscaled in Rust via resize_pixels) instead of decoding the
          // source file a second time.
          const mod = await import("stamp_tool");
          await mod.default();
          const [originalKey, thumbBlob] = await Promise.all([
            putOriginal(f, working.origWidth, working.origHeight),
            makeThumbnailFromPixels(
              working.pixels,
              working.width,
              working.height,
              mod.resize_pixels,
            ),
          ]);
          const entry: PhotoEntry = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
            name: f.name.replace(/\.[^.]+$/, ""),
            mimeType: f.type || "application/octet-stream",
            byteSize: f.size,
            originalByteSize: f.size,
            origWidth: working.origWidth,
            origHeight: working.origHeight,
            workingWidth: working.width,
            workingHeight: working.height,
            thumbBlob,
            originalKey,
            uploadKey: originalKey,
          };

          setPhotos((prev) => [...prev, entry]);

          if (!firstLoaded) {
            firstLoaded = true;
            loadImageFromPixels(working.pixels, working.width, working.height);
            setHasBeenModified(false);
            setActivePhotoId(entry.id);
            setCompareActive(false);
          }
        } catch (err) {
          console.error("Failed to add photo:", f.name, err);
          toast.error(
            err instanceof ImageTooLargeError
              ? `${f.name}: ${err.message}`
              : `Couldn't open ${f.name}.`,
          );
        }
      }
    },
    [activePhotoId, hasBeenModified, stamp, loadImageFromPixels, savePhotoEdit, photos.length, maxPhotos, effectiveUserMode],
  );

  // ── Select photo ───────────────────────────────────────────────────────────
  const handleSelectPhoto = useCallback(
    async (entry: PhotoEntry) => {
      if (entry.id === activePhotoId) return;

      if (activePhotoId && (stamp.state.undoCount > 0 || hasBeenModified)) {
        setModifiedPhotos((prev) => {
          if (prev.has(activePhotoId)) return prev;
          const next = new Set(prev);
          next.add(activePhotoId);
          return next;
        });
      }

      if (activePhotoId && stamp.toolRef.current) {
        await savePhotoEdit(activePhotoId, stamp.toolRef);
      }

      setHasBeenModified(false);
      setActivePhotoId(entry.id);
      setCompareActive(false);
      // Flag loading synchronously, before any await: switching photos briefly
      // leaves the *outgoing* photo's undo count > 0 while activePhotoId already
      // points at the incoming one. The modified-dot effect gates on this so it
      // doesn't falsely dot the newly-selected photo during the transition.
      setIsImageLoading(true);

      const saved = await loadPhotoEdit(entry.id);
      if (saved) {
        setLoadProgress(20);
        await stamp.loadFromSaved(saved);
        setLoadProgress(100);
        setTimeout(() => { setIsImageLoading(false); setLoadProgress(0); }, 400);
      } else {
        void loadPhotoFromEntry(entry);
      }
    },
    [activePhotoId, hasBeenModified, stamp, loadPhotoFromEntry, savePhotoEdit, loadPhotoEdit],
  );

  // Auto-select the first photo when none is active but photos exist. Keeps
  // the grid hero (and normal canvas) populated after session restore or after
  // the user deletes the previously active photo.
  useEffect(() => {
    if (!activePhotoId && photos.length > 0) {
      void handleSelectPhoto(photos[0]);
    }
  }, [activePhotoId, photos, handleSelectPhoto]);

  // Item 4: PgUp/PgDn gallery cycling
  const handleNextPhoto = useCallback(() => {
    if (photos.length === 0) return;
    const idx = photos.findIndex((p) => p.id === activePhotoId);
    const next = photos[(idx + 1) % photos.length];
    if (next) void handleSelectPhoto(next);
  }, [photos, activePhotoId, handleSelectPhoto]);

  const handlePrevPhoto = useCallback(() => {
    if (photos.length === 0) return;
    const idx = photos.findIndex((p) => p.id === activePhotoId);
    const prev = photos[(idx - 1 + photos.length) % photos.length];
    if (prev) void handleSelectPhoto(prev);
  }, [photos, activePhotoId, handleSelectPhoto]);

  const handleRemovePhoto = useCallback(
    (id: string) => {
      deletePhotoEdit(id).catch(() => {});
      setImageSavings((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setModifiedPhotos((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      setPhotos((prev) => {
        const idx = prev.findIndex((p) => p.id === id);
        const next = prev.filter((p) => p.id !== id);
        if (id === activePhotoId && next.length > 0) {
          const na = next[Math.min(idx, next.length - 1)]!;
          void loadPhotoFromEntry(na);
          setActivePhotoId(na.id);
          setHasBeenModified(false);
          setCompareActive(false);
        } else if (next.length === 0) {
          setActivePhotoId(null);
          setHasBeenModified(false);
          setCompareActive(false);
        }
        return next;
      });
    },
    [activePhotoId, loadPhotoFromEntry, deletePhotoEdit],
  );

  // Bulk delete from the gallery multi-select.
  // ── Gallery multi-select (lifted here so Compress/Export can use it) ────────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const toggleSelectPhoto = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);
  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  // Drop selections for photos that no longer exist.
  useEffect(() => {
    setSelectedIds((prev) => {
      if (prev.size === 0) return prev;
      const ids = new Set(photos.map((p) => p.id));
      let changed = false;
      const next = new Set<string>();
      prev.forEach((id) => (ids.has(id) ? next.add(id) : (changed = true)));
      return changed ? next : prev;
    });
  }, [photos]);

  const handleDeleteSelected = useCallback(() => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    const idSet = new Set(ids);
    ids.forEach((id) => {
      deletePhotoEdit(id).catch(() => {});
    });
    setImageSavings((prev) => {
      const next = { ...prev };
      ids.forEach((id) => delete next[id]);
      return next;
    });
    setModifiedPhotos((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.delete(id));
      return next;
    });
    setPhotos((prev) => {
      const next = prev.filter((p) => !idSet.has(p.id));
      if (activePhotoId && idSet.has(activePhotoId)) {
        if (next.length > 0) {
          const na = next[0]!;
          void loadPhotoFromEntry(na);
          setActivePhotoId(na.id);
        } else {
          setActivePhotoId(null);
        }
        setHasBeenModified(false);
        setCompareActive(false);
      }
      return next;
    });
    clearSelection();
  }, [selectedIds, activePhotoId, loadPhotoFromEntry, deletePhotoEdit, clearSelection]);

  // Duplicate the selected photos. Originals are content-addressed (SHA-256), so
  // the copies reuse the same originalKey/thumbBlob — zero pixel copy. The
  // source's persisted edit (Rust-rendered PNG archive) is cloned to the new id
  // so the duplicate carries any edits. Each copy lands right after its source.
  const handleDuplicateSelected = useCallback(async () => {
    if (selectedIds.size === 0) return;
    // Flush the active photo's in-progress edits first so a copy of it is current.
    if (activePhotoId && selectedIds.has(activePhotoId) && stamp.toolRef.current) {
      await savePhotoEdit(activePhotoId, stamp.toolRef);
    }
    const room = Math.max(0, maxPhotos - photos.length);
    if (room <= 0) {
      toast.error(capMessage(effectiveUserMode, maxPhotos));
      return;
    }
    const sources = photos.filter((p) => selectedIds.has(p.id)).slice(0, room);
    if (sources.length < selectedIds.size) {
      toast.error(capMessage(effectiveUserMode, maxPhotos));
    }
    const dups = sources.map((src) => ({
      srcId: src.id,
      entry: {
        ...src,
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        name: `${src.name} copy`,
        uploadKey: src.uploadKey ?? src.originalKey,
      } as PhotoEntry,
    }));
    await Promise.all(
      dups.map(({ srcId, entry }) =>
        duplicatePhotoEdit(srcId, entry.id).catch(() => {}),
      ),
    );
    setPhotos((prev) => {
      const out: PhotoEntry[] = [];
      for (const p of prev) {
        out.push(p);
        const dup = dups.find((d) => d.srcId === p.id);
        if (dup) out.push(dup.entry);
      }
      return out;
    });
    clearSelection();
    toast.success(
      `Duplicated ${dups.length} image${dups.length === 1 ? "" : "s"}`,
    );
  }, [
    selectedIds,
    photos,
    maxPhotos,
    activePhotoId,
    stamp,
    savePhotoEdit,
    duplicatePhotoEdit,
    effectiveUserMode,
    clearSelection,
  ]);

  const [showUpload, setShowUpload] = useState(true);
  const [showTopBar, setShowTopBar] = useState(false);
  const [showTools, setShowTools] = useState(false);
  const [showGallery, setShowGallery] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showShortcutModal, setShowShortcutModal] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  useEffect(() => {
    installConsoleCapture();
  }, []);
  const [deleteAllOpen, setDeleteAllOpen] = useState(false);

  const [activeTool, setActiveTool] = useState<ToolType>("compress");

  useEffect(() => {
    if (activeTool !== "effects") setColorPickerActive(false);
  }, [activeTool]);
  const [exportFormat, setExportFormat] = useState<ExportFormat>("jpeg");
  const [quality, setQuality] = useState(75);

  const effectiveBrushSize = (() => {
    switch (activeTool) {
      case "brush":
        return brushMode === "blur" ? toolSettings.blurSize / 2 : toolSettings.brushSize / 2;
      case "stamp":
        if (stampSubMode === "emojis") return (toolSettings.emojiSize * 1.2) / 2;
        return stampSettings.brushSize;
      default:
        return stampSettings.brushSize;
    }
  })();

  const { pos, visible, diameter, onCanvasEnter, onCanvasLeave } =
    useBrushPreview(effectiveBrushSize, stamp.state.zoom, canvasRef);

  const handleQualityChange = useCallback((q: number) => {
    setQuality(q);
    setHasBeenModified(true);
  }, []);

  const { progress: compressProgress, compressAll } = useAutoCompress();

  const prevPhotoCount = useRef(0);
  const revealTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  // Stable binding — `stamp` is a fresh object each render, but `stamp.reset`
  // is a stable useCallback, so the effect below only re-fires on count change.
  const stampReset = stamp.reset;
  useEffect(() => {
    const prev = prevPhotoCount.current;
    const curr = photos.length;
    prevPhotoCount.current = curr;
    if (revealTimers.current.length === 0 && prev === 0 && curr > 0) {
      setShowUpload(false);
      revealTimers.current = [
        setTimeout(() => setShowTopBar(true), 150),
        setTimeout(() => setShowTools(true), 500),
        setTimeout(() => setShowGallery(true), 850),
      ];
    }
    if (curr === 0) {
      revealTimers.current.forEach(clearTimeout);
      revealTimers.current = [];
      // Catch-all for EVERY path that empties the gallery (Delete All, bulk
      // multi-select delete, removing the last photo): blank the canvas and
      // reset the WASM tool so the last image doesn't ghost behind the
      // re-opened upload dialog. Runs in the same commit as setShowUpload.
      if (prev > 0) stampReset();
      setShowUpload(true);
      setShowTopBar(false);
      setShowTools(false);
      setShowGallery(false);
      setShowHistory(false);
    }
  }, [photos.length, stampReset]);
  useEffect(() => () => { revealTimers.current.forEach(clearTimeout); }, []);

  const handleExport = useCallback(() => {
    const activeName =
      photos.find((p) => p.id === activePhotoId)?.name ?? "image";
    stamp.exportAs(exportFormat, quality / 100, activeName);
  }, [stamp, exportFormat, quality, photos, activePhotoId]);

  const handleDeleteAll = useCallback(() => {
    setDeleteAllOpen(true);
  }, []);

  const confirmDeleteAll = useCallback(() => {
    setDeleteAllOpen(false);
    clearAllEdits().catch(() => {});
    setImageSavings({});
    setModifiedPhotos(new Set());
    // Blank the canvas + drop the WASM tool immediately (the empty-gallery
    // effect below also fires, but reset is idempotent).
    stamp.reset();
    setActivePhotoId(null);
    setOriginalUrl(null);
    setHasBeenModified(false);
    setCompareActive(false);
    setPhotos([]);
  }, [clearAllEdits, stamp]);

  const handlePickColor = useCallback((hex: string) => {
    setToolSettings((prev) => ({ ...prev, brushColor: hex, textColor: hex }));
    setColorPickerActive(false);
  }, []);

  /** Context-menu shortcut: open the Effects panel on its Color Picker tab
   *  with the eyedropper already armed. */
  const handleActivateEyedropper = useCallback(() => {
    setShowTools(true);
    setActiveTool("effects");
    setEffectsMode("picker");
    setColorPickerActive(true);
  }, []);

  const colorPicker = useColorPicker({
    toolRef: stamp.toolRef,
    canvasRef,
    containerRef,
    active: colorPickerActive && activeTool === "effects",
    onPickColor: handlePickColor,
  });

  const flushAndSync = useCallback(() => {
    stamp.flushToCanvas();
    stamp.syncState();
  }, [stamp]);

  const isBlurringRef = useRef(false);

  const getCoords = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const c = canvasRef.current;
    if (!c) return { x: 0, y: 0 };
    const r = c.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) * c.width) / r.width,
      y: ((e.clientY - r.top) * c.height) / r.height,
    };
  }, []);

  const blurDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const t = stamp.toolRef.current;
      if (!t || e.button !== 0) return;
      isBlurringRef.current = true;
      t.begin_blur_stroke();
      const { x, y } = getCoords(e);
      t.blur_region(x, y, toolSettings.blurSize / 2, toolSettings.blurIntensity);
      stamp.flushToCanvas();
    },
    [stamp, getCoords, toolSettings.blurSize, toolSettings.blurIntensity],
  );

  const blurMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!isBlurringRef.current) return;
      const t = stamp.toolRef.current;
      if (!t) return;
      const { x, y } = getCoords(e);
      t.blur_region(x, y, toolSettings.blurSize / 2, toolSettings.blurIntensity);
      stamp.flushToCanvas();
    },
    [stamp, getCoords, toolSettings.blurSize, toolSettings.blurIntensity],
  );

  const blurUp = useCallback(() => {
    if (!isBlurringRef.current) return;
    isBlurringRef.current = false;
    stamp.syncState();
  }, [stamp]);

  const effectiveDrawingTool =
    activeTool === "shapes" && shapesMode === "arrows"
      ? ("arrow" as const)
      : activeTool;

  const drawingTools = useDrawingTools({
    toolRef: stamp.toolRef,
    canvasRef,
    activeTool: effectiveDrawingTool,
    settings: toolSettings,
    flushToCanvas: flushAndSync,
    syncState: stamp.syncState,
    penMode:
      activeTool === "shapes" && shapesMode === "pens"
        ? (toolSettings.penMode ?? "pins")
        : null,
    cropRatio,
    imageWidth: stamp.state.width,
    imageHeight: stamp.state.height,
  });

  const emojiTool = useEmojiTool({
    toolRef: stamp.toolRef,
    canvasRef,
    flushToCanvas: flushAndSync,
    emoji: toolSettings.emoji,
    emojiSize: toolSettings.emojiSize,
  });

  const paintTool = usePaintTool({
    toolRef: stamp.toolRef,
    canvasRef,
    settings: toolSettings,
    flushToCanvas: stamp.flushToCanvas,
    syncState: stamp.syncState,
  });

  const textTool = useTextTool({
    toolRef: stamp.toolRef,
    canvasRef,
    containerRef,
    settings: toolSettings,
    flushToCanvas: stamp.flushToCanvas,
    syncState: stamp.syncState,
    active: activeTool === "text",
  });

  /**
   * Canvas resize-handle drags land here. The open text input renders from
   * its OWN style snapshot (`textInput.fontSize` — see effFontSize in
   * CanvasArea), so updating `toolSettings.fontSize` alone moved the panel
   * slider but never resized the text (the original "broken squares" bug).
   * Forward to setTextFontSize so the live input grows AND keep ToolSettings
   * in sync so the slider tracks the drag and commitText agrees with both.
   */
  const handleTextFontSizeChange = useCallback(
    (size: number) => {
      setToolSettings((prev) => ({ ...prev, fontSize: size }));
      textTool.setTextFontSize(size);
    },
    [textTool.setTextFontSize],
  );

  /**
   * Wrap setToolSettings so that when the text-input overlay is open, any
   * change to textColor / fontWeight / fontSize is forwarded to the text
   * tool's setters too. Without this, the toolbar updates `toolSettings`
   * but the open textarea keeps showing the captured-on-open style. BG
   * fields are read directly from `toolSettings` by CanvasArea, so they
   * already update live without forwarding.
   */
  const handleToolSettingsChange = useCallback(
    (next: ToolSettings) => {
      setToolSettings((prev) => {
        if (textTool.textInput) {
          if (next.textColor !== prev.textColor)
            textTool.setTextColor(next.textColor);
          if (next.fontWeight !== prev.fontWeight)
            textTool.setTextFontWeight(next.fontWeight);
          if (next.fontSize !== prev.fontSize)
            textTool.setTextFontSize(next.fontSize);
        }
        return next;
      });
    },
    [textTool],
  );

  // Live-annotation bounding boxes for the CanvasArea hover highlight.
  const annotationBoxes = textTool.annotations.map((a) => ({
    id: a.id,
    x: a.x + a.tile_offset_x,
    y: a.y + a.tile_offset_y,
    tile_w: a.tile_w,
    tile_h: a.tile_h,
  }));

  // ── Reselect list: live placed objects (text + shapes) ─────────────────
  // Names are per-kind ordinals computed in list order: Text #1, Square #1,
  // Line #2, etc. The id is stable within its own (text vs shape) id-space.
  const reselectObjects = useMemo<ReselectObject[]>(() => {
    const items: ReselectObject[] = [];
    textTool.annotations.forEach((a, i) => {
      items.push({ key: `t${a.id}`, type: "text", id: a.id, label: `Text #${i + 1}` });
    });
    const KIND_LABEL: Record<number, string> = {
      0: "Square",
      1: "Circle",
      2: "Line",
      3: "Hand-drawn",
      4: "Arrow",
      5: "Pin",
      6: "Pen",
    };
    const counters: Record<number, number> = {};
    drawingTools.shapes.forEach((s) => {
      counters[s.kind] = (counters[s.kind] ?? 0) + 1;
      // Pins show their own callout number; everything else gets an ordinal.
      const label =
        s.kind === 5
          ? `Pin ${s.number}`
          : `${KIND_LABEL[s.kind] ?? "Shape"} #${counters[s.kind]}`;
      items.push({ key: `s${s.id}`, type: "shape", id: s.id, label });
    });
    return items;
  }, [textTool.annotations, drawingTools.shapes]);

  // Keep the Reselect list fresh after any history mutation or photo switch
  // (undo/redo/jump/load all change the live overlays under the hood).
  useEffect(() => {
    drawingTools.refreshShapes();
    textTool.refreshAnnotations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stamp.state.history, activePhotoId]);

  const handleSelectObject = useCallback(
    (o: ReselectObject) => {
      if (o.type === "text") {
        setActiveTool("text");
        textTool.selectAnnotation(o.id);
      } else {
        drawingTools.selectShape(o.id);
      }
    },
    [textTool, drawingTools],
  );

  const handleDeleteObject = useCallback(
    (o: ReselectObject) => {
      if (o.type === "text") {
        stamp.toolRef.current?.remove_text_annotation(o.id);
        stamp.flushToCanvas();
        stamp.syncState();
        textTool.refreshAnnotations();
        window.dispatchEvent(new Event("text-annotations-changed"));
      } else {
        drawingTools.removeShape(o.id);
      }
    },
    [stamp, textTool, drawingTools],
  );

  const redStampTool = useRedStampTool({
    toolRef: stamp.toolRef,
    canvasRef,
    flushToCanvas: flushAndSync,
    syncState: stamp.syncState,
    active: activeTool === "stamp",
    brushSize: stampSettings.brushSize,
  });

  const effectiveStamp = (() => {
    if (activeTool === "effects") {
      if (colorPickerActive) {
        return {
          ...stamp,
          onMouseDown: colorPicker.onMouseDown as typeof stamp.onMouseDown,
          onMouseMove: colorPicker.onMouseMove as typeof stamp.onMouseMove,
          onMouseUp: stamp.onMouseUp,
        };
      }
      return stamp;
    }
    if (["arrow", "shapes", "crop"].includes(activeTool))
      return {
        ...stamp,
        onMouseDown: drawingTools.onMouseDown as typeof stamp.onMouseDown,
        onMouseMove: drawingTools.onMouseMove as typeof stamp.onMouseMove,
        onMouseUp: drawingTools.onMouseUp as typeof stamp.onMouseUp,
      };
    if (activeTool === "brush") {
      if (brushMode === "blur") {
        return {
          ...stamp,
          onMouseDown: blurDown,
          onMouseMove: blurMove,
          onMouseUp: blurUp,
        };
      }
      return {
        ...stamp,
        onMouseDown: paintTool.onMouseDown as typeof stamp.onMouseDown,
        onMouseMove: paintTool.onMouseMove as typeof stamp.onMouseMove,
        onMouseUp: paintTool.onMouseUp as typeof stamp.onMouseUp,
      };
    }
    if (activeTool === "stamp") {
      if (stampSubMode === "emojis") {
        return {
          ...stamp,
          onMouseDown: emojiTool.onMouseDown as typeof stamp.onMouseDown,
          onMouseMove: emojiTool.onMouseMove as typeof stamp.onMouseMove,
          onMouseUp: emojiTool.onMouseUp as typeof stamp.onMouseUp,
        };
      }
      const combinedDown: typeof stamp.onMouseDown = (e) => {
        if (redStampTool.hasPendingStamp()) {
          redStampTool.onMouseDown(e as React.MouseEvent<HTMLCanvasElement>);
        } else {
          stamp.onMouseDown(e);
        }
      };
      return {
        ...stamp,
        onMouseDown: combinedDown,
      };
    }
    return stamp;
  })();

  const handleZoomIn = useCallback(() => {
    stamp.toolRef.current?.adjust_zoom(1);
    stamp.syncState();
  }, [stamp]);

  const handleZoomOut = useCallback(() => {
    stamp.toolRef.current?.adjust_zoom(-1);
    stamp.syncState();
  }, [stamp]);

  const handleZoomReset = useCallback(() => {
    stamp.toolRef.current?.set_zoom(1.0);
    stamp.syncState();
  }, [stamp]);

  const handleCopyToClipboard = useCallback(async () => {
    const tool = stamp.toolRef.current;
    if (!tool) {
      toast.error("No image to copy");
      return;
    }
    try {
      // Match the export-path semantics: bake any live text overlays into
      // pixels first so the clipboard image reflects what's on screen.
      if (tool.text_annotation_count() > 0) {
        tool.flatten_text_annotations();
        stamp.flushToCanvas();
        stamp.syncState();
      }
      // Important: `tool.export_png()` returns a Uint8Array view into wasm
      // memory. Passing `.buffer` to Blob() would include the entire wasm
      // heap, not just the PNG slice — the resulting blob is huge and the
      // clipboard write fails. Copy the slice into a fresh ArrayBuffer
      // (detached from wasm memory) before handing it to Blob.
      const pngView = tool.export_png();
      const pngBytes = new Uint8Array(pngView.length);
      pngBytes.set(pngView);
      const blob = new Blob([pngBytes], { type: "image/png" });
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blob }),
      ]);
      toast.success("Copied to clipboard");
    } catch (err) {
      console.error("Copy to clipboard failed:", err);
      const msg = err instanceof Error ? err.message : "Unknown error";
      toast.error(`Couldn't copy to clipboard: ${msg}`);
    }
  }, [stamp]);

  /**
   * Paste a bitmap from the clipboard into the **active layer**, centred on the
   * canvas. Accepts either the `clipboardData.items` from a native paste event
   * or, when called without them, falls back to the async Clipboard API (for an
   * explicit button/menu invocation). Decodes the image to RGBA and composites
   * it via the active-layer `paste_region` (one "Paste" history entry in Rust).
   */
  const handlePasteFromClipboard = useCallback(
    async (items?: DataTransferItemList | null) => {
      const tool = stamp.toolRef.current;
      if (!tool || !activePhotoId) return;
      let source: Blob | null = null;
      if (items) {
        for (const it of Array.from(items)) {
          if (it.kind === "file" && it.type.startsWith("image/")) {
            source = it.getAsFile();
            break;
          }
        }
      }
      if (!source) {
        try {
          const read = await navigator.clipboard.read();
          for (const clip of read) {
            const t = clip.types.find((x) => x.startsWith("image/"));
            if (t) {
              source = await clip.getType(t);
              break;
            }
          }
        } catch {
          /* clipboard API unavailable / denied — nothing to paste */
        }
      }
      if (!source) return;
      try {
        const bitmap = await createImageBitmap(source);
        const w = bitmap.width;
        const h = bitmap.height;
        const oc = new OffscreenCanvas(w, h);
        const ctx = oc.getContext("2d")!;
        ctx.drawImage(bitmap, 0, 0);
        bitmap.close();
        const rgba = ctx.getImageData(0, 0, w, h).data;
        const cw = stamp.state.width || w;
        const ch = stamp.state.height || h;
        const destX = Math.round((cw - w) / 2);
        const destY = Math.round((ch - h) / 2);
        stamp.pasteRegion(
          new Uint8ClampedArray(rgba.buffer as ArrayBuffer),
          w,
          h,
          destX,
          destY,
        );
        toast.success("Pasted into active layer");
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        toast.error(`Couldn't paste image: ${msg}`);
      }
    },
    [stamp, activePhotoId],
  );

  // Native Ctrl/Cmd+V paste → drop the clipboard image into the active layer.
  // Skipped while the upload dialog is open (it imports pastes as new photos)
  // or when focus is in a text field (text tool, layer rename, etc.).
  useEffect(() => {
    const handler = (e: ClipboardEvent) => {
      if (showUpload) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      const items = e.clipboardData?.items;
      if (!items) return;
      const hasImage = Array.from(items).some(
        (it) => it.kind === "file" && it.type.startsWith("image/"),
      );
      if (!hasImage) return;
      e.preventDefault();
      void handlePasteFromClipboard(items);
    };
    window.addEventListener("paste", handler);
    return () => window.removeEventListener("paste", handler);
  }, [showUpload, handlePasteFromClipboard]);

  const handleToggleCompare = useCallback(() => {
    setCompareActive((v) => !v);
  }, []);

  /**
   * Apply Compression & Resize. Resamples the WASM canvas with the chosen
   * filter, then re-encodes the (annotation-free) canvas buffer at the chosen
   * format + quality and persists it as the photo's stored bytes — mirroring
   * the Auto Compress pattern: putOriginal → deleteOriginal(old) → PhotoEntry
   * update (byteSize / mimeType / dims / thumbnail). The StatusBar size label
   * and the gallery tooltip both read from the entry, so they update on their
   * own. Text annotations stay live overlays (not flattened), like
   * Auto Compress.
   */
  const handleApplyCompression = useCallback(
    async (w: number, h: number, filter: number) => {
      const origW = stamp.state.width;
      const origH = stamp.state.height;
      if (w !== origW || h !== origH) {
        stamp.resizeWithFilter(w, h, filter);
      } else {
        // Quality/format-only apply: pixels are unchanged but the stored file
        // is re-encoded — record a "Compress" entry so History reflects it.
        stamp.toolRef.current?.push_compress_marker();
        stamp.syncState();
      }
      setHasBeenModified(true);
      if (activePhotoId) {
        setModifiedPhotos((prev) =>
          prev.has(activePhotoId) ? prev : new Set(prev).add(activePhotoId),
        );
      }
      // Instant estimate so the gallery badge reacts immediately; replaced by
      // the real measured savings once the re-encode below lands.
      if (activePhotoId) {
        const areaRatio = origW * origH > 0 ? (w * h) / (origW * origH) : 1;
        const qualityRatio = quality / 100;
        const savingsPercent = Math.max(
          0,
          Math.round((1 - areaRatio * qualityRatio) * 100),
        );
        if (savingsPercent > 0) {
          setImageSavings((prev) => ({
            ...prev,
            [activePhotoId]: { savingsPercent },
          }));
        }
      }

      // ── Re-encode + persist (Auto Compress pattern) ──────────────────────
      const entry = photos.find((p) => p.id === activePhotoId);
      const tool = stamp.toolRef.current;
      if (!entry || !tool) return;
      try {
        // Fresh copy of the (possibly just-resized) canvas buffer — live text
        // annotations are intentionally NOT flattened.
        const pixels = new Uint8Array(tool.get_image_data());
        const tw = tool.width();
        const th = tool.height();
        const blob = await encodeRgba(pixels, tw, th, exportFormat, quality / 100);
        // convertToBlob may fall back (e.g. AVIF → PNG on some browsers);
        // trust the blob's actual MIME for the stored metadata.
        const mime = blob.type || `image/${exportFormat}`;
        const newFile = new File([blob], `${entry.name}${extFromMime(mime)}`, {
          type: mime,
        });

        const mod = await import("stamp_tool");
        await mod.default();
        const oldKey = entry.originalKey;
        const [newKey, newThumb] = await Promise.all([
          putOriginal(newFile, tw, th),
          makeThumbnailFromPixels(pixels, tw, th, mod.resize_pixels),
        ]);
        if (oldKey && oldKey !== newKey && oldKey !== entry.uploadKey) {
          deleteOriginal(oldKey).catch(() => {});
        }

        setPhotos((prev) =>
          prev.map((p) =>
            p.id !== entry.id
              ? p
              : {
                  ...p,
                  originalKey: newKey,
                  byteSize: blob.size,
                  mimeType: mime,
                  origWidth: tw,
                  origHeight: th,
                  workingWidth: tw,
                  workingHeight: th,
                  thumbBlob: newThumb,
                },
          ),
        );

        // Real savings vs. the immutable upload-size baseline.
        const realSavings =
          entry.originalByteSize > 0
            ? Math.max(
                0,
                Math.round((1 - blob.size / entry.originalByteSize) * 100),
              )
            : 0;
        setImageSavings((prev) => ({
          ...prev,
          [entry.id]: { savingsPercent: realSavings },
        }));
      } catch (err) {
        console.error("Apply Compression & Resize failed:", err);
        toast.error("Couldn't apply compression");
      }
    },
    [stamp, activePhotoId, photos, quality, exportFormat],
  );

  const handleAutoCompress = useCallback(
    async (scope: "selected" | "all" = "all") => {
    // "selected" compresses the gallery multi-selection, or — when nothing is
    // multi-selected — just the active photo in the ring. "all" does everything.
    const targets =
      scope === "selected"
        ? selectedIds.size > 0
          ? photos.filter((p) => selectedIds.has(p.id))
          : photos.filter((p) => p.id === activePhotoId)
        : photos;
    // Load originals from IndexedDB to build File objects for the compress hook
    const photosForCompress = (
      await Promise.all(
        targets.map(async (p) => {
          const orig = await getOriginal(p.originalKey);
          if (!orig) return null;
          return { id: p.id, file: new File([orig.bytes], orig.name, { type: orig.mimeType }) };
        }),
      )
    ).filter((x): x is { id: string; file: File } => x !== null);

    compressAll(
      photosForCompress,
      {
        maxWidth: 2200,
        maxHeight: 2200,
        quality: quality / 100,
        format: `image/${exportFormat === "png" ? "webp" : exportFormat}`,
      },
      (id: string, nf: File, nu: string) => {
        URL.revokeObjectURL(nu); // We store to IDB, don't need the blob URL
        const photo = photos.find((p) => p.id === id);
        if (!photo) return;
        void (async () => {
          const [newKey, newThumb] = await Promise.all([
            putOriginal(nf, photo.workingWidth, photo.workingHeight),
            makeThumbnail(nf),
          ]);
          setPhotos((p) =>
            p.map((x) =>
              x.id !== id
                ? x
                : { ...x, originalKey: newKey, thumbBlob: newThumb, byteSize: nf.size },
            ),
          );
        })();
      },
    );
    // NOTE: intentionally does NOT set `hasBeenModified` — Auto Compress is a
    // batch op over stored files and must not light the active photo's modified
    // dot. Its result is tracked separately via `imageSavings`.
  }, [photos, selectedIds, activePhotoId, quality, exportFormat, compressAll]);

  // Track per-photo modification state. Any single-image edit marks the active
  // photo with the "modified" dot immediately: canvas edits bump the WASM undo
  // count, and resize/quality set `hasBeenModified`. Batch ops and Auto Compress
  // touch stored files (not the live canvas / `hasBeenModified`), so they never
  // light the dot here.
  useEffect(() => {
    // Skip while a photo is loading: switching to an unedited photo briefly
    // leaves the previous photo's undoCount > 0, which would otherwise dot the
    // newly-selected one. Wait until the load settles and undoCount reflects the
    // photo that's actually on the canvas.
    if (isImageLoading) return;
    // Only light the "altered" dot for *applied* canvas edits (which bump the
    // WASM undo count) — not for transient control changes like dragging the
    // quality slider (which only sets `hasBeenModified` pending an apply).
    if (activePhotoId && stamp.state.undoCount > 0) {
      setModifiedPhotos((prev) => {
        if (prev.has(activePhotoId)) return prev;
        const next = new Set(prev);
        next.add(activePhotoId);
        return next;
      });
    }
  }, [activePhotoId, stamp.state.undoCount, isImageLoading]);

  // Persist compression savings
  useEffect(() => {
    const entries = Object.entries(compressProgress.savings);
    if (entries.length === 0) return;
    setImageSavings((prev) => {
      const merged = { ...prev };
      for (const [id, s] of entries) {
        merged[id] = { savingsPercent: s.savingsPercent };
      }
      return merged;
    });
  }, [compressProgress.savings]);

  // Surface Auto-Compress progress as a sonner toast (with a progress bar)
  // instead of an inline bar in the toolbar.
  const compressToastRef = useRef<string | number | null>(null);
  const compressTotalRef = useRef(0);
  useEffect(() => {
    const { running, completed, total } = compressProgress;
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
    if (running) {
      compressTotalRef.current = total;
      const node = (
        <div className="flex w-full min-w-[220px] flex-col gap-2">
          <div className="flex items-baseline justify-between gap-3 pr-6 text-sm font-medium">
            <span>Compressing…</span>
            <span className="font-mono text-xs tabular-nums text-theme-muted-foreground">
              {completed}/{total} · {pct}%
            </span>
          </div>
          {/* -mx-4 cancels the toast's px-4 so the bar bleeds to both edges. */}
          <div className="-mx-4 h-1.5 overflow-hidden bg-white/10">
            <div
              className="h-full bg-emerald-400 transition-[width] duration-300 ease-out"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      );
      // Plain toast (not toast.loading) so there's no leading spinner eating the
      // row — the node spans the full toast width, letting the text sit
      // space-between and the progress bar run edge-to-edge.
      if (compressToastRef.current == null) {
        compressToastRef.current = toast(node, { duration: Infinity });
      } else {
        toast(node, { id: compressToastRef.current, duration: Infinity });
      }
    } else if (compressToastRef.current != null) {
      const n = compressTotalRef.current;
      // Dismiss the infinite-duration loading toast and raise a fresh success
      // toast so it gets its own auto-dismiss timer (updating the loading toast
      // in place keeps its Infinity duration and never expires).
      toast.dismiss(compressToastRef.current);
      toast.success(`Compressed ${n} image${n === 1 ? "" : "s"}`, {
        duration: 3000,
      });
      compressToastRef.current = null;
    }
  }, [compressProgress]);

  const exportPhotosToZip = useCallback(
    async (list: PhotoEntry[], filename: string) => {
    if (list.length === 0) return;

    // Persist the active photo's in-progress edits so every photo reads
    // uniformly from the edit store below.
    const activeChanged =
      !!activePhotoId && (stamp.state.undoCount > 0 || hasBeenModified);
    if (activeChanged && activePhotoId && stamp.toolRef.current) {
      await savePhotoEdit(activePhotoId, stamp.toolRef);
    }

    // A photo is "changed" if it was edited on the canvas (modifiedPhotos) or
    // compressed/quality-changed (imageSavings), or is the active photo with
    // pending edits. Changed photos export their processed result re-encoded at
    // the chosen format/quality; untouched photos export the original verbatim.
    const isChanged = (id: string) =>
      modifiedPhotos.has(id) ||
      imageSavings[id] != null ||
      (id === activePhotoId && activeChanged);

    const { default: JSZip } = await import("jszip");
    const zip = new JSZip();
    const usedNames = new Set<string>();

    for (const photo of list) {
      let blob: Blob;
      let ext: string;

      if (isChanged(photo.id)) {
        const edit = await loadPhotoEdit(photo.id);
        if (edit) {
          // Canvas edits (draw / text / crop / resize / transform) →
          // composite via Rust + re-encode at the chosen format/quality.
          const { pixels, w, h } = await compositeSavedEdit(edit);
          blob = await encodeRgba(pixels, w, h, exportFormat, quality / 100);
          ext = EXT[exportFormat];
        } else {
          // Compressed/quality-changed only (no canvas snapshot): the processed
          // bytes already live at originalKey.
          const orig = await getOriginal(photo.originalKey);
          if (!orig) continue;
          blob = new Blob([orig.bytes], { type: orig.mimeType });
          ext = extFromMime(orig.mimeType);
        }
      } else {
        // Untouched → original bytes, verbatim, in their original format.
        const orig = await getOriginal(photo.originalKey);
        if (!orig) continue;
        blob = new Blob([orig.bytes], { type: orig.mimeType });
        ext = extFromMime(orig.mimeType);
      }

      // De-dupe filenames within the archive.
      const base = photo.name || "image";
      let name = `${base}${ext}`;
      for (let n = 2; usedNames.has(name); n++) name = `${base}-${n}${ext}`;
      usedNames.add(name);
      zip.file(name, blob);
    }

    const out = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(out);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    },
    [
      activePhotoId,
      hasBeenModified,
      stamp,
      exportFormat,
      quality,
      modifiedPhotos,
      imageSavings,
      loadPhotoEdit,
      savePhotoEdit,
    ],
  );

  const handleExportAll = useCallback(
    () => exportPhotosToZip(photos, "photos.zip"),
    [exportPhotosToZip, photos],
  );

  const handleExportSelected = useCallback(() => {
    void exportPhotosToZip(
      photos.filter((p) => selectedIds.has(p.id)),
      "selected-photos.zip",
    );
  }, [exportPhotosToZip, photos, selectedIds]);

  useKeyboardShortcuts({
    onUndo: stamp.undo,
    onRedo: stamp.redo,
    onExport: handleExport,
    onExportAll: handleExportAll,
    onDeleteAll: handleDeleteAll,
    onBrushSizeChange: setStampSettings,
    setBrushSizeOnTool: stamp.setBrushSize,
    setShowUpload,
    setShowTools,
    setShowGallery,
    setShowHistory,
    setShowShortcutModal,
    // Diagnostics log (Alt+Delete) is a Dev Tool — gated until unlocked.
    setShowDiagnostics: devToolsEnabled ? setShowDiagnostics : undefined,
    onZoomIn: handleZoomIn,
    onZoomOut: handleZoomOut,
    onZoomReset: handleZoomReset,
    onToolChange: (t) => {
      // Batch Image Editor requires 2+ photos; ignore the shortcut otherwise
      // so the keyboard path matches the disabled sidebar icon.
      if (t === "emoji" && photos.length <= 1) return;
      setActiveTool(t);
    },
    onFlipH: stamp.flipHorizontal,
    onFlipV: stamp.flipVertical,
    onRotateCw: stamp.rotate90Cw,
    onCopyToClipboard: handleCopyToClipboard,
    onNextPhoto: handleNextPhoto,
    onPrevPhoto: handlePrevPhoto,
    onSpaceDown: () => setIsPanning(true),
    onSpaceUp: () => setIsPanning(false),
    // Alt+L tier switcher — a Dev Tool, gated until unlocked (always on in dev).
    onToggleDevTier: devToolsEnabled
      ? () => setShowDevTier((v) => !v)
      : undefined,
  });

  const hasImage = stamp.state.ready;
  const canUndo = stamp.state.undoCount > 0;
  const canRedo = stamp.state.redoCount > 0;

  return (
    <div className="app-shell">
      <AnimatePresence>
        {isImageLoading && (
          <motion.div
            variants={imageLoadBarFade}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="fixed top-0 left-0 right-0 z-100 h-1 bg-bg-elevated"
          >
            <motion.div
              className="h-full bg-linear-to-r from-accent via-accent to-accent/60 rounded-r-full"
              {...imageLoadBarProgress}
              animate={{ width: `${Math.min(loadProgress, 100)}%` }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <UploadDialog
        open={showUpload}
        onClose={() => setShowUpload(false)}
        onFiles={handleAddPhotos}
        isLoading={isImageLoading}
        loadProgress={loadProgress}
        canClose={photos.length > 0}
      />

      <ShortcutModal
        open={showShortcutModal}
        onClose={() => setShowShortcutModal(false)}
        showDevTools={devToolsEnabled}
      />

      {devToolsEnabled && (
        <DiagnosticLogOverlay
          open={showDiagnostics}
          onClose={() => setShowDiagnostics(false)}
        />
      )}

      {devToolsEnabled && (
        <DevTierDialog
          open={showDevTier}
          onOpenChange={setShowDevTier}
          mode={effectiveUserMode}
          overridden={devTierOverride !== null}
          onSelect={(m) => setDevTierOverride(m)}
          onReset={() => setDevTierOverride(null)}
        />
      )}

      <Toaster />

      <Dialog open={deleteAllOpen} onOpenChange={setDeleteAllOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete all images?</DialogTitle>
            <DialogDescription>
              This will remove all {photos.length} image{photos.length !== 1 ? "s" : ""} and their edit history. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <DialogClose asChild>
              <LargeButton className="flex-1">Cancel</LargeButton>
            </DialogClose>
            <LargeButton
              onClick={confirmDeleteAll}
              className="flex-1 border-destructive/40 bg-destructive/15 text-destructive hover:border-destructive hover:bg-destructive/25 hover:brightness-100"
            >
              <Trash2 className="h-4 w-4" />
              Delete all
            </LargeButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AnimatePresence>
        {showTopBar && (
          <TopBar
            zoom={stamp.state.zoom}
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onUndo={stamp.undo}
            onRedo={stamp.redo}
            canUndo={canUndo}
            canRedo={canRedo}
            showUpload={showUpload}
            showTools={showTools}
            showGallery={showGallery}
            showHistory={showHistory}
            onToggleUpload={() => setShowUpload((v) => !v)}
            onToggleTools={() => setShowTools((v) => !v)}
            onToggleGallery={() => setShowGallery((v) => !v)}
            onToggleHistory={() => setShowHistory((v) => !v)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showTools && (
          <ToolsSidebar
            onClose={() => setShowTools(false)}
            activeTool={activeTool}
            onToolChange={(t) => { setActiveTool(t); }}
            stampSettings={stampSettings}
            onStampSettingsChange={handleStampSettingsChange}
            hasSource={stamp.state.hasSource}
            onExport={handleExport}
            onExportAll={handleExportAll}
            canExport={hasImage}
            photoCount={photos.length}
            modifiedCount={modifiedPhotos.size}
            activeModified={
              activePhotoId != null &&
              (modifiedPhotos.has(activePhotoId) ||
                hasBeenModified ||
                stamp.state.undoCount > 0)
            }
            exportFormat={exportFormat}
            onExportFormatChange={setExportFormat}
            onFlipH={stamp.flipHorizontal}
            onFlipV={stamp.flipVertical}
            onRotate90Cw={stamp.rotate90Cw}
            onBrightness={stamp.adjustBrightness}
            onContrast={stamp.adjustContrast}
            onGlobalBlur={stamp.applyGlobalBlur}
            imageReady={hasImage}
            onResize={handleApplyCompression}
            imageWidth={stamp.state.width}
            imageHeight={stamp.state.height}
            currentByteSize={activeEntry?.byteSize ?? 0}
            currentMime={activeEntry?.mimeType}
            originalByteSize={activeEntry?.originalByteSize ?? 0}
            activePhotoId={activePhotoId}
            undoCount={stamp.state.undoCount}
            quality={quality}
            onQualityChange={handleQualityChange}
            hasBeenModified={hasBeenModified}
            compareActive={compareActive}
            onToggleCompare={handleToggleCompare}
            onAutoCompress={handleAutoCompress}
            isCompressing={compressProgress.running}
            compressProgress={compressProgress}
            selectedCount={selectedIds.size}
            onApplyCrop={drawingTools.applyCrop}
            onSetCropSelection={drawingTools.setCropSelection}
            cropRatio={cropRatio}
            onCropRatioChange={setCropRatio}
            toolSettings={toolSettings}
            onToolSettingsChange={handleToolSettingsChange}
            shapesMode={shapesMode}
            onShapesModeChange={setShapesMode}
            brushMode={brushMode}
            onBrushModeChange={setBrushMode}
            effectsMode={effectsMode}
            onEffectsModeChange={setEffectsMode}
            colorPickerActive={colorPickerActive}
            onSetColorPickerActive={setColorPickerActive}
            pickedColor={toolSettings.brushColor}
            stampSubMode={stampSubMode}
            onStampSubModeChange={setStampSubMode}
            stampEmoji={toolSettings.emoji}
            stampEmojiSize={toolSettings.emojiSize}
            onStampEmojiChange={(e) => setToolSettings((prev) => ({ ...prev, emoji: e }))}
            onStampEmojiSizeChange={(s) => setToolSettings((prev) => ({ ...prev, emojiSize: s }))}
            photos={photos}
            setPhotos={setPhotos}
            stampToolRef={stamp.toolRef}
            flushToCanvas={stamp.flushToCanvas}
            syncState={stamp.syncState}
            aiEnabled={hasReplicateAI(effectiveUserMode)}
            onAIResult={handleAIResult}
          />
        )}
      </AnimatePresence>

      <ContextMenu>
        <ContextMenuTrigger asChild>
          <motion.main
            animate={{
              marginLeft: showTools ? 320 : 0,
              marginRight: showHistory ? 284 : 0,
            }}
            transition={panelSpacingTransition}
            className="main-content"
            style={{ position: "relative" }}
          >
            <>
              {/* Emoji-grid mode: wrap the grid host in a flex pane sized to
                  fit between the fixed TopBar and GalleryBar. The grid sits
                  inside, capped at a 5:3 aspect ratio with gap + padding for
                  breathing room. Non-emoji mode falls through to the regular
                  full-size canvas host. The CanvasArea below is rendered ONCE
                  (a stable React subtree) so the canvas DOM + WASM pixels
                  survive tool switches; only the wrapper around it changes. */}
              {activeTool === "emoji" ? (
                <div
                  style={{
                    position: "absolute",
                    top: showTopBar ? 80 : 12,
                    bottom: showGallery ? 168 : 56,
                    left: 12,
                    right: 12,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    minHeight: 0,
                    minWidth: 0,
                  }}
                >
                  <div
                    className="canvas-grid-host checkerboard-dark"
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(5, 1fr)",
                      gridTemplateRows: "repeat(3, 1fr)",
                      gap: "12px",
                      padding: "12px",
                      maxWidth: "100%",
                      maxHeight: "100%",
                      width: "auto",
                      margin: "auto",
                      aspectRatio: "5 / 3",
                    }}
                  >
                    <div
                      className={`canvas-grid-hero${
                        activePhotoId && photos.length > 0
                          ? " ring-2 ring-orange-400"
                          : ""
                      }`}
                      style={{
                        gridArea: "1 / 1 / 3 / 3",
                        position: "relative",
                        overflow: "hidden",
                        borderRadius: "0.375rem",
                      }}
                    >
                      <div style={{ position: "absolute", inset: 0 }}>
                        <CanvasArea
                          ref={canvasRef}
                          hookResult={effectiveStamp}
                          brushDiameter={diameter}
                          cursorPos={pos}
                          cursorVisible={visible}
                          onCanvasEnter={onCanvasEnter}
                          onCanvasLeave={() => { onCanvasLeave(); colorPicker.onMouseLeave(); }}
                          beforeUrl={originalUrl}
                          compareActive={compareActive}
                          activeTool={activeTool}
                          textInput={textTool.textInput}
                          textareaRef={textTool.textareaRef}
                          onCanvasClick={textTool.onCanvasClick}
                          onTextKeyDown={textTool.onTextKeyDown}
                          onTextChange={textTool.onTextChange}
                          onTextBlur={textTool.onTextBlur}
                          textSettings={{
                            fontSize: toolSettings.fontSize,
                            fontFamily: toolSettings.fontFamily,
                            fontWeight: toolSettings.fontWeight,
                            textColor: toolSettings.textColor,
                            bgKind: toolSettings.bgKind,
                            bgColor: toolSettings.bgColor,
                            bgOpacity: toolSettings.bgOpacity,
                            bgPadding: toolSettings.bgPadding,
                            bgCornerRadius: toolSettings.bgCornerRadius,
                            bgTail: toolSettings.bgTail,
                          }}
                          containerRef={containerRef}
                          onTextPositionChange={textTool.setTextPosition}
                          onTextFontSizeChange={handleTextFontSizeChange}
                          onTextRotationChange={textTool.setTextRotation}
                          annotations={annotationBoxes}
                          hoveredAnnotationId={textTool.hoveredAnnotationId}
                          onCanvasHover={textTool.onCanvasHover}
                          isPanning={isPanning}
                          cropSelection={drawingTools.cropSelection}
                          onCropChange={(sel) => drawingTools.setCropSelection(sel)}
                          colorPickerActive={colorPickerActive}
                          drawEditState={drawingTools.editState}
                          onDrawEditChange={drawingTools.updateEditGeometry}
                          drawSettings={{
                            strokeColor: toolSettings.strokeColor,
                            strokeWidth: toolSettings.strokeWidth,
                            arrowStyle: toolSettings.arrowStyle,
                            shape: toolSettings.shape ?? "rect",
                          }}
                        />
                      </div>
                      {(!activePhotoId || photos.length === 0) && (
                        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-zinc-950/95 text-center text-theme-muted-foreground">
                          <ImagePlus className="h-10 w-10 opacity-60" />
                          <p className="text-sm font-medium">No photos loaded</p>
                          <p className="text-xs">Upload images to start batch editing</p>
                        </div>
                      )}
                      {activePhotoId && photos.length > 0 && (
                        <div className="absolute top-2 left-2 z-20 rounded-full bg-orange-500 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white shadow-md">
                          Selected
                        </div>
                      )}
                    </div>
                    <GridThumbnails
                      photos={photos}
                      activePhotoId={activePhotoId}
                      onSelectPhoto={handleSelectPhoto}
                    />
                  </div>
                </div>
              ) : (
                <div className="canvas-fullsize-host">
                  <div className="canvas-fullsize-slot">
                    <CanvasArea
                      ref={canvasRef}
                      hookResult={effectiveStamp}
                      brushDiameter={diameter}
                      cursorPos={pos}
                      cursorVisible={visible}
                      onCanvasEnter={onCanvasEnter}
                      onCanvasLeave={() => { onCanvasLeave(); colorPicker.onMouseLeave(); }}
                      beforeUrl={originalUrl}
                      compareActive={compareActive}
                      activeTool={activeTool}
                      textInput={textTool.textInput}
                      textareaRef={textTool.textareaRef}
                      onCanvasClick={textTool.onCanvasClick}
                      onTextKeyDown={textTool.onTextKeyDown}
                      onTextChange={textTool.onTextChange}
                      onTextBlur={textTool.onTextBlur}
                      textSettings={{
                        fontSize: toolSettings.fontSize,
                        fontFamily: toolSettings.fontFamily,
                        fontWeight: toolSettings.fontWeight,
                        textColor: toolSettings.textColor,
                        bgKind: toolSettings.bgKind,
                        bgColor: toolSettings.bgColor,
                        bgOpacity: toolSettings.bgOpacity,
                        bgPadding: toolSettings.bgPadding,
                        bgCornerRadius: toolSettings.bgCornerRadius,
                        bgTail: toolSettings.bgTail,
                      }}
                      containerRef={containerRef}
                      onTextPositionChange={textTool.setTextPosition}
                      onTextFontSizeChange={handleTextFontSizeChange}
                      onTextRotationChange={textTool.setTextRotation}
                      annotations={annotationBoxes}
                      hoveredAnnotationId={textTool.hoveredAnnotationId}
                      onCanvasHover={textTool.onCanvasHover}
                      isPanning={isPanning}
                      cropSelection={drawingTools.cropSelection}
                      onCropChange={(sel) => drawingTools.setCropSelection(sel)}
                      colorPickerActive={colorPickerActive}
                      drawEditState={drawingTools.editState}
                      onDrawEditChange={drawingTools.updateEditGeometry}
                      drawSettings={{
                        strokeColor: toolSettings.strokeColor,
                        strokeWidth: toolSettings.strokeWidth,
                        arrowStyle: toolSettings.arrowStyle,
                        shape: toolSettings.shape ?? "rect",
                      }}
                    />
                  </div>
                </div>
              )}
              <MagnifierOverlay magnifier={colorPicker.magnifier} />
            </>
          </motion.main>
        </ContextMenuTrigger>

        <ContextMenuContent className="w-72">
          <ContextMenuItem onClick={stamp.undo} disabled={!canUndo}>
            <Undo className="h-4 w-4 mr-2" /> Undo
            <ContextMenuShortcut>Ctrl+Z</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem onClick={stamp.redo} disabled={!canRedo}>
            <Redo className="h-4 w-4 mr-2" /> Redo
            <ContextMenuShortcut>Ctrl+Shift+Z</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={handleCopyToClipboard} disabled={!hasImage}>
            <Clipboard className="h-4 w-4 mr-2" /> Copy to Clipboard
            <ContextMenuShortcut>Ctrl+Shift+C</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem onClick={handleExport} disabled={!hasImage}>
            <Download className="h-4 w-4 mr-2" /> Export{" "}
            {exportFormat.toUpperCase()}
            <ContextMenuShortcut>Alt+E</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem
            onClick={handleExportAll}
            disabled={photos.length === 0}
          >
            <Archive className="h-4 w-4 mr-2" /> Export All (ZIP)
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            onClick={handleActivateEyedropper}
            disabled={!hasImage}
          >
            <Pipette className="h-4 w-4 mr-2" /> Activate Eyedropper
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={handleZoomIn}>
            <ZoomIn className="h-4 w-4 mr-2" /> Zoom In
            <ContextMenuShortcut>Alt+=</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem onClick={handleZoomOut}>
            <ZoomOut className="h-4 w-4 mr-2" /> Zoom Out
            <ContextMenuShortcut>Alt+-</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem onClick={stamp.flipHorizontal} disabled={!hasImage}>
            <RotateCcw className="h-4 w-4 mr-2" /> Flip Horizontal
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            onClick={handleDeleteAll}
            disabled={photos.length === 0}
            className="text-red-400 focus:text-red-400"
          >
            <Trash2 className="h-4 w-4 mr-2" /> Delete All
            <ContextMenuShortcut>Alt+D</ContextMenuShortcut>
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      <AnimatePresence>
        {showGallery && (
          <GalleryBar
            photos={photos}
            activeId={activePhotoId}
            onSelect={handleSelectPhoto}
            onRemove={handleRemovePhoto}
            onClose={() => setShowGallery(false)}
            showTools={showTools}
            showHistory={showHistory}
            compressionProgress={compressProgress.items ?? {}}
            compressionSavings={imageSavings}
            modifiedPhotos={modifiedPhotos}
            maxPhotos={maxPhotos}
            onDeleteAll={handleDeleteAll}
            onDeleteSelected={handleDeleteSelected}
            onDuplicateSelected={handleDuplicateSelected}
            onExportSelected={handleExportSelected}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelectPhoto}
            onClearSelection={clearSelection}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showHistory && (
          <ReviewPanel
            history={stamp.state.history}
            onJump={stamp.jumpToHistory}
            onDelete={stamp.deleteHistoryEntry}
            onClose={() => setShowHistory(false)}
            onUndo={stamp.undo}
            canUndo={canUndo}
            objects={reselectObjects}
            onSelectObject={handleSelectObject}
            onDeleteObject={handleDeleteObject}
            userMode={effectiveUserMode}
            layers={stamp.state.layers}
            onAddLayer={() => stamp.addLayer()}
            onDuplicateLayer={stamp.duplicateLayer}
            onDeleteLayer={stamp.removeLayer}
            onSelectLayer={stamp.setActiveLayer}
            onToggleLayerVisible={stamp.setLayerVisible}
            onSetLayerOpacity={stamp.setLayerOpacity}
            onRenameLayer={stamp.renameLayer}
            onMoveLayer={stamp.moveLayer}
            onMergeDown={stamp.mergeDown}
            onFlattenAll={stamp.flattenAll}
          />
        )}
      </AnimatePresence>

      {AUTH_ENABLED && <AuthModeWatcher onMode={handleAuthMode} />}

      {photos.length > 0 && (
        <StatusBar
          state={stamp.state}
          fileSize={photos.find((p) => p.id === activePhotoId)?.byteSize}
          activeToolHint={
            drawingTools.editState
              ? { keys: "Enter/Esc", label: "place / cancel" }
              : TOOL_SHORTCUT[activeTool]
          }
          onUnlockClick={handleDevUnlockClick}
        />
      )}

      {/* Brush cursor — hidden during pan mode */}
      {visible &&
        !isPanning &&
        !colorPickerActive &&
        (activeTool === "stamp" ||
          activeTool === "brush" ||
          activeTool === "emoji") && (
          <div
            className="brush-cursor"
            style={{
              left: pos.x,
              top: pos.y,
              width: diameter,
              height: diameter,
            }}
          />
        )}
    </div>
  );
}
