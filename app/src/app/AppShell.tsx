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
import { useAutoCompress } from "@/hooks/useAutoCompress";
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
} from "@/components/ui/context-menu";
import {
  Undo,
  Redo,
  Download,
  Clipboard,
  Trash2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
} from "lucide-react";

export type ExportFormat = "png" | "jpeg" | "webp" | "avif";

export function AppShell() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const stamp = useCloneStamp(canvasRef);

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
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [compareActive, setCompareActive] = useState(false);
  const [hasBeenModified, setHasBeenModified] = useState(false);
  const [recentTexts, setRecentTexts] = useState<TextMemory[]>([]);
  const textIdCounter = useRef(0);
  const [isImageLoading, setIsImageLoading] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const loadIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Item 2: Pan mode state
  const [isPanning, setIsPanning] = useState(false);

  const handleTextCommit = useCallback(
    (text: string) => {
      if (!text.trim()) return;
      const m: TextMemory = {
        id: textIdCounter.current++,
        text,
        fontSize: toolSettings.fontSize,
        fontWeight: toolSettings.fontWeight,
        textColor: toolSettings.textColor,
      };
      setRecentTexts((prev) =>
        [m, ...prev.filter((t) => t.text !== text)].slice(0, 8),
      );
    },
    [toolSettings.fontSize, toolSettings.fontWeight, toolSettings.textColor],
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
    (files: File[]) => {
      const entries: PhotoEntry[] = files.map((f) => ({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        url: URL.createObjectURL(f),
        name: f.name.replace(/\.[^.]+$/, ""),
        file: f,
      }));
      setPhotos((prev) => [...prev, ...entries]);
      const first = entries[0];
      if (first) {
        loadImageWithProgress(first.file);
        setActivePhotoId(first.id);
        setOriginalUrl(first.url);
        setHasBeenModified(false);
        setCompareActive(false);
      }
    },
    [loadImageWithProgress],
  );

  const handleSelectPhoto = useCallback(
    (entry: PhotoEntry) => {
      loadImageWithProgress(entry.file);
      setActivePhotoId(entry.id);
      setOriginalUrl(entry.url);
      setHasBeenModified(false);
      setCompareActive(false);
    },
    [loadImageWithProgress],
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
  const [showKbdHints, setShowKbdHints] = useState(true);
  const [showShortcutModal, setShowShortcutModal] = useState(false);

  const [activeTool, setActiveTool] = useState<ToolType>("compress");
  const [exportFormat, setExportFormat] = useState<ExportFormat>("jpeg");
  const [quality, setQuality] = useState(75);

  const effectiveBrushSize = (() => {
    switch (activeTool) {
      case "brush":
        return toolSettings.brushSize / 2;
      case "emoji":
        return (toolSettings.emojiSize * 1.2) / 2;
      case "effects":  // was "blur"
        return toolSettings.blurSize / 2;
      case "stamp":
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

  const handleExport = useCallback(() => {
    stamp.exportAs(exportFormat, quality / 100);
  }, [stamp, exportFormat, quality]);

  const handleDeleteAll = useCallback(() => {
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

  const drawingTools = useDrawingTools({
    toolRef: stamp.toolRef,
    canvasRef,
    activeTool,
    settings: toolSettings,
    flushToCanvas: flushAndSync,
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

  const redStampTool = useRedStampTool({
    toolRef: stamp.toolRef,
    canvasRef,
    flushToCanvas: flushAndSync,
    syncState: stamp.syncState,
    active: activeTool === "stamp",
    brushSize: stampSettings.brushSize,
  });

  const effectiveStamp = (() => {
    // Item 7: "effects" tool uses blur mouse handlers (same as old "blur")
    if (activeTool === "effects")
      return {
        ...stamp,
        onMouseDown: blurDown,
        onMouseMove: blurMove,
        onMouseUp: blurUp,
      };
    if (["arrow", "shapes", "crop"].includes(activeTool))
      return {
        ...stamp,
        onMouseDown: drawingTools.onMouseDown as typeof stamp.onMouseDown,
        onMouseMove: drawingTools.onMouseMove as typeof stamp.onMouseMove,
        onMouseUp: drawingTools.onMouseUp as typeof stamp.onMouseUp,
      };
    if (activeTool === "emoji")
      return {
        ...stamp,
        onMouseDown: emojiTool.onMouseDown as typeof stamp.onMouseDown,
        onMouseMove: emojiTool.onMouseMove as typeof stamp.onMouseMove,
        onMouseUp: emojiTool.onMouseUp as typeof stamp.onMouseUp,
      };
    if (activeTool === "brush")
      return {
        ...stamp,
        onMouseDown: paintTool.onMouseDown as typeof stamp.onMouseDown,
        onMouseMove: paintTool.onMouseMove as typeof stamp.onMouseMove,
        onMouseUp: paintTool.onMouseUp as typeof stamp.onMouseUp,
      };
    if (activeTool === "stamp") {
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

  useKeyboardShortcuts({
    onUndo: stamp.undo,
    onRedo: stamp.redo,
    onExport: handleExport,
    onDeleteAll: handleDeleteAll,
    onBrushSizeChange: setStampSettings,
    setBrushSizeOnTool: stamp.setBrushSize,
    setShowUpload,
    setShowTools,
    setShowGallery,
    setShowHistory,
    setShowKbdHints,
    setShowShortcutModal,
    onZoomIn: handleZoomIn,
    onZoomOut: handleZoomOut,
    onZoomReset: handleZoomReset,
    onToolChange: setActiveTool,
    onFlipH: stamp.flipHorizontal,
    onFlipV: stamp.flipVertical,
    onRotateCw: stamp.rotate90Cw,
    onCopyToClipboard: handleCopyToClipboard,
    // Item 4: Gallery cycling
    onNextPhoto: handleNextPhoto,
    onPrevPhoto: handlePrevPhoto,
    // Item 2: Spacebar pan
    onSpaceDown: () => setIsPanning(true),
    onSpaceUp: () => setIsPanning(false),
  });

  const handleToggleCompare = useCallback(() => {
    setCompareActive((v) => !v);
  }, []);

  const handleResize = useCallback(
    (w: number, h: number) => {
      stamp.resize(w, h);
      setHasBeenModified(true);
    },
    [stamp],
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
      />

      <ShortcutModal
        open={showShortcutModal}
        onClose={() => setShowShortcutModal(false)}
      />

      <AnimatePresence>
        {showTopBar && (
          <TopBar
            zoom={stamp.state.zoom}
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
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
            onToolChange={setActiveTool}
            stampSettings={stampSettings}
            onStampSettingsChange={handleStampSettingsChange}
            hasSource={stamp.state.hasSource}
            onUndo={stamp.undo}
            onRedo={stamp.redo}
            canUndo={canUndo}
            canRedo={canRedo}
            onExport={handleExport}
            canExport={hasImage}
            exportFormat={exportFormat}
            onExportFormatChange={setExportFormat}
            onFlipH={stamp.flipHorizontal}
            onFlipV={stamp.flipVertical}
            onRotate90Cw={stamp.rotate90Cw}
            onBrightness={stamp.adjustBrightness}
            onContrast={stamp.adjustContrast}
            imageReady={hasImage}
            onResize={handleResize}
            imageWidth={stamp.state.width}
            imageHeight={stamp.state.height}
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
          />
        )}
      </AnimatePresence>

      <ContextMenu>
        <ContextMenuTrigger asChild>
          <motion.main
            animate={{
              marginLeft: showTools ? 320 : 0,
              marginRight: showHistory ? 244 : 0,
            }}
            transition={panelSpacingTransition}
            className="main-content"
            style={{ position: "relative" }}
          >
            {photos.length > 0 ? (
              <CanvasArea
                ref={canvasRef}
                hookResult={effectiveStamp}
                brushDiameter={diameter}
                cursorPos={pos}
                cursorVisible={visible}
                onCanvasEnter={onCanvasEnter}
                onCanvasLeave={onCanvasLeave}
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
                  fontWeight: toolSettings.fontWeight,
                  textColor: toolSettings.textColor,
                }}
                containerRef={containerRef}
                isPanning={isPanning}
                cropSelection={drawingTools.cropSelection}
                onCropChange={(sel) => drawingTools.setCropSelection(sel)}
              />
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

        <ContextMenuContent className="w-56">
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
            compressionSavings={compressProgress.savings}
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

      <StatusBar
        state={stamp.state}
        imageCount={photos.length}
        showKbdHints={showKbdHints}
        activeTool={activeTool}
      />

      {/* Brush cursor — hidden during pan mode */}
      {visible &&
        !isPanning &&
        (activeTool === "stamp" ||
          activeTool === "effects" ||
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
