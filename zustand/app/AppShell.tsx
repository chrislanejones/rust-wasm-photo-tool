import { useRef, useCallback, useEffect } from 'react';
import { useToolStore } from '@stores/useToolStore';
import { useUIStore } from '@stores/useUIStore';
import { useGalleryStore } from '@stores/useGalleryStore';
import { useEffectiveTool } from '@hooks/useEffectiveTool';
import { useCloneStamp } from '@hooks/useCloneStamp';
import { usePhotoLoader } from '@hooks/usePhotoLoader';
import { useImageActions } from '@hooks/useImageActions';
import { ToolsSidebar } from '@features/tools/ToolsSidebar';
import { CanvasArea } from '@features/canvas/CanvasArea';
import { GalleryBar } from '@features/gallery/GalleryBar';

export function AppShell() {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const stamp = useCloneStamp(canvasRef);

  const { loadPhoto } = usePhotoLoader(stamp);
  const { deleteCurrentPhoto } = useImageActions();

  const {
    activeTool,
    brushMode,
    stampSubMode,
    setActiveTool,
    setBrushMode,
  } = useToolStore();

  const { showTools, showGallery, showHistory } = useUIStore();
  const { photos, activePhotoId, setActivePhoto } = useGalleryStore();

  const flushAndSync = useCallback(() => {
    stamp.flushToCanvas();
    stamp.syncState();
  }, [stamp]);

  const effectiveStamp = useEffectiveTool({
    canvasRef,
    containerRef,
    stamp,
    toolSettings: {},
    activeTool,
    colorPickerActive: false,
    moveActive: false,
    cropEraserActive: false,
    maskEditing: false,
    brushMode,
    stampSubMode,
    shapesMode: 'shapes',
    effectsMode: 'levels',
    maskPaintValue: 0,
    flushAndSync,
  });

  useEffect(() => {
    if (activePhotoId) {
      const photo = photos.find(p => p.id === activePhotoId);
      if (photo) void loadPhoto(photo);
    }
  }, [activePhotoId]);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <small className="flex-1 overflow-hidden">
        <small className="flex-1 overflow-hidden">
          <CanvasArea ref={canvasRef} hookResult={effectiveStamp} />
        </small>
      </small>

      {showTools && <ToolsSidebar activeTool={activeTool} onToolChange={setActiveTool} brushMode={brushMode} onBrushModeChange={setBrushMode} />}

      {showGallery && <GalleryBar photos={photos} activeId={activePhotoId} onSelect={setActivePhoto} />}
    </div>
  );
}
