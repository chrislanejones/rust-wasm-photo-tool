import React, { useRef } from "react";
import type { useCloneStamp } from "@/hooks/useCloneStamp";
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
  textSettings?: { fontSize: number; fontWeight: string; textColor: string };
  containerRef?: React.RefObject<HTMLDivElement | null>;
}

// Fix #6: map tool → cursor
function getCursorForTool(tool?: string): string | undefined {
  switch (tool) {
    case "text":
      return "text";
    case "crop":
    case "arrow":
    case "shapes":
      return "crosshair";
    default:
      return undefined; // default cursor (or brush preview handles it)
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
    },
    ref,
  ) => {
    const { onMouseDown, onMouseMove, onMouseUp, state } = hookResult;
    const canvasRef = ref as React.RefObject<HTMLCanvasElement | null>;
    const internalContainerRef = useRef<HTMLDivElement>(null);
    const containerRef = externalContainerRef ?? internalContainerRef;

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
    const cursor = getCursorForTool(activeTool);

    return (
      <div
        className="canvas-wrapper"
        ref={containerRef as React.RefObject<HTMLDivElement>}
      >
        <canvas
          ref={ref}
          className="main-canvas"
          style={{
            transform: zoom !== 1 ? `scale(${zoom})` : undefined,
            transformOrigin: "center center",
            cursor,
          }}
          onMouseDown={isTextTool ? undefined : onMouseDown}
          onMouseMove={isTextTool ? undefined : onMouseMove}
          onMouseUp={isTextTool ? undefined : onMouseUp}
          onMouseLeave={isTextTool ? undefined : onMouseUp}
          onClick={isTextTool ? onCanvasClick : undefined}
          onMouseEnter={(e) =>
            onCanvasEnter(e.currentTarget.getBoundingClientRect())
          }
          onMouseOut={onCanvasLeave}
        />
        <CompareSlider beforeUrl={beforeUrl} active={compareActive} />

        {/* Brush cursor */}
        {cursorVisible && !isTextTool && !cursor && (
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
