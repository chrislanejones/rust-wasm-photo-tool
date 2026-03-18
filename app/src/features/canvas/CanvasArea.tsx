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
            cursor: isTextTool ? "text" : undefined,
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

        {/* Text input overlay */}
        {isTextTool && textInput && (
          <textarea
            ref={textareaRef as React.RefObject<HTMLTextAreaElement>}
            value={textInput.text}
            onChange={onTextChange}
            onKeyDown={onTextKeyDown}
            onBlur={onTextBlur}
            placeholder="Type text..."
            className="absolute bg-transparent border-2 border-dashed border-accent outline-none resize-none overflow-hidden z-20"
            style={{
              left: textInput.screenX,
              top: textInput.screenY,
              minWidth: 120,
              minHeight: (textSettings?.fontSize ?? 24) * 1.5,
              fontSize: (textSettings?.fontSize ?? 24) * zoom,
              fontWeight: textSettings?.fontWeight ?? "normal",
              color: textSettings?.textColor ?? "#000000",
              fontFamily: "sans-serif",
              lineHeight: 1.3,
              padding: "2px 4px",
            }}
            autoFocus
          />
        )}

        {cursorVisible && !isTextTool && (
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
        {markerStyle && <div className="source-marker" style={markerStyle} />}
      </div>
    );
  },
);
