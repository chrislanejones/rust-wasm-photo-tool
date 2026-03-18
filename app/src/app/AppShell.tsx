import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useCloneStamp } from "@/hooks/useCloneStamp";
import { useBrushPreview } from "@/hooks/useBrushPreview";
import { useDrawingTools } from "@/hooks/useDrawingTools";
import { useEmojiTool } from "@/hooks/useEmojiTool";
import { usePaintTool } from "@/hooks/usePaintTool";
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
  const stamp = useCloneStamp(canvasRef);

  // ── Stamp settings ──
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

  // ── Tool settings (shared across blur/arrow/shapes/paint/text/emoji) ──
  const [toolSettings, setToolSettings] =
    useState<ToolSettings>(defaultToolSettings);

  // ── Photos ──
  const [photos, setPhotos] = useState<PhotoEntry[]>([]);
  const [activePhotoId, setActivePhotoId] = useState<string | null>(null);
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [compareActive, setCompareActive] = useState(false);
  const [hasBeenModified, setHasBeenModified] = useState(false);

  // ── Text memory ──
  const [recentTexts, setRecentTexts] = useState<TextMemory[]>([]);
  const textIdCounter = useRef(0);

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
        [m, ...prev.filter((t) => t.text !== text)].slice(0, 3),
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

  const handleSelectRecentText = useCallback((m: TextMemory) => {
    setToolSettings((prev) => ({
      ...prev,
      fontSize: m.fontSize,
      fontWeight: m.fontWeight,
      textColor: m.textColor,
    }));
    window.dispatchEvent(
      new CustomEvent("prefill-text", { detail: { text: m.text } }),
    );
  }, []);

  // ── Photo management ──
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

  // ── Brush preview ──
  const { pos, visible, diameter, onCanvasEnter, onCanvasLeave } =
    useBrushPreview(stampSettings.brushSize, stamp.state.zoom, canvasRef);

  // ── Panel state ──
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

  // ── Panel sequencing ──
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

  // ── Flush + Sync (requires useCloneStamp to export these — see patch) ──
  const flushAndSync = useCallback(() => {
    stamp.flushToCanvas();
    stamp.syncState();
  }, [stamp]);

  // ── Blur ──
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
      t.blur_region(
        x,
        y,
        toolSettings.blurSize / 2,
        toolSettings.blurIntensity,
      );
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
      t.blur_region(
        x,
        y,
        toolSettings.blurSize / 2,
        toolSettings.blurIntensity,
      );
      stamp.flushToCanvas();
    },
    [stamp, getCoords, toolSettings.blurSize, toolSettings.blurIntensity],
  );

  const blurUp = useCallback(() => {
    if (!isBlurringRef.current) return;
    isBlurringRef.current = false;
    stamp.syncState();
  }, [stamp]);

  // ── Arrow / Shapes / Crop ──
  const drawingTools = useDrawingTools({
    toolRef: stamp.toolRef,
    canvasRef,
    activeTool,
    settings: toolSettings,
    flushToCanvas: flushAndSync,
  });

  // ── Emoji ──
  const emojiTool = useEmojiTool({
    toolRef: stamp.toolRef,
    canvasRef,
    flushToCanvas: flushAndSync,
    emoji: toolSettings.emoji,
    emojiSize: toolSettings.emojiSize,
  });

  // ── Paint ──
  const paintTool = usePaintTool({
    toolRef: stamp.toolRef,
    canvasRef,
    settings: toolSettings,
    flushToCanvas: stamp.flushToCanvas,
    syncState: stamp.syncState,
  });

  // ══════════════════════════════════════════════════════════════
  // EFFECTIVE STAMP — routes mouse events based on active tool
  // This is the critical piece that makes all tools work.
  // ══════════════════════════════════════════════════════════════
  const effectiveStamp = (() => {
    if (activeTool === "blur")
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
    // text tool uses canvas click handler inside CanvasArea, stamp handles the rest
    return stamp;
  })();

  // ── Keyboard shortcuts ──
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

  // ── Zoom (works from TopBar buttons, context menu, Alt+scroll in useCloneStamp, Alt+-/+ in useKeyboardShortcuts) ──
  const handleZoomIn = useCallback(() => {
    stamp.toolRef.current?.adjust_zoom(1);
    stamp.syncState();
  }, [stamp]);
  const handleZoomOut = useCallback(() => {
    stamp.toolRef.current?.adjust_zoom(-1);
    stamp.syncState();
  }, [stamp]);
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
      (id, nf, nu) => {
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
            <ContextMenuShortcut>Ctrl+⇧+Z</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            onSelect={handleZoomOut}
            disabled={stamp.state.zoom <= 0.25}
          >
            <ZoomOut className="mr-2 h-4 w-4" /> Zoom Out{" "}
            <ContextMenuShortcut>Alt+−</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem
            onSelect={handleZoomIn}
            disabled={stamp.state.zoom >= 4}
          >
            <ZoomIn className="mr-2 h-4 w-4" /> Zoom In{" "}
            <ContextMenuShortcut>Alt+=</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem
            onSelect={() => {
              stamp.toolRef.current?.set_zoom(1);
              stamp.syncState();
            }}
          >
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
        activeTool={activeTool}
      />
    </div>
  );
}
