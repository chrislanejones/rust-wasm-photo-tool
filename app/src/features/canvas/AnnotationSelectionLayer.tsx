// Multi-select on the canvas (Night 10-22): picking several annotations,
// dragging them together, and the "N selected" bar.
//
// HOW A PICK HAPPENS.
//   • Shift-click a shape, text, pin or callout with any annotation tool open
//     (Create › Shapes / Pins / Arrows / Text / Select objects).
//   • Create › Select objects: click picks one, a marquee on empty canvas
//     picks everything FULLY inside it, Shift adds.
//   • Ctrl+A, Esc, arrows and Delete are the hook's (useAnnotationSelection).
// Clicking empty canvas, or a layer switch, lets go.
//
// The pointer is read in the CAPTURE phase on the document, before the
// drawing tools' own handlers, and a press we take is cancelled there — so a
// Shift-click on a shape picks it instead of starting a new rectangle.
// Hit-testing is by box in JS, from the hook's geometry snapshot: the press
// has to be claimed synchronously, and an engine call may be a worker round
// trip.
//
// THE DRAG STAYS OUT OF REACT's editor tree. A group drag writes one offset to
// lib/liveEditGeometry; only this layer subscribes, so a move re-renders the
// outlines and nothing else. The engine moves the objects once, on release
// (`move_annotations`, one undo step), and the offset clears after the layer
// has re-read the new geometry, so nothing jumps back.
import { useEffect, useRef, useState } from "react";
import { AlignHorizontalJustifyCenter, Copy, Trash2 } from "lucide-react";
import type { ImageHorseTool } from "stamp_tool";
import {
  CanvasActionBar,
  CanvasActionBarButton,
  CanvasActionBarText,
} from "@/components/ui/canvas-action-bar";
import {
  NONE,
  alignGroups,
  expand,
  has,
  marqueePick,
  pickedBounds,
  pickedCount,
  shapeBox,
  textBox,
  toggle,
  type Box,
  type Picked,
} from "@/lib/annotationSelection";
import { setLiveGroupOffset, useLiveGroupOffset } from "@/lib/liveEditGeometry";
import { annotationToolActive, useAnnotationSelection, type AlignEdge } from "@/app/session/useAnnotationSelection";
import { subToolKey } from "@/features/tools/toolGroups";
import { useToolStore } from "@/stores/useToolStore";
import { useAnnotationStore } from "@/stores/useAnnotationStore";
import { shapeAnnotationAt, type ShapeHitGeometry } from "@/lib/annotationHitTest";

const SELECT_OBJECTS = subToolKey("create", "select-objects");
/** A press that moves less than this (SCREEN px) is a click, not a drag. */
const DRAG_SLOP = 3;
/** Thin shapes (a line, an arrow) are hit within this many IMAGE px. */
const HIT_PAD = 6;

const ALIGN: { edge: AlignEdge; label: string }[] = [
  { edge: "left", label: "Align left" },
  { edge: "centerH", label: "Align centers" },
  { edge: "right", label: "Align right" },
  { edge: "top", label: "Align top" },
  { edge: "middleV", label: "Align middles" },
  { edge: "bottom", label: "Align bottom" },
];

interface Props {
  toolRef: React.RefObject<ImageHorseTool | null>;
  canvasEl: HTMLCanvasElement;
  flushToCanvas: () => void;
  syncState: () => void;
  activeLayerId: number;
}

type Hit = { type: "shape" | "text"; id: number };

export function AnnotationSelectionLayer(props: Props) {
  const { canvasEl } = props;
  const sel = useAnnotationSelection(props);
  const { picked, geometry } = sel;
  const offset = useLiveGroupOffset();
  const [marquee, setMarquee] = useState<Box | null>(null);
  const [menu, setMenu] = useState<"align" | "distribute" | null>(null);
  // Pan, zoom and resize move the canvas under us; re-read its rect then.
  const [, setFrame] = useState(0);
  useEffect(() => {
    const bump = () => setFrame((n) => n + 1);
    window.addEventListener("resize", bump);
    window.addEventListener("wheel", bump, { passive: true });
    return () => {
      window.removeEventListener("resize", bump);
      window.removeEventListener("wheel", bump);
    };
  }, []);
  useEffect(() => setMenu(null), [picked]);

  const latest = useRef({ sel, geometry });
  latest.current = { sel, geometry };

  useEffect(() => {
    const toImage = (e: { clientX: number; clientY: number }) => {
      const r = canvasEl.getBoundingClientRect();
      return {
        x: ((e.clientX - r.left) * canvasEl.width) / r.width,
        y: ((e.clientY - r.top) * canvasEl.height) / r.height,
        scale: r.width / canvasEl.width,
      };
    };
    const hitAt = (x: number, y: number): Hit | null => {
      const { shapes, texts } = latest.current.geometry;
      const within = (b: Box) => x >= b.x0 - HIT_PAD && x <= b.x1 + HIT_PAD && y >= b.y0 - HIT_PAD && y <= b.y1 + HIT_PAD;
      // Texts draw above shapes; within each, the newest is on top.
      for (let i = texts.length - 1; i >= 0; i--) if (within(textBox(texts[i]))) return { type: "text", id: texts[i].id };
      // Shapes by the engine's own rule, as a single-shape click: an UNFILLED
      // rect / circle / oval is its outline ring, so a click in its empty
      // middle picks what is behind it, not the frame (Night 10-23).
      const id = shapeAnnotationAt(shapes as unknown as ShapeHitGeometry[], x, y);
      return id >= 0 ? { type: "shape", id } : null;
    };
    let swallowClick = false;

    const startDrag = (e: PointerEvent, scale: number) => {
      const sx = e.clientX;
      const sy = e.clientY;
      let moved = false;
      const onMove = (m: PointerEvent) => {
        if (!moved && Math.hypot(m.clientX - sx, m.clientY - sy) < DRAG_SLOP) return;
        moved = true;
        setLiveGroupOffset({ x: (m.clientX - sx) / scale, y: (m.clientY - sy) / scale });
      };
      const onUp = async (u: PointerEvent) => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        if (!moved) return;
        const dx = Math.round((u.clientX - sx) / scale);
        const dy = Math.round((u.clientY - sy) / scale);
        await latest.current.sel.moveBy(dx, dy);
        setLiveGroupOffset(null);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    };

    const startMarquee = (e: PointerEvent, additive: boolean) => {
      const a = toImage(e);
      const onMove = (m: PointerEvent) => {
        const b = toImage(m);
        setMarquee({ x0: a.x, y0: a.y, x1: b.x, y1: b.y });
      };
      const onUp = (u: PointerEvent) => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        setMarquee(null);
        const b = toImage(u);
        if (Math.hypot(b.x - a.x, b.y - a.y) * a.scale < DRAG_SLOP) return;
        const { shapes, texts } = latest.current.geometry;
        const got = marqueePick({ x0: a.x, y0: a.y, x1: b.x, y1: b.y }, shapes, texts);
        latest.current.sel.setPicked((p) =>
          additive ? expand({ shapes: [...p.shapes, ...got.shapes], texts: [...p.texts, ...got.texts] }, shapes, texts) : got,
        );
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    };

    const claim = (e: PointerEvent) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      swallowClick = true;
    };

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0 || e.target !== canvasEl) return;
      const selectTool = useToolStore.getState().activeSubTool === SELECT_OBJECTS;
      if (!selectTool && !annotationToolActive()) return;
      const { sel, geometry } = latest.current;
      const p = toImage(e);
      const hit = hitAt(p.x, p.y);
      const picked = sel.picked;
      const pickOf = (h: Hit, base: Picked) => expand(toggle(base, h.type, h.id), geometry.shapes, geometry.texts);
      // A Shift-click on an object adds it, or takes it out, with any
      // annotation tool.
      if (hit && e.shiftKey) {
        claim(e);
        // The shape open in the edit box counts as picked: Shift-clicking a
        // second one picks both (useDrawingTools then closes the box).
        const open = useAnnotationStore.getState().editingShapeId;
        const base =
          open != null && open !== hit.id && !has(picked, "shape", open)
            ? expand(toggle(picked, "shape", open), geometry.shapes, geometry.texts)
            : picked;
        const on = has(base, hit.type, hit.id);
        sel.setPicked(on ? toggle(base, hit.type, hit.id) : pickOf(hit, base));
        return;
      }
      // A press on a picked object drags the whole selection.
      if (hit && has(picked, hit.type, hit.id)) {
        claim(e);
        startDrag(e, p.scale);
        return;
      }
      if (selectTool) {
        claim(e);
        if (hit) {
          sel.setPicked(pickOf(hit, NONE));
          startDrag(e, p.scale);
        } else {
          if (!e.shiftKey) sel.setPicked(NONE);
          startMarquee(e, e.shiftKey);
        }
        return;
      }
      // Any other press on the canvas lets the selection go and carries on.
      if (pickedCount(picked)) sel.setPicked(NONE);
    };
    // A claimed press must not also become a click (the Text tool places a
    // box on click).
    const onClick = (e: MouseEvent) => {
      if (!swallowClick) return;
      swallowClick = false;
      e.preventDefault();
      e.stopImmediatePropagation();
    };
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("click", onClick, true);
    };
  }, [canvasEl]);

  const count = pickedCount(picked);
  const r = canvasEl.getBoundingClientRect();
  const s = r.width / canvasEl.width;
  const screen = (b: Box) => ({ x: r.left + b.x0 * s, y: r.top + b.y0 * s, w: (b.x1 - b.x0) * s, h: (b.y1 - b.y0) * s });
  const bounds = pickedBounds(picked, geometry.shapes, geometry.texts);
  const groups = count ? alignGroups(picked, geometry.shapes, geometry.texts).groups : 0;
  const items = [
    ...geometry.shapes.filter((x) => picked.shapes.includes(x.id)).map((x) => ({ type: "shape", id: x.id, b: shapeBox(x) })),
    ...geometry.texts.filter((x) => picked.texts.includes(x.id)).map((x) => ({ type: "text", id: x.id, b: textBox(x) })),
  ];
  if (!count && !marquee) return null;
  const move = offset ? `translate(${offset.x * s} ${offset.y * s})` : undefined;
  const box = bounds && screen(bounds);
  const mq = marquee && screen({
    x0: Math.min(marquee.x0, marquee.x1), y0: Math.min(marquee.y0, marquee.y1),
    x1: Math.max(marquee.x0, marquee.x1), y1: Math.max(marquee.y0, marquee.y1),
  });

  return (
    <>
      <svg
        data-multi-select-overlay=""
        aria-hidden
        style={{ position: "fixed", inset: 0, width: "100vw", height: "100vh", pointerEvents: "none", zIndex: "var(--z-topbar)", overflow: "hidden" }}
      >
        <g transform={move}>
          {items.map(({ type, id, b }) => {
            const q = screen(b);
            return (
              <rect
                key={`${type}${id}`}
                data-multi-select-item=""
                data-type={type}
                data-id={id}
                x={q.x - 2} y={q.y - 2} width={q.w + 4} height={q.h + 4}
                fill="none" stroke="var(--color-theme-primary)" strokeOpacity={0.55} strokeWidth={1}
              />
            );
          })}
          {box && (
            <rect
              data-multi-select-box=""
              x={box.x - 6} y={box.y - 6} width={box.w + 12} height={box.h + 12}
              fill="none" stroke="var(--color-theme-primary)" strokeWidth={1.5} strokeDasharray="6 4"
            />
          )}
        </g>
        {mq && (
          <rect
            data-multi-select-marquee=""
            x={mq.x} y={mq.y} width={mq.w} height={mq.h}
            fill="var(--color-theme-primary)" fillOpacity={0.08}
            stroke="var(--color-theme-primary)" strokeWidth={1} strokeDasharray="4 3"
          />
        )}
      </svg>
      {box && !offset && !marquee && (
        <CanvasActionBar x={box.x + box.w / 2} y={box.y + box.h + 14} label="Selected objects" data-testid="multi-select-bar">
          <CanvasActionBarText>{count} selected</CanvasActionBarText>
          <CanvasActionBarButton
            onClick={() => setMenu((m) => (m === "align" ? null : "align"))}
            pressed={menu === "align"}
            title="Align"
          >
            <AlignHorizontalJustifyCenter aria-hidden className="size-4" /> Align ▾
          </CanvasActionBarButton>
          <CanvasActionBarButton
            onClick={() => setMenu((m) => (m === "distribute" ? null : "distribute"))}
            pressed={menu === "distribute"}
            disabled={groups < 3}
            title="Distribute"
          >
            Distribute ▾
          </CanvasActionBarButton>
          <CanvasActionBarButton onClick={() => void sel.duplicate()} title="Duplicate">
            <Copy aria-hidden className="size-4" /> Duplicate
          </CanvasActionBarButton>
          <CanvasActionBarButton onClick={() => void sel.remove()} title="Delete">
            <Trash2 aria-hidden className="size-4" /> Delete
          </CanvasActionBarButton>
        </CanvasActionBar>
      )}
      {box && menu && !offset && (
        <CanvasActionBar x={box.x + box.w / 2} y={box.y + box.h + 58} label={menu === "align" ? "Align" : "Distribute"}>
          <div role="menu" aria-label={menu === "align" ? "Align" : "Distribute"} className="flex items-center gap-1">
            {menu === "align"
              ? ALIGN.map(({ edge, label }) => (
                  <CanvasActionBarButton key={edge} role="menuitem" onClick={() => void sel.align(edge)} title={label}>
                    {label.replace("Align ", "")}
                  </CanvasActionBarButton>
                ))
              : (
                <>
                  <CanvasActionBarButton role="menuitem" onClick={() => void sel.distribute("h")} title="Distribute horizontally">
                    Horizontally
                  </CanvasActionBarButton>
                  <CanvasActionBarButton role="menuitem" onClick={() => void sel.distribute("v")} title="Distribute vertically">
                    Vertically
                  </CanvasActionBarButton>
                </>
              )}
          </div>
          {menu === "align" && (
            <CanvasActionBarText>
              {groups >= 2 ? "to the selection · turned shapes by their turned box" : "to the canvas"}
            </CanvasActionBarText>
          )}
        </CanvasActionBar>
      )}
    </>
  );
}
