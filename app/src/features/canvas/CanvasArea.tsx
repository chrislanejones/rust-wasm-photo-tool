// ===== FILE: app/src/features/canvas/CanvasArea.tsx =====
// Item 2: Spacebar pan (Photoshop-style hand tool)
// Item 3: Alt+Scroll zoom fix (zoom transform now uses panOffset)
import React, { useCallback, useEffect, useRef, useState } from "react";
import type { useCloneStamp } from "@/hooks/useCloneStamp";
import type { CropSelection } from "@/hooks/useDrawingTools";
import { CompareSlider } from "./CompareSlider";

interface TextInputState {
  screenX: number;
  screenY: number;
  canvasX: number;
  canvasY: number;
  text: string;
}

interface Props {
  hookResult: ReturnType<typeof useCloneStamp>;
  brushDiameter: number;
  cursorPos: { x: number; y: number };
  cursorVisible: boolean;
  onCanvasEnter: (rect: DOMRect) => void;
  onCanvasLeave: () => void;
  beforeUrl: string | null;
  compareActive: boolean;
  activeTool?: string;
  textInput?: TextInputState | null;
  textareaRef?: React.RefObject<HTMLTextAreaElement | null>;
  onCanvasClick?: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  onTextKeyDown?: (e: React.KeyboardEvent) => void;
  onTextChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onTextBlur?: () => void;
  textSettings?: { fontSize: number; fontFamily?: string; fontWeight: string; textColor: string };
  colorPickerActive?: boolean;
  containerRef?: React.RefObject<HTMLDivElement | null>;
  onTextPositionChange?: (canvasX: number, canvasY: number) => void;
  onTextFontSizeChange?: (size: number) => void;
  // Text extract drag events (active when extract mode is on)
  extractMouseDown?: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  extractMouseMove?: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  extractMouseUp?: () => void;
  // Item 2: Pan mode
  isPanning?: boolean;
  cropSelection?: CropSelection | null;
  onCropChange?: (sel: CropSelection) => void;
}

function getCursorForTool(tool?: string, isPanning?: boolean, colorPickerActive?: boolean): string | undefined {
  if (isPanning) return "grab";
  if (colorPickerActive && tool === "effects") return "crosshair";
  switch (tool) {
    case "text":
      return "text";
    case "crop":
    case "arrow":
    case "shapes":
      return "crosshair";
    default:
      return undefined;
  }
}

export const CanvasArea = React.forwardRef<HTMLCanvasElement, Props>(
  (
    {
      hookResult,
      brushDiameter,
      cursorPos,
      cursorVisible,
      onCanvasEnter,
      onCanvasLeave,
      beforeUrl,
      compareActive,
      activeTool,
      textInput,
      textareaRef,
      onCanvasClick,
      onTextKeyDown,
      onTextChange,
      onTextBlur,
      textSettings,
      containerRef: externalContainerRef,
      onTextPositionChange,
      onTextFontSizeChange,
      extractMouseDown,
      extractMouseMove,
      extractMouseUp,
      isPanning = false,
      cropSelection,
      onCropChange,
      colorPickerActive,
    },
    ref,
  ) => {
    const { onMouseDown, onMouseMove, onMouseUp, state } = hookResult;
    const canvasRef = ref as React.RefObject<HTMLCanvasElement | null>;
    const internalContainerRef = useRef<HTMLDivElement>(null);
    const containerRef = externalContainerRef ?? internalContainerRef;

    // Item 2: Pan offset state
    const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
    const panStartRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
    const [isDraggingPan, setIsDraggingPan] = useState(false);

    const handlePanMouseDown = useCallback(
      (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (isPanning) {
          e.preventDefault();
          e.stopPropagation();
          panStartRef.current = {
            x: e.clientX,
            y: e.clientY,
            ox: panOffset.x,
            oy: panOffset.y,
          };
          setIsDraggingPan(true);
          return;
        }
      },
      [isPanning, panOffset],
    );

    const handlePanMouseMove = useCallback(
      (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (isDraggingPan && panStartRef.current) {
          const dx = e.clientX - panStartRef.current.x;
          const dy = e.clientY - panStartRef.current.y;
          setPanOffset({
            x: panStartRef.current.ox + dx,
            y: panStartRef.current.oy + dy,
          });
          return;
        }
      },
      [isDraggingPan],
    );

    const handlePanMouseUp = useCallback(() => {
      if (isDraggingPan) {
        setIsDraggingPan(false);
        panStartRef.current = null;
      }
    }, [isDraggingPan]);

    // ── Crop handle drag ───────────────────────────────────────────────
    const cropDragRef = useRef<{
      handle: string;
      startX: number;
      startY: number;
      startSel: CropSelection;
      scaleX: number;
      scaleY: number;
    } | null>(null);

    const onCropChangeRef = useRef(onCropChange);
    useEffect(() => { onCropChangeRef.current = onCropChange; });

    useEffect(() => {
      const onMove = (e: PointerEvent) => {
        const drag = cropDragRef.current;
        if (!drag || !onCropChangeRef.current || !canvasRef.current) return;
        const canvas = canvasRef.current;
        const { handle, startX, startY, startSel, scaleX, scaleY } = drag;
        const dx = (e.clientX - startX) / scaleX;
        const dy = (e.clientY - startY) / scaleY;
        let { x, y, width: w, height: h } = startSel;
        switch (handle) {
          case "nw": x += dx; y += dy; w -= dx; h -= dy; break;
          case "n":  y += dy; h -= dy; break;
          case "ne": y += dy; w += dx; h -= dy; break;
          case "e":  w += dx; break;
          case "se": w += dx; h += dy; break;
          case "s":  h += dy; break;
          case "sw": x += dx; w -= dx; h += dy; break;
          case "w":  x += dx; w -= dx; break;
        }
        const min = 10;
        w = Math.max(min, w);
        h = Math.max(min, h);
        x = Math.max(0, Math.min(x, canvas.width - min));
        y = Math.max(0, Math.min(y, canvas.height - min));
        w = Math.min(w, canvas.width - x);
        h = Math.min(h, canvas.height - y);
        onCropChangeRef.current({
          x: Math.round(x), y: Math.round(y),
          width: Math.round(w), height: Math.round(h),
        });
      };
      const onUp = () => { cropDragRef.current = null; };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      return () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };
    }, []);

    const handleCropPointerDown = useCallback(
      (e: React.PointerEvent<SVGRectElement>, handle: string) => {
        if (!cropSelection || !canvasRef.current) return;
        e.preventDefault();
        e.stopPropagation();
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        cropDragRef.current = {
          handle,
          startX: e.clientX,
          startY: e.clientY,
          startSel: { ...cropSelection },
          scaleX: rect.width / canvas.width,
          scaleY: rect.height / canvas.height,
        };
        e.currentTarget.setPointerCapture(e.pointerId);
      },
      [cropSelection, canvasRef],
    );

    let markerStyle: React.CSSProperties | null = null;
    if (state.sourcePos && canvasRef.current) {
      const canvas = canvasRef.current;
      const rect = canvas.getBoundingClientRect();
      markerStyle = {
        left: rect.left + state.sourcePos.x * (rect.width / canvas.width),
        top: rect.top + state.sourcePos.y * (rect.height / canvas.height),
      };
    }

    const zoom = state.zoom;
    const isTextTool = activeTool === "text";
    const cursor = getCursorForTool(activeTool, isPanning, colorPickerActive);
    const panCursor = isDraggingPan ? "grabbing" : cursor;

    // Combined mouse handlers — pan takes priority when spacebar is held
    const wrappedMouseDown = isPanning
      ? handlePanMouseDown
      : isTextTool
        ? extractMouseDown
        : onMouseDown;
    const wrappedMouseMove = isPanning
      ? handlePanMouseMove
      : isTextTool
        ? extractMouseMove
        : onMouseMove;
    const wrappedMouseUp = isPanning
      ? handlePanMouseUp
      : isTextTool
        ? extractMouseUp
        : onMouseUp;

    const { width: imgW, height: imgH, hasTransparency } = hookResult.state;

    return (
      <div
        className="canvas-wrapper"
        ref={containerRef as React.RefObject<HTMLDivElement>}
      >
        {/* Checkerboard behind the canvas — only when the image has transparent pixels */}
        {hasTransparency && imgW > 0 && imgH > 0 && (
          <div
            className="checkerboard"
            style={{
              position: "absolute",
              width: imgW,
              height: imgH,
              transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom})`,
              transformOrigin: "center center",
              pointerEvents: "none",
            }}
          />
        )}
        <canvas
          ref={ref}
          className="main-canvas"
          style={{
            // Item 3: Fixed zoom + pan transform
            transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom})`,
            transformOrigin: "center center",
            cursor: panCursor,
          }}
          onMouseDown={wrappedMouseDown}
          onMouseMove={wrappedMouseMove}
          onMouseUp={wrappedMouseUp}
          onMouseLeave={isPanning ? handlePanMouseUp : isTextTool ? extractMouseUp : onMouseUp}
          onClick={isTextTool ? onCanvasClick : undefined}
          onMouseEnter={(e) =>
            onCanvasEnter(e.currentTarget.getBoundingClientRect())
          }
          onMouseOut={onCanvasLeave}
        />
        <CompareSlider beforeUrl={beforeUrl} active={compareActive} />

        {/* ── Crop overlay: dark mask + rule-of-thirds + draggable handles ── */}
        {activeTool === "crop" && cropSelection && canvasRef.current && (() => {
          const canvas = canvasRef.current!;
          const r = canvas.getBoundingClientRect();
          const sx = r.width / canvas.width;
          const sy = r.height / canvas.height;
          const { x, y, width: sw, height: sh } = cropSelection;
          const vx = r.left + x * sx;
          const vy = r.top + y * sy;
          const vw = sw * sx;
          const vh = sh * sy;
          const HS = 9; // handle size in screen px

          const handles = [
            { id: "nw", hx: vx,        hy: vy,       cursor: "nw-resize" },
            { id: "n",  hx: vx+vw/2,   hy: vy,       cursor: "n-resize"  },
            { id: "ne", hx: vx+vw,     hy: vy,       cursor: "ne-resize" },
            { id: "e",  hx: vx+vw,     hy: vy+vh/2,  cursor: "e-resize"  },
            { id: "se", hx: vx+vw,     hy: vy+vh,    cursor: "se-resize" },
            { id: "s",  hx: vx+vw/2,   hy: vy+vh,    cursor: "s-resize"  },
            { id: "sw", hx: vx,        hy: vy+vh,    cursor: "sw-resize" },
            { id: "w",  hx: vx,        hy: vy+vh/2,  cursor: "w-resize"  },
          ];

          return (
            <svg
              style={{
                position: "fixed",
                inset: 0,
                width: "100vw",
                height: "100vh",
                pointerEvents: "none",
                zIndex: 40,
                overflow: "hidden",
              }}
            >
              {/* Dark overlay — 4 rects framing the crop selection */}
              <rect x={r.left} y={r.top}   width={r.width}        height={Math.max(0, vy - r.top)}         fill="rgba(0,0,0,0.55)" />
              <rect x={r.left} y={vy + vh} width={r.width}        height={Math.max(0, r.bottom - (vy+vh))} fill="rgba(0,0,0,0.55)" />
              <rect x={r.left} y={vy}      width={Math.max(0, vx - r.left)}        height={vh} fill="rgba(0,0,0,0.55)" />
              <rect x={vx+vw}  y={vy}      width={Math.max(0, r.right - (vx+vw))}  height={vh} fill="rgba(0,0,0,0.55)" />

              {/* Dashed selection border */}
              <rect x={vx} y={vy} width={vw} height={vh}
                fill="none" stroke="white" strokeWidth={1} strokeDasharray="5 5" />

              {/* Rule-of-thirds guides */}
              <line x1={vx + vw/3}   y1={vy} x2={vx + vw/3}   y2={vy+vh} stroke="rgba(255,255,255,0.38)" strokeWidth={0.75} />
              <line x1={vx + 2*vw/3} y1={vy} x2={vx + 2*vw/3} y2={vy+vh} stroke="rgba(255,255,255,0.38)" strokeWidth={0.75} />
              <line x1={vx} y1={vy + vh/3}   x2={vx+vw} y2={vy + vh/3}   stroke="rgba(255,255,255,0.38)" strokeWidth={0.75} />
              <line x1={vx} y1={vy + 2*vh/3} x2={vx+vw} y2={vy + 2*vh/3} stroke="rgba(255,255,255,0.38)" strokeWidth={0.75} />

              {/* Resize handles */}
              {handles.map(h => (
                <rect
                  key={h.id}
                  x={h.hx - HS/2} y={h.hy - HS/2}
                  width={HS} height={HS}
                  fill="white"
                  stroke="rgba(0,0,0,0.35)"
                  strokeWidth={1}
                  rx={1}
                  style={{ cursor: h.cursor, pointerEvents: "all" }}
                  onPointerDown={(e) => handleCropPointerDown(e, h.id)}
                />
              ))}
            </svg>
          );
        })()}

        {/* Brush cursor — hidden during pan */}
        {cursorVisible && !isTextTool && !cursor && !isPanning && (
          <div
            className="brush-cursor"
            style={{
              left: cursorPos.x,
              top: cursorPos.y,
              width: brushDiameter,
              height: brushDiameter,
            }}
          />
        )}

        {/* Source marker */}
        {markerStyle && (
          <div
            className="source-marker"
            style={{
              position: "fixed",
              ...markerStyle,
              width: 12,
              height: 12,
              transform: "translate(-50%, -50%)",
              pointerEvents: "none",
              zIndex: 999,
            }}
          />
        )}

        {/* Text input overlay with move/resize handles */}
        {textInput && textSettings && canvasRef.current && containerRef.current && (() => {
          const canvas = canvasRef.current!;
          const container = containerRef.current!;
          const cr = canvas.getBoundingClientRect();
          const ctr = container.getBoundingClientRect();
          const scaleX = cr.width / canvas.width;
          const scaleY = cr.height / canvas.height;

          // Screen-space position of the text anchor (top-left of text)
          const sx = cr.left - ctr.left + textInput.canvasX * scaleX;
          const sy = cr.top - ctr.top + textInput.canvasY * scaleY;

          // Measure the text box in screen pixels
          const offscreen = document.createElement("canvas");
          const mctx = offscreen.getContext("2d")!;
          const fs = textSettings.fontSize * scaleX;
          mctx.font = `${textSettings.fontWeight} ${fs}px 'Liberation Sans', Arial, sans-serif`;
          const lines = (textInput.text || " ").split("\n");
          const rawW = Math.max(60, ...lines.map((l) => mctx.measureText(l || " ").width));
          const boxW = Math.ceil(rawW + fs * 0.6);
          const boxH = Math.ceil(lines.length * fs * 1.3 + fs * 0.3);

          const HS = 9; // handle size px
          const handles = [
            { id: "nw", hx: sx,         hy: sy,          cursor: "nw-resize" },
            { id: "n",  hx: sx + boxW/2, hy: sy,          cursor: "n-resize"  },
            { id: "ne", hx: sx + boxW,   hy: sy,          cursor: "ne-resize" },
            { id: "e",  hx: sx + boxW,   hy: sy + boxH/2, cursor: "e-resize"  },
            { id: "se", hx: sx + boxW,   hy: sy + boxH,   cursor: "se-resize" },
            { id: "s",  hx: sx + boxW/2, hy: sy + boxH,   cursor: "s-resize"  },
            { id: "sw", hx: sx,          hy: sy + boxH,   cursor: "sw-resize" },
            { id: "w",  hx: sx,          hy: sy + boxH/2, cursor: "w-resize"  },
          ];

          const handlePointerDown = (e: React.PointerEvent, _handleId: string) => {
            e.stopPropagation();
            e.preventDefault();
            const startFs = textSettings.fontSize;
            const centerX = cr.left - ctr.left + textInput.canvasX * scaleX + boxW / 2;
            const centerY = cr.top - ctr.top + textInput.canvasY * scaleY + boxH / 2;
            const startDist = Math.hypot(e.clientX - (ctr.left + centerX), e.clientY - (ctr.top + centerY));

            const onMove = (me: PointerEvent) => {
              const dist = Math.hypot(me.clientX - (ctr.left + centerX), me.clientY - (ctr.top + centerY));
              if (startDist > 4) {
                const newFs = Math.round(Math.max(8, Math.min(120, startFs * (dist / startDist))));
                onTextFontSizeChange?.(newFs);
              }
            };
            const onUp = () => {
              window.removeEventListener("pointermove", onMove);
              window.removeEventListener("pointerup", onUp);
            };
            window.addEventListener("pointermove", onMove);
            window.addEventListener("pointerup", onUp);
          };

          const handleBoxPointerDown = (e: React.PointerEvent) => {
            e.stopPropagation();
            e.preventDefault();
            const startX = e.clientX;
            const startY = e.clientY;
            const startCx = textInput.canvasX;
            const startCy = textInput.canvasY;

            const onMove = (me: PointerEvent) => {
              const dx = (me.clientX - startX) / scaleX;
              const dy = (me.clientY - startY) / scaleY;
              onTextPositionChange?.(startCx + dx, startCy + dy);
            };
            const onUp = () => {
              window.removeEventListener("pointermove", onMove);
              window.removeEventListener("pointerup", onUp);
            };
            window.addEventListener("pointermove", onMove);
            window.addEventListener("pointerup", onUp);
          };

          return (
            <>
              {/* Draggable box body */}
              <div
                style={{
                  position: "absolute",
                  left: sx,
                  top: sy,
                  width: boxW,
                  height: boxH,
                  cursor: "move",
                  zIndex: 50,
                }}
                onPointerDown={handleBoxPointerDown}
              />
              {/* Text area — floats on top of the drag box */}
              <textarea
                ref={textareaRef}
                value={textInput.text}
                onChange={onTextChange}
                onKeyDown={onTextKeyDown}
                onBlur={onTextBlur}
                placeholder="Type text…"
                style={{
                  position: "absolute",
                  left: sx,
                  top: sy,
                  width: boxW,
                  minHeight: boxH,
                  fontSize: textSettings.fontSize * scaleX,
                  fontWeight: textSettings.fontWeight,
                  color: textSettings.textColor,
                  fontFamily: textSettings.fontFamily ?? "'Liberation Sans', Arial, sans-serif",
                  lineHeight: 1.3,
                  padding: "2px 4px",
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  resize: "none",
                  overflow: "hidden",
                  zIndex: 51,
                  cursor: "text",
                }}
                autoFocus
              />
              {/* SVG overlay: dashed border + square handles */}
              <svg
                style={{
                  position: "fixed",
                  inset: 0,
                  width: "100vw",
                  height: "100vh",
                  pointerEvents: "none",
                  zIndex: 52,
                  overflow: "hidden",
                }}
              >
                {/* Dashed border */}
                <rect
                  x={ctr.left + sx} y={ctr.top + sy}
                  width={boxW} height={boxH}
                  fill="none"
                  stroke="rgba(255,255,255,0.85)"
                  strokeWidth={1.5}
                  strokeDasharray="5 4"
                />
                {/* Square handles */}
                {handles.map((h) => (
                  <rect
                    key={h.id}
                    x={ctr.left + h.hx - HS / 2}
                    y={ctr.top + h.hy - HS / 2}
                    width={HS} height={HS}
                    fill="white"
                    stroke="rgba(0,0,0,0.4)"
                    strokeWidth={1}
                    rx={1}
                    style={{ cursor: h.cursor, pointerEvents: "all" }}
                    onPointerDown={(e) => handlePointerDown(e, h.id)}
                  />
                ))}
              </svg>
            </>
          );
        })()}
      </div>
    );
  },
);
