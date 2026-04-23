import { useEffect, useRef } from "react";
import type { MagnifierState } from "@/hooks/useColorPicker";

const CELL = 12; // px per magnified pixel cell
const RADIUS = 5;
const SIDE = 2 * RADIUS + 1; // 11
const SIZE = SIDE * CELL; // 132

interface Props {
  magnifier: MagnifierState;
}

export function MagnifierOverlay({ magnifier }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || magnifier.pixels.length === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, SIZE, SIZE);
    for (let row = 0; row < SIDE; row++) {
      for (let col = 0; col < SIDE; col++) {
        const idx = (row * SIDE + col) * 4;
        const r = magnifier.pixels[idx] ?? 0;
        const g = magnifier.pixels[idx + 1] ?? 0;
        const b = magnifier.pixels[idx + 2] ?? 0;
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect(col * CELL, row * CELL, CELL, CELL);
      }
    }
    // Crosshair on center cell
    const cx = Math.floor(SIDE / 2) * CELL;
    const cy = Math.floor(SIDE / 2) * CELL;
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(cx + 0.75, cy + 0.75, CELL - 1.5, CELL - 1.5);
    ctx.strokeStyle = "rgba(0,0,0,0.6)";
    ctx.lineWidth = 0.75;
    ctx.strokeRect(cx + 1.5, cy + 1.5, CELL - 3, CELL - 3);
  }, [magnifier.pixels]);

  if (!magnifier.visible) return null;

  const offsetX = 20;
  const offsetY = -SIZE / 2;

  return (
    <div
      className="pointer-events-none absolute z-50 rounded-xl overflow-hidden shadow-2xl border border-white/20"
      style={{
        left: magnifier.screenX + offsetX,
        top: magnifier.screenY + offsetY,
        width: SIZE,
      }}
    >
      <canvas ref={canvasRef} width={SIZE} height={SIZE} />
      <div className="bg-black/80 px-2 py-1 text-center font-mono text-[10px] text-white tracking-widest">
        {magnifier.centerColor.toUpperCase()}
      </div>
    </div>
  );
}
