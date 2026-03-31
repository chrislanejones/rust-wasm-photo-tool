import React, { useCallback, useRef, useState } from "react";
import type { useCloneStamp } from "@/hooks/useCloneStamp";
import { CompareSlider } from "./CompareSlider";
import { CanvasLoader } from "@/components/CanvasLoader";

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
  textSettings?: { fontSize: number; fontWeight: string; textColor: string };
  containerRef?: React.RefObject<HTMLDivElement | null>;
  isPanning?: boolean;
  isImageLoading?: boolean;
  loadProgress?: number;
}

function getCursorForTool(
  tool?: string,
  isPanning?: boolean,
): string | undefined {
  if (isPanning) return "grab";
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
      isPanning = false,
      isImageLoading = false,
      loadProgress = 0,
    },
    ref,
  ) => {
    const { onMouseDown, onMouseMove, onMouseUp, state } = hookResult;
    const canvasRef = ref as React.RefObject<HTMLCanvasElement | null>;
    const internalContainerRef = useRef<HTMLDivElement>(null);
    const containerRef = externalContainerRef ?? internalContainerRef;

    // Item 2: Pan offset state
    const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
    const panStartRef = useRef<{
      x: number;
      y: number;
      ox: number;
      oy: number;
    } | null>(null);
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
    const cursor = getCursorForTool(activeTool, isPanning);
    const panCursor = isDraggingPan ? "grabbing" : cursor;

    // Combined mouse handlers — pan takes priority when spacebar is held
    const wrappedMouseDown = isPanning
      ? handlePanMouseDown
      : isTextTool
        ? undefined
        : onMouseDown;
    const wrappedMouseMove = isPanning
      ? handlePanMouseMove
      : isTextTool
        ? undefined
        : onMouseMove;
    const wrappedMouseUp = isPanning
      ? handlePanMouseUp
      : isTextTool
        ? undefined
        : onMouseUp;

    return (
      <div
        className="canvas-wrapper"
        ref={containerRef as React.RefObject<HTMLDivElement>}
      >
        <CanvasLoader visible={isImageLoading} progress={loadProgress} />
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
          onMouseLeave={
            isPanning ? handlePanMouseUp : isTextTool ? undefined : onMouseUp
          }
          onClick={isTextTool ? onCanvasClick : undefined}
          onMouseEnter={(e) =>
            onCanvasEnter(e.currentTarget.getBoundingClientRect())
          }
          onMouseOut={onCanvasLeave}
        />
        <CompareSlider beforeUrl={beforeUrl} active={compareActive} />

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

        {/* Text input overlay */}
        {textInput && textSettings && (
          <textarea
            ref={textareaRef}
            value={textInput.text}
            onChange={onTextChange}
            onKeyDown={onTextKeyDown}
            onBlur={onTextBlur}
            placeholder="Type text…"
            className="absolute bg-transparent border-2 border-dashed border-accent outline-none resize-none overflow-hidden"
            style={{
              left: textInput.screenX,
              top: textInput.screenY,
              minWidth: 100,
              minHeight: textSettings.fontSize * 1.5,
              fontSize: textSettings.fontSize * zoom,
              fontWeight: textSettings.fontWeight,
              color: textSettings.textColor,
              fontFamily: "sans-serif",
              lineHeight: 1.2,
              padding: "2px 4px",
            }}
            autoFocus
          />
        )}
      </div>
    );
  },
);
