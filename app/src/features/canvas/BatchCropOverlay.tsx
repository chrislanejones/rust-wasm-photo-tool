// Batch › Crop — the crop frame on the preview. Drag inside it to move, drag a
// corner to resize (ratio locked; hold Shift to break it), or drag anywhere
// else on the photo to draw a new frame. Nothing is committed until the mouse
// is let go: THEN the frame is stored, the other photos' gallery thumbnails
// shade what Enter / "Crop All" will cut (BatchCropThumbShade), and the
// frame becomes the one every photo without its own framing follows.
//
// Mounted through CanvasArea's `renderOverlay` like DuplicatePadOverlay, and
// positioned the same way: a box the size of the canvas's fit-scaled CSS box,
// riding the same pan/zoom transform, so percentages land on image pixels.
// The frame is measured in PHOTO px (inside `photoBounds`), not document px,
// because the crop is of the photo, not the padded artboard around it.
import { useRef, useState } from "react";
import type { OverlayFrame } from "./overlayFrame";
import type { PhotoBounds } from "@/hooks/usePhotoBounds";
import {
  anchoredCropRect,
  framedCropRect,
  framingFromRect,
  moveCropRect,
  resizeCropRectFromCorner,
  freeCropRectFromCorner,
  cornerToward,
  ratioLabel,
  type CropCorner,
  type CropRect,
} from "@/lib/batchCrop";
import {
  useBatchCropStore,
  showsOriginalFraming,
  cropRatioOf,
  framingFor,
} from "@/stores/useBatchCropStore";
import { useGalleryStore } from "@/stores/useGalleryStore";
import { useToolStore } from "@/stores/useToolStore";
import { useUIStore } from "@/stores/useUIStore";

// On-photo colors are inline, not theme tokens: they sit on the user's
// picture, where only a black shade and a white line read on anything — the
// same pair the Edit › Crop overlay uses.
const SHADE = "rgba(0,0,0,0.55)";
const LINE = "rgba(255,255,255,0.9)";
const THIRDS = "rgba(255,255,255,0.38)";
/** Corner handle, in screen px (counter-scaled against zoom). */
const HANDLE_PX = 12;

const CORNERS: { id: CropCorner; ax: 0 | 1; ay: 0 | 1; cursor: string }[] = [
  { id: "nw", ax: 0, ay: 0, cursor: "nwse-resize" },
  { id: "ne", ax: 1, ay: 0, cursor: "nesw-resize" },
  { id: "sw", ax: 0, ay: 1, cursor: "nesw-resize" },
  { id: "se", ax: 1, ay: 1, cursor: "nwse-resize" },
];

interface Props extends OverlayFrame {
  photoBounds: PhotoBounds | null;
  /** The live undo count — tells us whether a batch crop is baked in. */
  undoCount: number;
}

export function BatchCropOverlay({
  width,
  height,
  cssWidth,
  cssHeight,
  panOffset,
  zoom,
  photoBounds,
  undoCount,
}: Props) {
  const boxRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    /** "draw" = a fresh frame dragged out from an empty spot on the photo. */
    kind: "move" | "draw" | CropCorner;
    startX: number;
    startY: number;
    start: CropRect;
  } | null>(null);
  /** The frame WHILE a drag is in flight. Local on purpose: the store (and so
   *  the thumbnails' shade) only hears about it on release. `free` = Shift was
   *  down, so the shape is the new custom ratio. */
  const [draft, setDraft] = useState<{ rect: CropRect; free: boolean } | null>(null);

  const on = useToolStore((s) => s.activeTool === "emoji" && s.batchMode === "crop");
  const photoId = useGalleryStore((s) => s.activePhotoId);
  // Space / H pan: step out of the way so the drag reaches the canvas.
  const hit = useUIStore((s) => s.isPanning) ? "none" : "auto";
  const originalKey = useGalleryStore(
    (s) => s.photos.find((p) => p.id === s.activePhotoId)?.originalKey,
  );
  // A Shift-drag's custom shape, else the ratio tile's.
  const rw = useBatchCropStore((s) => cropRatioOf(s)[0]);
  const rh = useBatchCropStore((s) => cropRatioOf(s)[1]);
  const anchor = useBatchCropStore((s) => s.anchor);
  const framing = useBatchCropStore((s) => (photoId ? framingFor(s, photoId) : undefined));
  const setFraming = useBatchCropStore((s) => s.setFraming);
  const clearFraming = useBatchCropStore((s) => s.clearFraming);
  const onOriginal = useBatchCropStore((s) =>
    photoId && originalKey ? showsOriginalFraming(s, photoId, originalKey, undoCount) : false,
  );

  if (!on || !photoId || !onOriginal || width <= 0 || height <= 0) return null;
  const b = photoBounds ?? { x: 0, y: 0, width, height };
  if (b.width < 2 || b.height < 2) return null;

  const stored = framing
    ? framedCropRect(b.width, b.height, rw, rh, framing)
    : anchoredCropRect(b.width, b.height, rw, rh, anchor);
  const rect = draft?.rect ?? stored;
  const label = ratioLabel(draft?.free ? [rect.width, rect.height] : [rw, rh]);
  /** Store a frame. A free (Shift) frame's own shape becomes the ratio. */
  const commit = (r: CropRect, free = false) => {
    const [cw, ch] = free ? [r.width, r.height] : [rw, rh];
    setFraming(
      photoId,
      framingFromRect(b.width, b.height, cw, ch, r),
      free ? [r.width, r.height] : undefined,
    );
  };

  /** Screen px → document px, from the box's live on-screen size. */
  const docPerScreen = () => {
    const box = boxRef.current?.getBoundingClientRect();
    return box && box.width > 0 ? width / box.width : 1;
  };

  /** Take focus off whatever was clicked last (a ratio tile, say): the app's
   *  Enter shortcut stands aside for a focused button, so without this, Enter
   *  after a drag would re-press the tile instead of cropping. */
  const grabFocus = () => frameRef.current?.focus({ preventScroll: true });

  const startDrag = (e: React.PointerEvent<HTMLElement>, kind: "move" | CropCorner) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    grabFocus();
    dragRef.current = { kind, startX: e.clientX, startY: e.clientY, start: rect };
  };
  /** Pointer down on the photo OUTSIDE the frame: start a new one there. */
  const startDraw = (e: React.PointerEvent<HTMLElement>) => {
    if (e.button !== 0) return;
    const box = boxRef.current?.getBoundingClientRect();
    if (!box || box.width <= 0) return;
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    grabFocus();
    const k = width / box.width;
    const x = Math.max(0, Math.min(b.width, (e.clientX - box.left) * k - b.x));
    const y = Math.max(0, Math.min(b.height, (e.clientY - box.top) * k - b.y));
    dragRef.current = {
      kind: "draw",
      startX: e.clientX,
      startY: e.clientY,
      start: { x, y, width: 0, height: 0 },
    };
  };
  const onPointerMove = (e: React.PointerEvent<HTMLElement>) => {
    const d = dragRef.current;
    if (!d) return;
    e.stopPropagation();
    const k = docPerScreen();
    const dx = (e.clientX - d.startX) * k;
    const dy = (e.clientY - d.startY) * k;
    if (d.kind === "move") {
      setDraft({ rect: moveCropRect(b.width, b.height, d.start, dx, dy), free: false });
      return;
    }
    // A fresh frame is a corner drag from a zero-size box: the corner is
    // whichever way the pointer has gone. Ignore a click-sized wobble.
    if (d.kind === "draw" && Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < 4) return;
    const corner = d.kind === "draw" ? cornerToward(0, 0, dx, dy) : d.kind;
    // Where the dragged corner started, plus the pointer's travel.
    const cx = d.start.x + (corner === "ne" || corner === "se" ? d.start.width : 0);
    const cy = d.start.y + (corner === "sw" || corner === "se" ? d.start.height : 0);
    // Shift breaks the ratio, read per move so it can be pressed mid-drag.
    setDraft(
      e.shiftKey
        ? { rect: freeCropRectFromCorner(b.width, b.height, d.start, corner, cx + dx, cy + dy), free: true }
        : { rect: resizeCropRectFromCorner(b.width, b.height, rw, rh, d.start, corner, cx + dx, cy + dy), free: false },
    );
  };
  /** Let go: NOW the frame is stored and the thumbnails re-shade. */
  const endDrag = (e: React.PointerEvent<HTMLElement>) => {
    if (!dragRef.current) return;
    e.stopPropagation();
    dragRef.current = null;
    if (draft) commit(draft.rect, draft.free);
    setDraft(null);
  };

  // Keyboard: arrows move 1% (Shift: 10%), + / − resize, 0 resets.
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const step = (e.shiftKey ? 0.1 : 0.01) * Math.min(b.width, b.height);
    const move: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    if (move[e.key]) {
      const [dx, dy] = move[e.key]!;
      commit(moveCropRect(b.width, b.height, rect, dx, dy));
    } else if (e.key === "+" || e.key === "=" || e.key === "-" || e.key === "_") {
      const f = framingFromRect(b.width, b.height, rw, rh, rect);
      const grow = e.key === "+" || e.key === "=" ? 1.05 : 1 / 1.05;
      setFraming(photoId, { ...f, scale: Math.min(1, f.scale * grow) });
    } else if (e.key === "0") {
      clearFraming(photoId);
    } else {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
  };

  // Percent of the DOCUMENT box, which is what the container is sized to.
  const pctX = (px: number) => `${((b.x + px) / width) * 100}%`;
  const pctY = (px: number) => `${((b.y + px) / height) * 100}%`;
  const inv = 1 / Math.max(zoom, 0.01);
  // The frame in document px, for the SVG shade and thirds below.
  const fx = b.x + rect.x;
  const fy = b.y + rect.y;

  return (
    <div
      ref={boxRef}
      style={{
        position: "absolute",
        width: cssWidth ?? width,
        height: cssHeight ?? height,
        transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom})`,
        transformOrigin: "center center",
        pointerEvents: "none",
        zIndex: 24,
      }}
    >
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        width="100%"
        height="100%"
        style={{ position: "absolute", inset: 0 }}
        aria-hidden="true"
      >
        {/* Shade the part of the PHOTO that the crop throws away. */}
        <path
          fillRule="evenodd"
          fill={SHADE}
          d={`M${b.x} ${b.y}h${b.width}v${b.height}h${-b.width}Z M${fx} ${fy}h${rect.width}v${rect.height}h${-rect.width}Z`}
        />
        {[1, 2].map((i) => (
          <g key={i} stroke={THIRDS} strokeWidth={1} vectorEffect="non-scaling-stroke">
            <line x1={fx + (rect.width * i) / 3} y1={fy} x2={fx + (rect.width * i) / 3} y2={fy + rect.height} vectorEffect="non-scaling-stroke" />
            <line x1={fx} y1={fy + (rect.height * i) / 3} x2={fx + rect.width} y2={fy + (rect.height * i) / 3} vectorEffect="non-scaling-stroke" />
          </g>
        ))}
        <rect
          x={fx}
          y={fy}
          width={rect.width}
          height={rect.height}
          fill="none"
          stroke={LINE}
          strokeWidth={1.5}
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      {/* The photo itself: a drag that starts outside the frame draws a new
          one. Under the frame and the handles, so those still win. */}
      <div
        aria-hidden="true"
        data-testid="batch-crop-draw-area"
        onPointerDown={startDraw}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        style={{
          position: "absolute",
          left: pctX(0),
          top: pctY(0),
          width: `${(b.width / width) * 100}%`,
          height: `${(b.height / height) * 100}%`,
          cursor: "crosshair",
          pointerEvents: hit,
          touchAction: "none",
        }}
      />

      {/* The frame body: drag to move, focus + arrows for keyboard users. */}
      <div
        ref={frameRef}
        tabIndex={0}
        role="group"
        aria-label={`Crop frame, ${label}. Drag to move, drag a corner to resize, Shift-drag to break the ratio. Enter crops every photo. Arrow keys move, plus and minus resize, 0 resets.`}
        onPointerDown={(e) => startDrag(e, "move")}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={onKeyDown}
        onDoubleClick={(e) => {
          e.stopPropagation();
          clearFraming(photoId);
        }}
        className="focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        style={{
          position: "absolute",
          left: pctX(rect.x),
          top: pctY(rect.y),
          width: `${(rect.width / width) * 100}%`,
          height: `${(rect.height / height) * 100}%`,
          cursor: "move",
          pointerEvents: hit,
          touchAction: "none",
        }}
      />

      {CORNERS.map((c) => (
        <div
          key={c.id}
          aria-hidden="true"
          onPointerDown={(e) => startDrag(e, c.id)}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          style={{
            position: "absolute",
            left: pctX(rect.x + c.ax * rect.width),
            top: pctY(rect.y + c.ay * rect.height),
            width: HANDLE_PX,
            height: HANDLE_PX,
            transform: `translate(-50%, -50%) scale(${inv})`,
            background: "#fff",
            border: "1px solid rgba(0,0,0,0.35)",
            borderRadius: 2,
            cursor: c.cursor,
            pointerEvents: hit,
            touchAction: "none",
          }}
        />
      ))}
    </div>
  );
}
