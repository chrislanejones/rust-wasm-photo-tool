// The workspace: the canvas host in its two shapes — the Batch grid and the
// full-size canvas — moved out of AppShell's return (B3,
// docs/AppShell-Refactor-Plan.md), plus the brush cursor that floats over it.
//
// ADR-024 a11.1 — THE TERNARY KEEPS ITS SHAPE, and AppShell mounts this
// component unconditionally so it never remounts itself. <CanvasArea> is still
// rendered in both arms, so crossing the Batch boundary still unmounts one and
// mounts the other; the generation counter that survives that lives in
// AppShell (useCanvasIdentity) and reaches CanvasArea through the session
// context, exactly as before this split.
import type { ComponentProps, MouseEventHandler } from "react";
import { motion } from "framer-motion";
import { useSession } from "@/app/session/SessionContext";
import type { MagnifierState } from "@/hooks/useColorPicker";
import { useUIStore } from "@/stores/useUIStore";
import { useToolStore } from "@/stores/useToolStore";
import { useGalleryStore } from "@/stores/useGalleryStore";
import { springStandard, instantTransition } from "@/lib/animations";
import { PANEL_OPEN_GUTTER, GALLERY_OPEN_GUTTER } from "@/lib/layout";
import type { Breakpoint } from "@/lib/useBreakpoint";
import { MASTER_BAR_WIDTH } from "@/components/master-bar/constants";
import { MagnifierOverlay } from "@/components/MagnifierOverlay";
import { CanvasArea } from "@/features/canvas/CanvasArea";
import { GridThumbnails } from "@/features/canvas/GridThumbnails";
import type { PhotoEntry } from "@/features/gallery/GalleryBar";
import { ImagePlus } from "lucide-react";

type CanvasAreaProps = ComponentProps<typeof CanvasArea>;

export interface WorkspaceProps {
  bp: Breakpoint;
  reduceMotion: boolean;
  onContextMenu: MouseEventHandler<HTMLElement>;
  /** The effective tool's mouse handlers + engine (useEffectiveTool). */
  hookResult: CanvasAreaProps["hookResult"];
  /** useBrushPreview — the ring that follows the cursor. */
  brush: {
    diameter: number;
    pos: { x: number; y: number };
    visible: boolean;
    onCanvasEnter: (rect: DOMRect) => void;
  };
  onCanvasLeave: () => void;
  magnifier: MagnifierState;
  /** Session handlers both canvas arms take. */
  canvas: Pick<
    CanvasAreaProps,
    | "onTextFontSizeChange"
    | "renderOverlay"
    | "onPenCommit"
    | "onPenHitTest"
    | "onPenEditStart"
    | "onPenEditCommit"
    | "onPenEditCancel"
  >;
  /** Session handlers only the full-size canvas takes (selection, guides). */
  wide: Pick<
    CanvasAreaProps,
    | "onSelectionClick"
    | "onMarqueeCommit"
    | "onLassoMove"
    | "onLassoClose"
    | "lassoCommitted"
    | "lassoPreview"
    | "guides"
  >;
  onSelectPhoto: (entry: PhotoEntry) => void;
}

export function Workspace({
  bp,
  reduceMotion,
  onContextMenu,
  hookResult,
  brush,
  onCanvasLeave,
  magnifier,
  canvas,
  wide,
  onSelectPhoto,
}: WorkspaceProps) {
  const { canvasRef } = useSession();
  const showTopBar = useUIStore((s) => s.showTopBar);
  const showTools = useUIStore((s) => s.showTools);
  const showGallery = useUIStore((s) => s.showGallery);
  const showHistory = useUIStore((s) => s.showHistory);
  const isPanning = useUIStore((s) => s.isPanning);
  const activeTool = useToolStore((s) => s.activeTool);
  const colorPickerActive = useToolStore((s) => s.colorPickerActive);
  const eraserMode = useToolStore((s) => s.eraserMode);
  const photos = useGalleryStore((s) => s.photos);
  const activePhotoId = useGalleryStore((s) => s.activePhotoId);

  return (
    <>
      <motion.main
        id="main-canvas"
        aria-label="Image canvas"
        tabIndex={-1}
        onContextMenu={onContextMenu}
        animate={{
          // Compact mode: clear the master bar (left). Wide: two-sided push.
          marginLeft: bp.dock
            ? MASTER_BAR_WIDTH + 16
            : !bp.narrow && showTools
              ? PANEL_OPEN_GUTTER
              : 0,
          marginRight:
            !bp.dock && !bp.narrow && showHistory ? PANEL_OPEN_GUTTER : 0,
          // Third side: the Gallery strip pushes the workspace UP the same way
          // Tools and Review push it in. Wide only — in the dock the gallery
          // is a column on the left, so a bottom gutter would be a gap
          // under nothing. (Chris, 2026-09-08.)
          marginBottom:
            !bp.dock && !bp.narrow && showGallery ? GALLERY_OPEN_GUTTER : 0,
        }}
        transition={reduceMotion ? instantTransition : springStandard}
        className="main-content focus:outline-none"
        style={{ position: "relative" }}
      >
        <>
          {/* Emoji-grid mode: wrap the grid host in a flex pane sized to
              fit between the fixed TopBar and GalleryBar. The grid sits
              inside, capped at a 5:3 aspect ratio with gap + padding for
              breathing room. Non-emoji mode falls through to the regular
              full-size canvas host.

              ⚠️ This used to claim CanvasArea "is rendered ONCE (a stable
              React subtree) so the canvas DOM + WASM pixels survive tool
              switches". It is rendered TWICE — once in each arm of this
              ternary — so crossing the Batch boundary unmounts one and
              mounts the other, and the <canvas> element is genuinely
              re-created. Corrected 2026-08-09 after measuring element
              identity across tool switches in the browser.

              The pixels do survive, because WASM owns them and a fresh
              CanvasArea re-blits on mount. What does not survive is the
              ELEMENT — which is why ADR-024 a11 exists: after
              transferControlToOffscreen() the worker would go on drawing
              into the discarded one. See lib/engine/canvasIdentity.ts. */}
          {activeTool === "emoji" ? (
            <div
              style={{
                position: "absolute",
                top: showTopBar ? 80 : 12,
                // Same constant main-content lifts by, so the two cannot drift.
                bottom: 56 + (showGallery ? GALLERY_OPEN_GUTTER : 0),
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
                className="canvas-grid-host checkerboard-canvas"
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
                      hookResult={hookResult}
                      brushDiameter={brush.diameter}
                      cursorPos={brush.pos}
                      cursorVisible={brush.visible}
                      onCanvasEnter={brush.onCanvasEnter}
                      onCanvasLeave={onCanvasLeave}
                      {...canvas}
                    />
                  </div>
                  {(!activePhotoId || photos.length === 0) && (
                    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-background/95 text-center text-theme-muted-foreground">
                      <ImagePlus className="h-10 w-10 opacity-60" />
                      <p className="text-sm font-semibold">No photos loaded</p>
                      <p className="text-xs">Upload images to start batch editing</p>
                    </div>
                  )}
                  {activePhotoId && photos.length > 0 && (
                    <div className="absolute top-2 left-2 z-20 rounded-full bg-orange-500 px-2.5 py-0.5 text-2xs font-semibold uppercase tracking-wider text-white shadow-md">
                      Selected
                    </div>
                  )}
                </div>
                <GridThumbnails
                  photos={photos}
                  activePhotoId={activePhotoId}
                  onSelectPhoto={onSelectPhoto}
                />
              </div>
            </div>
          ) : (
            <div className="canvas-fullsize-host">
              <div className="canvas-fullsize-slot">
                <CanvasArea
                  ref={canvasRef}
                  hookResult={hookResult}
                  brushDiameter={brush.diameter}
                  cursorPos={brush.pos}
                  cursorVisible={brush.visible}
                  onCanvasEnter={brush.onCanvasEnter}
                  onCanvasLeave={onCanvasLeave}
                  {...wide}
                  {...canvas}
                />
              </div>
            </div>
          )}
          <MagnifierOverlay magnifier={magnifier} />
        </>
      </motion.main>

      {/* Brush cursor — hidden during pan mode. The Eraser tool ("ai") shows
          it only in its two canvas-brush modes (brush + Magic Eraser); the
          rembg/inpaint modes are click-actions and keep the arrow. */}
      {brush.visible &&
        !isPanning &&
        !colorPickerActive &&
        (activeTool === "stamp" ||
          activeTool === "brush" ||
          activeTool === "emoji" ||
          (activeTool === "ai" &&
            (eraserMode === "brush" || eraserMode === "magic"))) && (
          <div
            className="brush-cursor"
            style={{
              left: brush.pos.x,
              top: brush.pos.y,
              width: brush.diameter,
              height: brush.diameter,
            }}
          />
        )}
    </>
  );
}
