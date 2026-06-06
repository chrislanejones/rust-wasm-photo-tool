// ===== FILE: app/src/app/AppShell.tsx =====
// Changes:
//   Item 2: Spacebar pan mode
//   Item 4: PgUp/PgDn gallery cycling
//   Item 7: blur → effects rename, brightness/contrast in effects panel
//   All other existing functionality preserved
import { useCallback, useEffect, useRef, useState } from "react";
import { useUser } from "@clerk/clerk-react";
import { AnimatePresence, motion } from "framer-motion";
import { useCloneStamp } from "@/hooks/useCloneStamp";
import { useBrushPreview } from "@/hooks/useBrushPreview";
import { useDrawingTools } from "@/hooks/useDrawingTools";
import { useEmojiTool } from "@/hooks/useEmojiTool";
import { usePaintTool } from "@/hooks/usePaintTool";
import { useTextTool } from "@/hooks/useTextTool";
import { useRedStampTool } from "@/hooks/useRedStampTool";
import type { ToolType, StampSettings, ToolSettings } from "@/lib/types";
import type { TextMemory } from "@/features/tools/settings/TextSettings";
import { defaultToolSettings } from "@/lib/defaultToolSettings";
import { panelSpacingTransition, imageLoadBarFade, imageLoadBarProgress } from "@/lib/animations";
import { TopBar } from "@/components/TopBar";
import { StatusBar, type UserMode } from "@/components/StatusBar";
import { ShortcutModal } from "@/components/ShortcutModal";
import { Toaster, toast } from "@/components/ui/sonner";
import { ToolsSidebar } from "@/features/tools";
import { CanvasArea } from "@/features/canvas/CanvasArea";
import { GridThumbnails } from "@/features/canvas/GridThumbnails";
import { HistoryPanel } from "@/features/canvas/HistoryPanel";
import { GalleryBar, type PhotoEntry } from "@/features/gallery/GalleryBar";
import { UploadDialog } from "@/features/upload/UploadDialog";
import { getPhotoLimit, DEFAULT_PHOTO_LIMIT } from "@/lib/photoLimits";
import { useKeyboardShortcuts } from "./useKeyboardShortcuts";
import { useColorPicker } from "@/hooks/useColorPicker";
import { MagnifierOverlay } from "@/components/MagnifierOverlay";
import type { EffectsMode } from "@/features/tools/settings/EffectsSettings";
import { useAutoCompress } from "@/hooks/useAutoCompress";
import { useEditPersistence } from "@/hooks/useEditPersistence";
import { useRecentTexts } from "@/hooks/useRecentTexts";
import { putOriginal, getOriginal, getOriginalAsBlobUrl } from "@/lib/originalsStore";
import { makeWorkingCopy, makeThumbnail } from "@/lib/workingCopy";
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
import { Button } from "@/components/ui/button";
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
} from "lucide-react";

export type ExportFormat = "png" | "jpeg" | "webp" | "avif";

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
  const { savePhotoEdit, loadPhotoEdit, deletePhotoEdit, clearAllEdits } = useEditPersistence();
  const { recentTexts, addRecentText } = useRecentTexts();

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
  const [shapesMode, setShapesMode] = useState<"shapes" | "arrows">("shapes");
  /** Active Crop-tool aspect ratio. `null` ≡ "Free" (no constraint).
   *  Drags in useDrawingTools snap to this ratio via Rust when set. */
  const [cropRatio, setCropRatio] = useState<[number, number] | null>(null);
  const [userMode, setUserMode] = useState<UserMode>("demo");
  const handleAuthMode = useCallback((m: UserMode) => setUserMode(m), []);

  // Gallery photo cap for the current tier. Resolved from Rust (`photo_limit`)
  // so the WASM layer is the single source of truth. Starts at the most
  // restrictive limit until the wasm lookup resolves.
  const [maxPhotos, setMaxPhotos] = useState(DEFAULT_PHOTO_LIMIT);
  useEffect(() => {
    let alive = true;
    void getPhotoLimit(userMode).then((n) => {
      if (alive) setMaxPhotos(n);
    });
    return () => {
      alive = false;
    };
  }, [userMode]);

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

  const reopenWithRef = useRef<((text: string) => void) | null>(null);

  const handleSelectRecentText = useCallback((m: TextMemory) => {
    setToolSettings((prev) => ({
      ...prev,
      fontSize: m.fontSize,
      fontFamily: m.fontFamily ?? "sans-serif",
      fontWeight: m.fontWeight,
      textColor: m.textColor,
    }));
    reopenWithRef.current?.(m.text);
  }, []);

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
  const activeOriginalKey = activeEntry?.originalKey ?? null;

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
        toast.error(capMessage(userMode, maxPhotos));
        return;
      }
      const accepted = files.length > remaining ? files.slice(0, remaining) : files;
      if (files.length > remaining) {
        toast.error(capMessage(userMode, maxPhotos));
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
          const working = await makeWorkingCopy(f);
          const [originalKey, thumbBlob] = await Promise.all([
            putOriginal(f, working.origWidth, working.origHeight),
            makeThumbnail(f),
          ]);
          const entry: PhotoEntry = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
            name: f.name.replace(/\.[^.]+$/, ""),
            mimeType: f.type || "application/octet-stream",
            byteSize: f.size,
            origWidth: working.origWidth,
            origHeight: working.origHeight,
            workingWidth: working.width,
            workingHeight: working.height,
            thumbBlob,
            originalKey,
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
        }
      }
    },
    [activePhotoId, hasBeenModified, stamp, loadImageFromPixels, savePhotoEdit, photos.length, maxPhotos, userMode],
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

      const saved = await loadPhotoEdit(entry.id);
      if (saved) {
        setIsImageLoading(true);
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

  const [showUpload, setShowUpload] = useState(true);
  const [showTopBar, setShowTopBar] = useState(false);
  const [showTools, setShowTools] = useState(false);
  const [showGallery, setShowGallery] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showShortcutModal, setShowShortcutModal] = useState(false);
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
      setShowUpload(true);
      setShowTopBar(false);
      setShowTools(false);
      setShowGallery(false);
      setShowHistory(false);
    }
  }, [photos.length]);
  useEffect(() => () => { revealTimers.current.forEach(clearTimeout); }, []);

  const handleTextFontSizeChange = useCallback((size: number) => {
    setToolSettings((prev) => ({ ...prev, fontSize: size }));
  }, []);

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
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      canvas.width = 0;
      canvas.height = 0;
    }
    setActivePhotoId(null);
    setOriginalUrl(null);
    setHasBeenModified(false);
    setCompareActive(false);
    setPhotos([]);
  }, [clearAllEdits]);

  const handlePickColor = useCallback((hex: string) => {
    setToolSettings((prev) => ({ ...prev, brushColor: hex, textColor: hex }));
    setColorPickerActive(false);
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
  reopenWithRef.current = textTool.reopenWith;

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

  const handleToggleCompare = useCallback(() => {
    setCompareActive((v) => !v);
  }, []);

  const handleResize = useCallback(
    (w: number, h: number) => {
      const origW = stamp.state.width;
      const origH = stamp.state.height;
      if (w !== origW || h !== origH) {
        stamp.resize(w, h);
      }
      setHasBeenModified(true);
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
    },
    [stamp, activePhotoId, quality],
  );

  const handleAutoCompress = useCallback(async () => {
    // Load originals from IndexedDB to build File objects for the compress hook
    const photosForCompress = (
      await Promise.all(
        photos.map(async (p) => {
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
              x.id !== id ? x : { ...x, originalKey: newKey, thumbBlob: newThumb },
            ),
          );
        })();
      },
    );
    setHasBeenModified(true);
  }, [photos, quality, exportFormat, compressAll]);

  // Track per-photo modification state
  useEffect(() => {
    if (hasBeenModified && activePhotoId) {
      setModifiedPhotos((prev) => {
        if (prev.has(activePhotoId)) return prev;
        const next = new Set(prev);
        next.add(activePhotoId);
        return next;
      });
    }
  }, [hasBeenModified, activePhotoId]);

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

  const handleExportAll = useCallback(async () => {
    if (photos.length === 0) return;
    const { default: JSZip } = await import("jszip");
    const zip = new JSZip();
    const ext = exportFormat === "jpeg" ? ".jpg" : `.${exportFormat}`;
    for (const photo of photos) {
      const original = await getOriginal(photo.originalKey);
      if (original) {
        zip.file(
          `${photo.name}${ext}`,
          new Blob([original.bytes], { type: original.mimeType }),
        );
      }
    }
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "photos.zip";
    a.click();
    URL.revokeObjectURL(url);
  }, [photos, exportFormat]);

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
      />

      <Toaster />

      <Dialog open={deleteAllOpen} onOpenChange={setDeleteAllOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete all images?</DialogTitle>
            <DialogDescription>
              This will remove all {photos.length} image{photos.length !== 1 ? "s" : ""} and their edit history. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button variant="destructive" onClick={confirmDeleteAll}>
              Delete all
            </Button>
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
            imageCount={photos.length}
            exportFormat={exportFormat}
            onExportFormatChange={setExportFormat}
            onExport={handleExport}
            hasSelectedImage={hasImage}
            onDeleteAll={handleDeleteAll}
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
            exportFormat={exportFormat}
            onExportFormatChange={setExportFormat}
            onFlipH={stamp.flipHorizontal}
            onFlipV={stamp.flipVertical}
            onRotate90Cw={stamp.rotate90Cw}
            onBrightness={stamp.adjustBrightness}
            onContrast={stamp.adjustContrast}
            onGlobalBlur={stamp.applyGlobalBlur}
            imageReady={hasImage}
            onResize={handleResize}
            imageWidth={stamp.state.width}
            imageHeight={stamp.state.height}
            activePhotoId={activePhotoId}
            quality={quality}
            onQualityChange={handleQualityChange}
            hasBeenModified={hasBeenModified}
            compareActive={compareActive}
            onToggleCompare={handleToggleCompare}
            onAutoCompress={handleAutoCompress}
            isCompressing={compressProgress.running}
            compressProgress={compressProgress}
            onApplyCrop={drawingTools.applyCrop}
            onSetCropSelection={drawingTools.setCropSelection}
            cropRatio={cropRatio}
            onCropRatioChange={setCropRatio}
            toolSettings={toolSettings}
            onToolSettingsChange={handleToolSettingsChange}
            recentTexts={recentTexts}
            onSelectRecentText={handleSelectRecentText}
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
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showHistory && (
          <HistoryPanel
            history={stamp.state.history}
            onJump={stamp.jumpToHistory}
            onDelete={stamp.deleteHistoryEntry}
            onClear={stamp.clearHistory}
            onClose={() => setShowHistory(false)}
          />
        )}
      </AnimatePresence>

      {AUTH_ENABLED && <AuthModeWatcher onMode={handleAuthMode} />}

      {photos.length > 0 && (
        <StatusBar
          state={stamp.state}
          imageCount={photos.length}
          userMode={userMode}
          maxPhotos={maxPhotos}
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
