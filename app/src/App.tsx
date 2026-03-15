import { useCallback, useEffect, useRef, useState } from "react";
import { useCloneStamp } from "./hooks/useCloneStamp";
import { useBrushPreview } from "./hooks/useBrushPreview";
import { Toolbar } from "./components/Toolbar";
import { TransformBar } from "./components/TransformBar";
import { HistoryPanel } from "./components/HistoryPanel";
import { CanvasArea } from "./components/CanvasArea";
import { StatusBar } from "./components/StatusBar";
import { PhotoStrip, type PhotoEntry } from "./components/PhotoStrip";

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stamp = useCloneStamp(canvasRef);
  const [brushSize, setBrushSizeLocal] = useState(20);
  const [hardness, setHardnessLocal] = useState(0.8);
  const [opacity, setOpacityLocal] = useState(1.0);
  const { pos, visible, diameter, onCanvasEnter, onCanvasLeave } =
    useBrushPreview(brushSize, stamp.state.zoom, canvasRef);

  // ── Multi-photo state ─────────────────────────────────────────────────────
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
      const firstNew = newEntries[0];
      if (firstNew) {
        stamp.loadImage(firstNew.file);
        setActivePhotoId(firstNew.id);
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

  // ── Brush controls ────────────────────────────────────────────────────────
  const handleBrushSize = useCallback(
    (v: number) => {
      const clamped = Math.max(2, Math.min(200, v));
      setBrushSizeLocal(clamped);
      stamp.setBrushSize(clamped);
    },
    [stamp],
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!e.altKey) return;
      if (e.code === "BracketLeft") {
        e.preventDefault();
        setBrushSizeLocal((prev) => {
          const next = Math.max(2, prev - 5);
          stamp.setBrushSize(next);
          return next;
        });
      } else if (e.code === "BracketRight") {
        e.preventDefault();
        setBrushSizeLocal((prev) => {
          const next = Math.min(200, prev + 5);
          stamp.setBrushSize(next);
          return next;
        });
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [stamp]);

  const handleHardness = (v: number) => {
    setHardnessLocal(v);
    stamp.setHardness(v);
  };
  const handleOpacity = (v: number) => {
    setOpacityLocal(v);
    stamp.setOpacity(v);
  };

  return (
    <div className="app-layout">
      <Toolbar
        state={stamp.state}
        brushSize={brushSize}
        hardness={hardness}
        opacity={opacity}
        onFileChange={stamp.loadImage}
        onPhotosAdd={handleAddPhotos}
        onBrushSizeChange={handleBrushSize}
        onHardnessChange={handleHardness}
        onOpacityChange={handleOpacity}
        onUndo={stamp.undo}
        onRedo={stamp.redo}
        onExport={stamp.exportPng}
      />

      {/* Thin bar: flip / rotate / brightness / contrast */}
      <TransformBar
        disabled={!stamp.state.ready}
        onFlipH={stamp.flipHorizontal}
        onFlipV={stamp.flipVertical}
        onRotate90Cw={stamp.rotate90Cw}
        onBrightness={stamp.adjustBrightness}
        onContrast={stamp.adjustContrast}
      />

      <div className="main-area">
        <CanvasArea
          ref={canvasRef}
          hookResult={stamp}
          brushDiameter={diameter}
          cursorPos={pos}
          cursorVisible={visible}
          onCanvasEnter={onCanvasEnter}
          onCanvasLeave={onCanvasLeave}
        />
        <HistoryPanel
          history={stamp.state.history}
          onJump={stamp.jumpToHistory}
          onDelete={stamp.deleteHistoryEntry}
          onClear={stamp.clearHistory}
        />
      </div>

      <PhotoStrip
        photos={photos}
        activeId={activePhotoId}
        onSelect={handleSelectPhoto}
        onRemove={handleRemovePhoto}
      />

      <StatusBar state={stamp.state} />
    </div>
  );
}
