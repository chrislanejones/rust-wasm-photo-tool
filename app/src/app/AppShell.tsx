import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

import { useCloneStamp } from "@/hooks/useCloneStamp";
import { useBrushPreview } from "@/hooks/useBrushPreview";
import type { ToolType, StampSettings } from "@/lib/types";
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

export type ExportFormat = "png" | "jpeg" | "webp" | "avif";

export function AppShell() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stamp = useCloneStamp(canvasRef);

  // ── Stamp settings (local + synced to WASM) ─────────────────────────────
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

  // ── Multi-photo state ───────────────────────────────────────────────────
  const [photos, setPhotos] = useState<PhotoEntry[]>([]);
  const [activePhotoId, setActivePhotoId] = useState<string | null>(null);

  const handleAddPhotos = useCallback(
    (files: File[]) => {
      const newEntries: PhotoEntry[] = files.map((file) => ({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        url: URL.createObjectURL(file),
        name: file.name.replace(/\.[^.]+$/, ""),
        file,
      }));
      setPhotos((prev) => [...prev, ...newEntries]);
      const first = newEntries[0];
      if (first) {
        stamp.loadImage(first.file);
        setActivePhotoId(first.id);
      }
    },
    [stamp],
  );

  const handleSelectPhoto = useCallback(
    (entry: PhotoEntry) => {
      stamp.loadImage(entry.file);
      setActivePhotoId(entry.id);
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
          const newActive = next[Math.min(idx, next.length - 1)];
          stamp.loadImage(newActive.file);
          setActivePhotoId(newActive.id);
        } else if (next.length === 0) {
          setActivePhotoId(null);
        }
        return next;
      });
    },
    [activePhotoId, stamp],
  );

  // ── Brush preview ───────────────────────────────────────────────────────
  const { pos, visible, diameter, onCanvasEnter, onCanvasLeave } =
    useBrushPreview(stampSettings.brushSize, stamp.state.zoom, canvasRef);

  // ── Panel visibility ────────────────────────────────────────────────────
  const [showUpload, setShowUpload] = useState(true);
  const [showTopBar, setShowTopBar] = useState(false);
  const [showTools, setShowTools] = useState(false);
  const [showGallery, setShowGallery] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showKbdHints, setShowKbdHints] = useState(false);
  const [activeTool, setActiveTool] = useState<ToolType>("stamp");
  const [exportFormat, setExportFormat] = useState<ExportFormat>("png");
  const [quality, setQuality] = useState(75);

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

  // ── Export (format-aware) ────────────────────────────────────────────────
  const handleExport = useCallback(() => {
    stamp.exportAs(exportFormat);
  }, [stamp, exportFormat]);

  // ── Delete all photos ──────────────────────────────────────────────────
  const handleDeleteAll = useCallback(() => {
    photos.forEach((p) => URL.revokeObjectURL(p.url));
    setPhotos([]);
    setActivePhotoId(null);
  }, [photos]);

  // ── Keyboard shortcuts (centralized) ─────────────────────────────────────
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
  });

  // ── Zoom helpers for TopBar ─────────────────────────────────────────────
  const handleZoomIn = useCallback(() => {
    stamp.toolRef.current?.adjust_zoom(1);
    // Force state sync — the hook's syncState doesn't get called from here
    // so we poke the WASM and rely on the next render
  }, [stamp]);

  const handleZoomOut = useCallback(() => {
    stamp.toolRef.current?.adjust_zoom(-1);
  }, [stamp]);

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="app-shell">
      {/* Upload Dialog */}
      <UploadDialog
        open={showUpload}
        onClose={() => setShowUpload(false)}
        onFiles={handleAddPhotos}
      />

      {/* Top Bar */}
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
            hasSelectedImage={stamp.state.ready}
            onDeleteAll={handleDeleteAll}
          />
        )}
      </AnimatePresence>

      {/* Tools Sidebar */}
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
            canUndo={stamp.state.undoCount > 0}
            canRedo={stamp.state.redoCount > 0}
            onExport={handleExport}
            canExport={stamp.state.ready}
            imageReady={stamp.state.ready}
            onFlipH={stamp.flipHorizontal}
            onFlipV={stamp.flipVertical}
            onRotate90Cw={stamp.rotate90Cw}
            onBrightness={stamp.adjustBrightness}
            onContrast={stamp.adjustContrast}
            onResize={stamp.resize}
            imageWidth={stamp.state.width}
            imageHeight={stamp.state.height}
            quality={quality}
            onQualityChange={setQuality}
            exportFormat={exportFormat}
          />
        )}
      </AnimatePresence>

      {/* Main canvas area */}
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
          hookResult={stamp}
          brushDiameter={diameter}
          cursorPos={pos}
          cursorVisible={visible}
          onCanvasEnter={onCanvasEnter}
          onCanvasLeave={onCanvasLeave}
        />
      </motion.main>

      {/* History Panel */}
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

      {/* Gallery Bar */}
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
          />
        )}
      </AnimatePresence>

      {/* Status Bar */}
      <StatusBar
        state={stamp.state}
        imageCount={photos.length}
        showKbdHints={showKbdHints}
      />

      {/* Shortcut Reference Modal */}
      <ShortcutModal
        open={showKbdHints}
        onClose={() => setShowKbdHints(false)}
      />
    </div>
  );
}
