// ===== FILE: app/src/app/AppShell.tsx =====
// Changes:
//   Item 2: Spacebar pan mode
//   Item 4: PgUp/PgDn gallery cycling
//   Item 7: blur → effects rename, brightness/contrast in effects panel
//   All other existing functionality preserved
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useCloneStamp } from "@/hooks/useCloneStamp";
import { useBrushPreview } from "@/hooks/useBrushPreview";
import { useDrawingTools } from "@/hooks/useDrawingTools";
import { useEmojiTool } from "@/hooks/useEmojiTool";
import { usePaintTool } from "@/hooks/usePaintTool";
import { useTextTool } from "@/hooks/useTextTool";
import { useTextExtract } from "@/hooks/useTextExtract";
import { useRedStampTool } from "@/hooks/useRedStampTool";
import type { ToolType, StampSettings, ToolSettings } from "@/lib/types";
import type { TextMemory } from "@/features/tools/settings/TextSettings";
import { defaultToolSettings } from "@/lib/defaultToolSettings";
import { panelSpacingTransition } from "@/lib/animations";
import { TopBar } from "@/components/TopBar";
import { StatusBar } from "@/components/StatusBar";
import { ShortcutModal } from "@/components/ShortcutModal";
import { ToolsSidebar } from "@/features/tools";
import { CanvasArea } from "@/features/canvas/CanvasArea";
import { HistoryPanel } from "@/features/canvas/HistoryPanel";
import { GalleryBar, type PhotoEntry } from "@/features/gallery/GalleryBar";
import { UploadDialog } from "@/features/upload/UploadDialog";
import { useKeyboardShortcuts } from "./useKeyboardShortcuts";
import { useColorPicker } from "@/hooks/useColorPicker";
import { MagnifierOverlay } from "@/components/MagnifierOverlay";
import type { EffectsMode } from "@/features/tools/settings/EffectsSettings";
import { useAutoCompress } from "@/hooks/useAutoCompress";
import { useEditPersistence } from "@/hooks/useEditPersistence";
import { useRecentTexts } from "@/hooks/useRecentTexts";
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
} from "lucide-react";

export type ExportFormat = "png" | "jpeg" | "webp" | "avif";

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

  const loadImageWithProgress = useCallback(
    (file: File) => {
      setIsImageLoading(true);
      setLoadProgress(0);
      if (loadIntervalRef.current) clearInterval(loadIntervalRef.current);
      loadIntervalRef.current = setInterval(() => {
        setLoadProgress((prev) => {
          if (prev >= 90) return 90;
          return prev + Math.random() * 15;
        });
      }, 100);
      stamp.loadImage(file);
    },
    [stamp],
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

  const handleAddPhotos = useCallback(
    async (files: File[]) => {
      const entries: PhotoEntry[] = files.map((f) => ({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        url: URL.createObjectURL(f),
        name: f.name.replace(/\.[^.]+$/, ""),
        file: f,
      }));
      // Commit modification status before switching
      if (activePhotoId && (stamp.state.undoCount > 0 || hasBeenModified)) {
        setModifiedPhotos((prev) => {
          if (prev.has(activePhotoId)) return prev;
          const next = new Set(prev);
          next.add(activePhotoId);
          return next;
        });
      }
      // Persist current photo before switching to the first new one
      if (activePhotoId && stamp.toolRef.current) {
        await savePhotoEdit(activePhotoId, stamp.toolRef);
      }
      setPhotos((prev) => [...prev, ...entries]);
      const first = entries[0];
      if (first) {
        loadImageWithProgress(first.file);
        setHasBeenModified(false);
        setActivePhotoId(first.id);
        setOriginalUrl(first.url);
        setCompareActive(false);
      }
    },
    [activePhotoId, hasBeenModified, stamp, loadImageWithProgress],
  );

  const handleSelectPhoto = useCallback(
    async (entry: PhotoEntry) => {
      if (entry.id === activePhotoId) return;

      // Synchronously commit the current photo's modified status before any
      // state reset. undoCount > 0 catches all tool edits (brush, stamp, crop,
      // etc.) that never call setHasBeenModified directly.
      if (activePhotoId && (stamp.state.undoCount > 0 || hasBeenModified)) {
        setModifiedPhotos((prev) => {
          if (prev.has(activePhotoId)) return prev;
          const next = new Set(prev);
          next.add(activePhotoId);
          return next;
        });
      }

      // Persist the current photo's canvas + full undo/redo history
      if (activePhotoId && stamp.toolRef.current) {
        await savePhotoEdit(activePhotoId, stamp.toolRef);
      }

      // Reset modification flag in the same batch as the activePhotoId change so
      // the useEffect never sees a new id paired with the previous photo's dirty state.
      setHasBeenModified(false);
      setActivePhotoId(entry.id);
      setOriginalUrl(entry.url);
      setCompareActive(false);

      // Restore previously-saved edit for the target photo, or load fresh
      const saved = await loadPhotoEdit(entry.id);
      if (saved) {
        setIsImageLoading(true);
        setLoadProgress(20);
        await stamp.loadFromSaved(saved);
        setLoadProgress(100);
        setTimeout(() => { setIsImageLoading(false); setLoadProgress(0); }, 400);
        // Do NOT set hasBeenModified here — the photo is already in modifiedPhotos
        // from when the edits were originally made; re-setting it would mark any
        // photo with a saved edit as dirty just from clicking it.
      } else {
        loadImageWithProgress(entry.file);
      }
    },
    [activePhotoId, hasBeenModified, stamp, loadImageWithProgress],
  );

  // Item 4: PgUp/PgDn gallery cycling
  const handleNextPhoto = useCallback(() => {
    if (photos.length === 0) return;
    const idx = photos.findIndex((p) => p.id === activePhotoId);
    const next = photos[(idx + 1) % photos.length];
    if (next) handleSelectPhoto(next);
  }, [photos, activePhotoId, handleSelectPhoto]);

  const handlePrevPhoto = useCallback(() => {
    if (photos.length === 0) return;
    const idx = photos.findIndex((p) => p.id === activePhotoId);
    const prev = photos[(idx - 1 + photos.length) % photos.length];
    if (prev) handleSelectPhoto(prev);
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
        const removed = prev[idx];
        if (removed) URL.revokeObjectURL(removed.url);
        if (id === activePhotoId && next.length > 0) {
          const na = next[Math.min(idx, next.length - 1)]!;
          loadImageWithProgress(na.file);
          setActivePhotoId(na.id);
          setOriginalUrl(na.url);
          setHasBeenModified(false);
          setCompareActive(false);
        } else if (next.length === 0) {
          setActivePhotoId(null);
          setOriginalUrl(null);
          setHasBeenModified(false);
          setCompareActive(false);
        }
        return next;
      });
    },
    [activePhotoId, loadImageWithProgress],
  );

  const [showUpload, setShowUpload] = useState(true);
  const [showTopBar, setShowTopBar] = useState(false);
  const [showTools, setShowTools] = useState(true);
  const [showGallery, setShowGallery] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showShortcutModal, setShowShortcutModal] = useState(false);
  const [deleteAllOpen, setDeleteAllOpen] = useState(false);


  const [activeTool, setActiveTool] = useState<ToolType>("compress");
  const [textExtractActive, setTextExtractActive] = useState(false);

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
  useEffect(() => {
    const prev = prevPhotoCount.current;
    const curr = photos.length;
    if (prev === 0 && curr > 0) {
      setShowUpload(false);
      const t1 = setTimeout(() => setShowTopBar(true), 150);
      const t2 = setTimeout(() => setShowTools(true), 500);
      const t3 = setTimeout(() => setShowGallery(true), 850);
      prevPhotoCount.current = curr;
      return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
    }
    if (curr === 0) {
      setShowUpload(true);
      setShowTopBar(false);
      setShowTools(false);
      setShowGallery(false);
      setShowHistory(false);
    }
    prevPhotoCount.current = curr;
    return undefined;
  }, [photos.length]);

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
    const toRevoke = photos.map((p) => p.url);
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
    requestAnimationFrame(() => {
      toRevoke.forEach((url) => URL.revokeObjectURL(url));
    });
  }, [photos]);

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

  const textExtract = useTextExtract({
    toolRef: stamp.toolRef,
    canvasRef,
    active: textExtractActive && activeTool === "text",
    flushToCanvas: stamp.flushToCanvas,
  });

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
      // Route to red stamp if a preset is selected, else clone stamp
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
    const c = canvasRef.current;
    if (!c) return;
    try {
      const b = await new Promise<Blob | null>((r) =>
        c.toBlob((v) => r(v), "image/png"),
      );
      if (b)
        await navigator.clipboard.write([new ClipboardItem({ [b.type]: b })]);
    } catch {}
  }, []);

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

  const handleAutoCompress = useCallback(() => {
    compressAll(
      photos,
      {
        maxWidth: 2200,
        maxHeight: 2200,
        quality: quality / 100,
        format: `image/${exportFormat === "png" ? "webp" : exportFormat}`,
      },
      (id: string, nf: File, nu: string) => {
        setPhotos((p) =>
          p.map((x) => {
            if (x.id !== id) return x;
            URL.revokeObjectURL(x.url);
            return { ...x, file: nf, url: nu };
          }),
        );
      },
    );
    setHasBeenModified(true);
  }, [photos, quality, exportFormat, compressAll]);

  // Track per-photo modification state (any tool change marks the photo)
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

  // Persist compression savings from auto-compress before they clear after 3s
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
      zip.file(`${photo.name}${ext}`, photo.file);
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
    onToolChange: setActiveTool,
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
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed top-0 left-0 right-0 z-100 h-1 bg-bg-elevated"
          >
            <motion.div
              className="h-full bg-linear-to-r from-accent via-accent to-accent/60 rounded-r-full"
              initial={{ width: "0%" }}
              animate={{ width: `${Math.min(loadProgress, 100)}%` }}
              transition={{ duration: 0.15, ease: "easeOut" }}
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
            onToolChange={(t) => { setActiveTool(t); setTextExtractActive(false); }}
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
            toolSettings={toolSettings}
            onToolSettingsChange={setToolSettings}
            recentTexts={recentTexts}
            onSelectRecentText={handleSelectRecentText}
            onStartTextExtract={() => setTextExtractActive((v) => !v)}
            textExtractActive={textExtractActive}
            recognizedText={textExtract.recognizedText}
            isRecognizing={textExtract.isRecognizing}
            onClearRecognizedText={textExtract.clearText}
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
            {photos.length > 0 ? (
              <>
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
                }}
                containerRef={containerRef}
                onTextPositionChange={textTool.setTextPosition}
                onTextFontSizeChange={handleTextFontSizeChange}
                extractMouseDown={textExtract.onMouseDown}
                extractMouseMove={textExtract.onMouseMove}
                extractMouseUp={textExtract.onMouseUp}
                isPanning={isPanning}
                cropSelection={drawingTools.cropSelection}
                onCropChange={(sel) => drawingTools.setCropSelection(sel)}
                colorPickerActive={colorPickerActive}
              />
              <MagnifierOverlay magnifier={colorPicker.magnifier} />
              </>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="flex flex-col items-center gap-4 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-bg-elevated/50 border border-border/50 flex items-center justify-center">
                    <span className="text-3xl">🐴</span>
                  </div>
                  <div>
                    <p className="text-sm text-text-muted font-medium">
                      No images loaded
                    </p>
                    <p className="text-xs text-text-muted/60 mt-1">
                      Press{" "}
                      <kbd className="px-1.5 py-0.5 rounded bg-bg-elevated border border-border text-[10px] font-mono">
                        Alt+U
                      </kbd>{" "}
                      to upload
                    </p>
                  </div>
                </div>
              </div>
            )}
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

      {photos.length > 0 && (
        <StatusBar
          state={stamp.state}
          imageCount={photos.length}
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
