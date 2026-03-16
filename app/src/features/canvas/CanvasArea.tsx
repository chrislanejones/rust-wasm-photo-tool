import React from "react";
import type { useCloneStamp } from "@/hooks/useCloneStamp";
import { CompareSlider } from "./CompareSlider";

interface Props {
  hookResult: ReturnType<typeof useCloneStamp>;
  brushDiameter: number;
  cursorPos: { x: number; y: number };
  cursorVisible: boolean;
  onCanvasEnter: (rect: DOMRect) => void;
  onCanvasLeave: () => void;
  // A/B compare
  beforeUrl: string | null;
  compareActive: boolean;
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

        <CompareSlider beforeUrl={beforeUrl} active={compareActive} />

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
      </div>
    );
  },
);
