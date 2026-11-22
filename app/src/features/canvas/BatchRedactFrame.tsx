// Batch › Redact — the boxes on the preview (Night 11-21, 230, ADR-108).
// Drag anywhere on the photo to draw a box (up to 10), drag a box to move it,
// double-click or Delete removes it (as a double-click resets the crop
// frame). Nothing touches pixels here: the boxes are a plan, stored per
// group, and "Redact" in the panel applies them to every photo.
//
// Mounted inside BatchCropOverlay (which CanvasArea's renderOverlay already
// draws), so AppShell gains nothing. Positioned the way that frame is: a box
// the size of the canvas's fit-scaled CSS box riding the same pan/zoom.
//
// Boxes are stored in the photo's ORIGINAL pixels (lib/batchRedact.ts). The
// canvas holds a working copy of at most 2048 px, so screen ↔ store goes
// through `k` = original width / working width. On a photo other than the
// one a box was drawn on, it shows where it WILL land (relative or anchored);
// moving it there re-bases it on this photo.
import { useRef, useState } from "react";
import type { OverlayFrame } from "./overlayFrame";
import type { PhotoBounds } from "@/hooks/usePhotoBounds";
import { boxOnPhoto, MAX_BOXES, scaleRect, type Rect } from "@/lib/batchRedact";
import { useBatchRedactStore } from "@/stores/useBatchRedactStore";
import { groupOf } from "@/stores/useBatchGroupStore";
import { useGalleryStore } from "@/stores/useGalleryStore";
import { useToolStore } from "@/stores/useToolStore";
import { useUIStore } from "@/stores/useUIStore";

// On-photo colors are inline, not theme tokens: they sit on the user's
// picture, where only a dark shade and a white line read on anything — the
// pair the crop frame uses.
const FILL = "rgba(0,0,0,0.45)";
const LINE = "rgba(255,255,255,0.95)";

interface Props extends OverlayFrame {
  photoBounds: PhotoBounds | null;
}

let seq = 0;
const newId = () => `r${Date.now().toString(36)}${(seq++).toString(36)}`;

export function BatchRedactFrame({ width, height, cssWidth, cssHeight, panOffset, zoom, photoBounds }: Props) {
  const boxRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ kind: "draw" | "move"; id?: string; sx: number; sy: number; start: Rect } | null>(null);
  const [draft, setDraft] = useState<{ id?: string; rect: Rect } | null>(null);

  const on = useToolStore((s) => s.activeTool === "emoji" && s.batchMode === "redact");
  const photoId = useGalleryStore((s) => s.activePhotoId);
  // Two primitive selectors: one returning a fresh {w, h} object would be a
  // new snapshot on every read, which useSyncExternalStore loops on.
  const origW = useGalleryStore((s) => s.photos.find((x) => x.id === s.activePhotoId)?.origWidth ?? 0);
  const origH = useGalleryStore((s) => s.photos.find((x) => x.id === s.activePhotoId)?.origHeight ?? 0);
  const group = useGalleryStore((s) => (photoId ? groupOf(s.selectedIds, photoId) : "main"));
  const look = useBatchRedactStore((s) => s.looks[group]);
  const addBox = useBatchRedactStore((s) => s.addBox);
  const moveBox = useBatchRedactStore((s) => s.moveBox);
  const removeBox = useBatchRedactStore((s) => s.removeBox);
  const hit = useUIStore((s) => s.isPanning) ? "none" : "auto";

  if (!on || !photoId || width <= 0 || height <= 0) return null;
  const b = photoBounds ?? { x: 0, y: 0, width, height };
  if (b.width < 2 || b.height < 2) return null;
  const ow = origW > 0 ? origW : b.width;
  const oh = origH > 0 ? origH : b.height;
  /** working px per original px */
  const k = b.width / ow;

  // Each stored box where it lands on THIS photo, in working px.
  const shown = look.boxes
    .map((box, i) => {
      const r = boxOnPhoto(box, look, ow, oh);
      return r ? { id: box.id, n: i + 1, rect: scaleRect(r, k) } : null;
    })
    .filter((x): x is { id: string; n: number; rect: Rect } => x !== null);

  const toPhoto = (clientX: number, clientY: number) => {
    const box = boxRef.current?.getBoundingClientRect();
    const s = box && box.width > 0 ? width / box.width : 1;
    return {
      x: Math.max(0, Math.min(b.width, (clientX - (box?.left ?? 0)) * s - b.x)),
      y: Math.max(0, Math.min(b.height, (clientY - (box?.top ?? 0)) * s - b.y)),
    };
  };
  const docPerScreen = () => {
    const box = boxRef.current?.getBoundingClientRect();
    return box && box.width > 0 ? width / box.width : 1;
  };

  const startDraw = (e: React.PointerEvent<HTMLElement>) => {
    if (e.button !== 0 || look.boxes.length >= MAX_BOXES) return;
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = toPhoto(e.clientX, e.clientY);
    dragRef.current = { kind: "draw", sx: e.clientX, sy: e.clientY, start: { x: p.x, y: p.y, w: 0, h: 0 } };
  };
  const startMove = (e: React.PointerEvent<HTMLElement>, id: string, rect: Rect) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { kind: "move", id, sx: e.clientX, sy: e.clientY, start: rect };
  };
  const onMove = (e: React.PointerEvent<HTMLElement>) => {
    const d = dragRef.current;
    if (!d) return;
    e.stopPropagation();
    const s = docPerScreen();
    const dx = (e.clientX - d.sx) * s;
    const dy = (e.clientY - d.sy) * s;
    if (d.kind === "move") {
      const x = Math.max(0, Math.min(b.width - d.start.w, d.start.x + dx));
      const y = Math.max(0, Math.min(b.height - d.start.h, d.start.y + dy));
      setDraft({ id: d.id, rect: { ...d.start, x, y } });
      return;
    }
    if (Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 4) return;
    const p = toPhoto(e.clientX, e.clientY);
    setDraft({
      rect: {
        x: Math.min(d.start.x, p.x),
        y: Math.min(d.start.y, p.y),
        w: Math.abs(p.x - d.start.x),
        h: Math.abs(p.y - d.start.y),
      },
    });
  };
  /** Store a rect drawn or moved on THIS photo, in its original px. */
  const toStored = (r: Rect) => scaleRect(r, 1 / k);
  const endDrag = (e: React.PointerEvent<HTMLElement>) => {
    const d = dragRef.current;
    if (!d) return;
    e.stopPropagation();
    dragRef.current = null;
    if (draft && draft.rect.w >= 2 && draft.rect.h >= 2) {
      const at = { ...toStored(draft.rect), srcW: ow, srcH: oh };
      if (d.kind === "move" && d.id) moveBox(group, d.id, at);
      else addBox(group, { id: newId(), ...at });
    }
    setDraft(null);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>, id: string, rect: Rect) => {
    const step = (e.shiftKey ? 10 : 1) * Math.max(1, Math.round(1 / k));
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    if (e.key === "Delete" || e.key === "Backspace") {
      removeBox(group, id);
    } else if (moves[e.key]) {
      const [dx, dy] = moves[e.key]!;
      const at = toStored(rect);
      moveBox(group, id, { ...at, x: Math.max(0, at.x + dx), y: Math.max(0, at.y + dy), srcW: ow, srcH: oh });
    } else {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
  };

  const pctX = (px: number) => `${((b.x + px) / width) * 100}%`;
  const pctY = (px: number) => `${((b.y + px) / height) * 100}%`;
  const inv = 1 / Math.max(zoom, 0.01);
  const drawn = draft && !draft.id ? [{ id: "draft", n: shown.length + 1, rect: draft.rect }] : [];
  const boxes = [
    ...shown.map((s) => (draft?.id === s.id ? { ...s, rect: draft.rect } : s)),
    ...drawn,
  ];

  return (
    <div
      ref={boxRef}
      data-testid="batch-redact-overlay"
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
      <div
        aria-hidden="true"
        data-testid="batch-redact-draw-area"
        onPointerDown={startDraw}
        onPointerMove={onMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        style={{
          position: "absolute",
          left: pctX(0),
          top: pctY(0),
          width: `${(b.width / width) * 100}%`,
          height: `${(b.height / height) * 100}%`,
          cursor: look.boxes.length >= MAX_BOXES ? "not-allowed" : "crosshair",
          pointerEvents: hit,
          touchAction: "none",
        }}
      />
      {boxes.map(({ id, n, rect }) => (
        <div
          key={id}
          role="group"
          tabIndex={id === "draft" ? -1 : 0}
          data-testid="batch-redact-box"
          aria-label={`Redact box ${n}. Drag to move, double-click to remove. Arrow keys move, Delete removes.`}
          title="Drag to move · double-click to remove"
          onPointerDown={id === "draft" ? undefined : (e) => startMove(e, id, rect)}
          onDoubleClick={
            id === "draft"
              ? undefined
              : (e) => {
                  e.stopPropagation();
                  removeBox(group, id);
                }
          }
          onPointerMove={onMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onKeyDown={id === "draft" ? undefined : (e) => onKeyDown(e, id, rect)}
          className="focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          style={{
            position: "absolute",
            left: pctX(rect.x),
            top: pctY(rect.y),
            width: `${(rect.w / width) * 100}%`,
            height: `${(rect.h / height) * 100}%`,
            background: FILL,
            outline: `${1.5 * inv}px dashed ${LINE}`,
            cursor: "move",
            pointerEvents: hit,
            touchAction: "none",
          }}
        >
        </div>
      ))}
    </div>
  );
}
