// The canvas right-click menu — moved out of AppShell's return verbatim
// (B3, docs/AppShell-Refactor-Plan.md). Renders the <ContextMenuContent>;
// AppShell keeps the <ContextMenu> wrapper because its trigger is the
// workspace itself.
import { useEngine, useEngineState } from "@/app/session/SessionContext";
import type { useShapeZOrderMenu } from "@/hooks/useShapeZOrderMenu";
import { useUIStore } from "@/stores/useUIStore";
import { useToolStore } from "@/stores/useToolStore";
import { useGalleryStore } from "@/stores/useGalleryStore";
import { ShapeZOrderMenuItems } from "@/features/canvas/ShapeZOrderMenuItems";
import {
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
  Copy,
  Command as CommandIcon,
  Trash2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Archive,
  Pipette,
} from "lucide-react";

export interface CanvasContextMenuProps {
  shapeZMenu: ReturnType<typeof useShapeZOrderMenu>;
  onCopyRegion: () => void;
  hasActiveRegion: boolean;
  onCopyToClipboard: () => Promise<void> | void;
  onExport: () => void;
  onExportAll: () => void;
  /** Open Edit & Transform with the eyedropper armed. */
  onActivateEyedropper: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
}

export function CanvasContextMenu({
  shapeZMenu,
  onCopyRegion: handleCopyRegion,
  hasActiveRegion,
  onCopyToClipboard: handleCopyToClipboard,
  onExport: handleExport,
  onExportAll: handleExportAll,
  onActivateEyedropper: handleActivateEyedropper,
  onZoomIn: handleZoomIn,
  onZoomOut: handleZoomOut,
}: CanvasContextMenuProps) {
  const engine = useEngine();
  const { ready, undoCount, redoCount } = useEngineState();
  const canUndo = undoCount > 0;
  const canRedo = redoCount > 0;
  const setShowCommandPalette = useUIStore((s) => s.setShowCommandPalette);
  const setDeletePhotoId = useUIStore((s) => s.setDeletePhotoId);
  const exportFormat = useToolStore((s) => s.exportFormat);
  const photos = useGalleryStore((s) => s.photos);
  const activePhotoId = useGalleryStore((s) => s.activePhotoId);

  return (
    <ContextMenuContent className="w-72">
      {/* Top of the menu: the "do anything" entry point — every tool,
          sub-mode, setting and action is reachable from here, so it
          outranks the specific items below it. */}
      <ContextMenuItem onClick={() => setShowCommandPalette(true)}>
        <CommandIcon className="h-4 w-4 mr-2" /> Command Palette
        <ContextMenuShortcut>Alt+,</ContextMenuShortcut>
      </ContextMenuItem>
      {/* Shape stacking. Renders only when the right-click landed on a
          shape on the active layer, so it sits above the general actions
          the way object actions do in other editors -- and is simply
          absent on empty canvas. */}
      <ShapeZOrderMenuItems menu={shapeZMenu} />
      <ContextMenuSeparator />
      <ContextMenuItem onClick={engine.undo} disabled={!canUndo}>
        <Undo className="h-4 w-4 mr-2" /> Undo
        <ContextMenuShortcut>Ctrl+Z</ContextMenuShortcut>
      </ContextMenuItem>
      <ContextMenuItem onClick={engine.redo} disabled={!canRedo}>
        <Redo className="h-4 w-4 mr-2" /> Redo
        <ContextMenuShortcut>Ctrl+Shift+Z</ContextMenuShortcut>
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem
        onClick={handleCopyRegion}
        disabled={!ready || !hasActiveRegion}
      >
        <Copy className="h-4 w-4 mr-2" /> Copy Selection
        <ContextMenuShortcut>Ctrl+C</ContextMenuShortcut>
      </ContextMenuItem>
      <ContextMenuItem onClick={handleCopyToClipboard} disabled={!ready}>
        <Clipboard className="h-4 w-4 mr-2" /> Copy to Clipboard
        <ContextMenuShortcut>Ctrl+Shift+C</ContextMenuShortcut>
      </ContextMenuItem>
      <ContextMenuItem onClick={handleExport} disabled={!ready}>
        <Download className="h-4 w-4 mr-2" /> Export{" "}
        {exportFormat.toUpperCase()}
        <ContextMenuShortcut>Alt+E</ContextMenuShortcut>
      </ContextMenuItem>
      {photos.length > 1 && (
        <ContextMenuItem onClick={handleExportAll}>
          <Archive className="h-4 w-4 mr-2" /> Export All (ZIP)
        </ContextMenuItem>
      )}
      <ContextMenuSeparator />
      <ContextMenuItem
        onClick={handleActivateEyedropper}
        disabled={!ready}
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
      <ContextMenuItem onClick={engine.flipHorizontal} disabled={!ready}>
        <RotateCcw className="h-4 w-4 mr-2" /> Flip Horizontal
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem
        onClick={() => activePhotoId && setDeletePhotoId(activePhotoId)}
        disabled={!activePhotoId}
        className="text-destructive focus:text-destructive"
      >
        <Trash2 className="h-4 w-4 mr-2" /> Delete image
      </ContextMenuItem>
    </ContextMenuContent>
  );
}
