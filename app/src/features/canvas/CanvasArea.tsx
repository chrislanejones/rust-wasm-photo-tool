import React from "react";
import type { useCloneStamp } from "@/hooks/useCloneStamp";

interface Props {
  hookResult: ReturnType<typeof useCloneStamp>;
  brushDiameter: number;
  cursorPos: { x: number; y: number };
  cursorVisible: boolean;
  onCanvasEnter: (rect: DOMRect) => void;
  onCanvasLeave: () => void;
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
    },
    ref,
  ) => {
    const { onMouseDown, onMouseMove, onMouseUp, state } = hookResult;

    const canvasRef = ref as React.RefObject<HTMLCanvasElement | null>;
    let markerStyle: React.CSSProperties | null = null;
    if (state.sourcePos && canvasRef.current) {
      const canvas = canvasRef.current;
      const rect = canvas.getBoundingClientRect();
      const scaleX = rect.width / canvas.width;
      const scaleY = rect.height / canvas.height;
      markerStyle = {
        left: rect.left + state.sourcePos.x * scaleX,
        top: rect.top + state.sourcePos.y * scaleY,
      };
    }

    const zoom = state.zoom;

    return (
      <div className="canvas-wrapper">
        <canvas
          ref={ref}
          className="main-canvas"
          style={{
            transform: zoom !== 1 ? `scale(${zoom})` : undefined,
            transformOrigin: "center center",
          }}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
          onMouseEnter={(e) => {
            onCanvasEnter(e.currentTarget.getBoundingClientRect());
          }}
          onMouseOut={onCanvasLeave}
        />
        {cursorVisible && (
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

        {/* Empty state */}
        {!state.ready && (
          <div className="canvas-empty-state">
            <div className="canvas-empty-icon">
              <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="4" y="8" width="40" height="32" rx="4" />
                <circle cx="16" cy="20" r="4" />
                <path d="M4 32l10-8 8 8 8-12 14 12" />
              </svg>
            </div>
            <p className="canvas-empty-title">No image loaded</p>
            <p className="canvas-empty-hint">
              Use <kbd>Open</kbd> in the top bar to add images
            </p>
          </div>
        )}
      </div>
    );
  },
);
