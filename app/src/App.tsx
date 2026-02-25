// app/src/App.tsx
import { useRef, useState } from "react";
import { useCloneStamp } from "./hooks/useCloneStamp";
import { useBrushPreview } from "./hooks/useBrushPreview";
import { Toolbar } from "./components/Toolbar";
import { HistoryPanel } from "./components/HistoryPanel";
import { CanvasArea } from "./components/CanvasArea";
import { StatusBar } from "./components/StatusBar";

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stamp = useCloneStamp(canvasRef);
  const [brushSize, setBrushSizeLocal] = useState(20);
  const [hardness, setHardnessLocal] = useState(0.8);
  const [opacity, setOpacityLocal] = useState(1.0);

  const { pos, visible, diameter, onCanvasEnter, onCanvasLeave } =
    useBrushPreview(brushSize, stamp.state.zoom, canvasRef);

  const handleBrushSize = (v: number) => {
    setBrushSizeLocal(v);
    stamp.setBrushSize(v);
  };
  const handleHardness = (v: number) => {
    setHardnessLocal(v);
    stamp.setHardness(v);
  };
  const handleOpacity = (v: number) => {
    setOpacityLocal(v);
    stamp.setOpacity(v);
  };

  return (
    <div className="app-layout">
      <Toolbar
        state={stamp.state}
        brushSize={brushSize}
        hardness={hardness}
        opacity={opacity}
        onFileChange={stamp.loadImage}
        onBrushSizeChange={handleBrushSize}
        onHardnessChange={handleHardness}
        onOpacityChange={handleOpacity}
        onUndo={stamp.undo}
        onRedo={stamp.redo}
        onExport={stamp.exportPng}
      />
      <div className="main-area">
        <CanvasArea
          ref={canvasRef}
          hookResult={stamp}
          brushDiameter={diameter}
          cursorPos={pos}
          cursorVisible={visible}
          onCanvasEnter={onCanvasEnter}
          onCanvasLeave={onCanvasLeave}
        />
        <HistoryPanel
          history={stamp.state.history}
          onJump={stamp.jumpToHistory}
          onDelete={stamp.deleteHistoryEntry}
          onClear={stamp.clearHistory}
        />
      </div>
      <StatusBar state={stamp.state} />
    </div>
  );
}