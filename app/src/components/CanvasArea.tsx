// app/src/components/CanvasArea.tsx
import React from "react";
import type { useCloneStamp } from "../hooks/useCloneStamp";

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
    const { onMouseDown, onMouseMove, onMouseUp } = hookResult;

    return (
      <div className="canvas-wrapper">
        <canvas
          ref={ref}
          className="main-canvas"
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
      </div>
    );
  },
);