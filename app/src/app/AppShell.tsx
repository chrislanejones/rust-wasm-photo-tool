// ===== FILE: app/src/app/AppShell.tsx =====
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useCloneStamp } from "@/hooks/useCloneStamp";
import { useBrushPreview } from "@/hooks/useBrushPreview";
import { useDrawingTools } from "@/hooks/useDrawingTools";
import { useEmojiTool } from "@/hooks/useEmojiTool";
import { usePaintTool } from "@/hooks/usePaintTool";
import type { ToolType, StampSettings, ToolSettings } from "@/lib/types";
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
  const stamp = useCloneStamp(canvasRef);

  // NOTE: stamp.syncState and stamp.flushToCanvas must be exported
  // from useCloneStamp (see USE_CLONE_STAMP_PATCH.txt)

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
        stamp.loadImage(first.file);
        setActivePhotoId(first.id);
        setOriginalUrl(first.url);
        setHasBeenModified(false);
        setCompareActive(false);
      }
    },
    [stamp],
  );

  const handleSelectPhoto = useCallback(
    (entry: PhotoEntry) => {
      stamp.loadImage(entry.file);
      setActivePhotoId(entry.id);
      setOriginalUrl(entry.url);
      setHasBeenModified(false);
      setCompareActive(false);
    },
    [stamp],
  );

  const handleRemovePhoto = useCallback(
    (id: string) => {
      setPhotos((prev) => {
        const idx = prev.findIndex((p) => p.id === id);
        const next = prev.filter((p) => p.id !== id);
        const removed = prev[idx];
        if (removed) URL.revokeObjectURL(removed.url);
        if (id === activePhotoId && next.length > 0) {
          const na = next[Math.min(idx, next.length - 1)]!;
          stamp.loadImage(na.file);
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
    [activePhotoId, stamp],
  );

  const { pos, visible, diameter, onCanvasEnter, onCanvasLeave } =
    useBrushPreview(stampSettings.brushSize, stamp.state.zoom, canvasRef);

  const [showUpload, setShowUpload] = useState(true);
  const [showTopBar, setShowTopBar] = useState(false);
  const [showTools, setShowTools] = useState(true);
  const [showGallery, setShowGallery] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showKbdHints, setShowKbdHints] = useState(false);
  const [showShortcutModal, setShowShortcutModal] = useState(false);

  const [activeTool, setActiveTool] = useState<ToolType>("compress");
  const [exportFormat, setExportFormat] = useState<ExportFormat>("jpeg");
  const [quality, setQuality] = useState(75);
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
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(t3);
      };
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
    photos.forEach((p) => URL.revokeObjectURL(p.url));
    setPhotos([]);
    setActivePhotoId(null);
    setOriginalUrl(null);
    setHasBeenModified(false);
    setCompareActive(false);
  }, [photos]);

  /* ── Flush + Sync helpers ── */
  const flushAndSync = useCallback(() => {
    stamp.flushToCanvas();
    stamp.syncState();
  }, [stamp]);

  /* ── Blur tool ── */
  const isBlurringRef = useRef(false);
  const getCoords = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) * canvas.width) / rect.width,
      y: ((e.clientY - rect.top) * canvas.height) / rect.height,
    };
  }, []);

  const blurOnMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const tool = stamp.toolRef.current;
      if (!tool || e.button !== 0) return;
      isBlurringRef.current = true;
      tool.begin_blur_stroke();
      const { x, y } = getCoords(e);
      tool.blur_region(
        x,
        y,
        toolSettings.blurSize / 2,
        toolSettings.blurIntensity,
      );
      stamp.flushToCanvas();
    },
    [stamp, getCoords, toolSettings.blurSize, toolSettings.blurIntensity],
  );

  const blurOnMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!isBlurringRef.current) return;
      const tool = stamp.toolRef.current;
      if (!tool) return;
      const { x, y } = getCoords(e);
      tool.blur_region(
        x,
        y,
        toolSettings.blurSize / 2,
        toolSettings.blurIntensity,
      );
      stamp.flushToCanvas();
    },
    [stamp, getCoords, toolSettings.blurSize, toolSettings.blurIntensity],
  );

  const blurOnMouseUp = useCallback(() => {
    if (!isBlurringRef.current) return;
    isBlurringRef.current = false;
    stamp.syncState(); // ← updates history panel
  }, [stamp]);

  /* ── Arrow / Shapes / Crop — syncState called inside useDrawingTools via flushToCanvas wrapper ── */
  const drawingTools = useDrawingTools({
    toolRef: stamp.toolRef,
    canvasRef,
    activeTool,
    settings: toolSettings,
    flushToCanvas: flushAndSync, // ← flush + sync so history updates
  });

  /* ── Emoji tool ── */
  const emojiTool = useEmojiTool({
    toolRef: stamp.toolRef,
    canvasRef,
    flushToCanvas: flushAndSync, // ← flush + sync
    emoji: toolSettings.emoji,
    emojiSize: toolSettings.emojiSize,
  });

  /* ── Paint tool ── */
  const paintTool = usePaintTool({
    toolRef: stamp.toolRef,
    canvasRef,
    settings: toolSettings,
    flushToCanvas: stamp.flushToCanvas,
    syncState: stamp.syncState,
  });

  /* ── Route mouse events ── */
  const effectiveStamp = (() => {
    if (activeTool === "blur")
      return {
        ...stamp,
        onMouseDown: blurOnMouseDown,
        onMouseMove: blurOnMouseMove,
        onMouseUp: blurOnMouseUp,
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
    return stamp;
  })();

  /* ── Keyboard shortcuts ── */
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
  });

  const handleZoomIn = useCallback(() => {
    stamp.toolRef.current?.adjust_zoom(1);
  }, [stamp]);
  const handleZoomOut = useCallback(() => {
    stamp.toolRef.current?.adjust_zoom(-1);
  }, [stamp]);
  const handleToggleCompare = useCallback(() => {
    setCompareActive((v) => !v);
  }, []);
  const handleResize = useCallback(
    (newW: number, newH: number) => {
      stamp.resize(newW, newH);
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
      (id, newFile, newUrl) => {
        setPhotos((prev) =>
          prev.map((p) => {
            if (p.id !== id) return p;
            URL.revokeObjectURL(p.url);
            return { ...p, file: newFile, url: newUrl };
          }),
        );
      },
    );
    setHasBeenModified(true);
  }, [photos, quality, exportFormat, compressAll]);

  const handleCopyToClipboard = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      const blob = await new Promise<Blob | null>((res) =>
        canvas.toBlob((b) => res(b), "image/png"),
      );
      if (blob)
        await navigator.clipboard.write([
          new ClipboardItem({ [blob.type]: blob }),
        ]);
    } catch (err) {
      console.error("Copy failed:", err);
    }
  }, []);

  const hasImage = stamp.state.ready;
  const canUndo = stamp.state.undoCount > 0;
  const canRedo = stamp.state.redoCount > 0;

  return (
    <div className="app-shell">
      <UploadDialog
        open={showUpload}
        onClose={() => setShowUpload(false)}
        onFiles={handleAddPhotos}
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
            showKbdHints={showKbdHints}
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
          >
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
            />
          </motion.main>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-56">
          <ContextMenuItem onClick={handleCopyToClipboard} disabled={!hasImage}>
            <Clipboard className="mr-2 h-4 w-4" /> Copy to Clipboard{" "}
            <ContextMenuShortcut>Ctrl+C</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem disabled={!canUndo} onSelect={stamp.undo}>
            <Undo className="mr-2 h-4 w-4" /> Undo{" "}
            <ContextMenuShortcut>Ctrl+Z</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem disabled={!canRedo} onSelect={stamp.redo}>
            <Redo className="mr-2 h-4 w-4" /> Redo{" "}
            <ContextMenuShortcut>Ctrl+Shift+Z</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            onSelect={handleZoomOut}
            disabled={stamp.state.zoom <= 0.25}
          >
            <ZoomOut className="mr-2 h-4 w-4" /> Zoom Out
          </ContextMenuItem>
          <ContextMenuItem
            onSelect={handleZoomIn}
            disabled={stamp.state.zoom >= 4}
          >
            <ZoomIn className="mr-2 h-4 w-4" /> Zoom In
          </ContextMenuItem>
          <ContextMenuItem onSelect={() => stamp.toolRef.current?.set_zoom(1)}>
            <RotateCcw className="mr-2 h-4 w-4" /> Reset Zoom
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onSelect={handleExport} disabled={!hasImage}>
            <Download className="mr-2 h-4 w-4" /> Export{" "}
            {exportFormat.toUpperCase()}{" "}
            <ContextMenuShortcut>Alt+E</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            onSelect={handleDeleteAll}
            disabled={photos.length === 0}
            className="text-red-400 focus:text-red-400"
          >
            <Trash2 className="mr-2 h-4 w-4" /> Delete All{" "}
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
            compressionProgress={compressProgress.items}
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

      <ShortcutModal
        open={showShortcutModal}
        onClose={() => setShowShortcutModal(false)}
      />
      <StatusBar
        state={stamp.state}
        imageCount={photos.length}
        showKbdHints={showKbdHints}
      />
    </div>
  );
}
