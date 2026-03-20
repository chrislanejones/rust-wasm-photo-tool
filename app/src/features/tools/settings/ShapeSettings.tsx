import type { ToolSettings } from "@/lib/types";

const SHAPES = [
  { id: "rect", label: "Rectangle" },
  { id: "circle", label: "Circle" },
  { id: "handCircle", label: "Hand-drawn" },
  { id: "line", label: "Line" },
] as const;

const STROKE_WIDTH_PRESETS = [2, 4, 6, 8] as const;

const COLORS = [
  "#ffffff",
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#000000",
] as const;

type ShapeType = (typeof SHAPES)[number]["id"];

interface ShapesSettingsProps {
  settings: ToolSettings;
  onChange: (s: ToolSettings) => void;
}

function ShapeIcon({ type }: { type: ShapeType }) {
  switch (type) {
    case "rect":
      return (
        <span className="inline-block w-3.5 h-3.5 border-2 border-current rounded-sm" />
      );
    case "circle":
      return (
        <span className="inline-block w-3.5 h-3.5 border-2 border-current rounded-full" />
      );
    case "handCircle":
      return (
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4 12c0-4.4 3.6-8 8-8 1.5 0 2.9.4 4.1 1.1M20 12c0 4.4-3.6 8-8 8-1.5 0-2.9-.4-4.1-1.1M4 12c0 2.1.9 4 2.3 5.3M20 12c0-2.1-.9-4-2.3-5.3" />
        </svg>
      );
    case "line":
      return (
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <line x1="4" y1="20" x2="20" y2="4" />
        </svg>
      );
  }
}

export function ShapesSettings({ settings, onChange }: ShapesSettingsProps) {
  const currentShape = settings.shape ?? "rect";

  return (
    <div className="space-y-5">
      <h3 className="text-xs font-bold uppercase tracking-widest text-text-muted font-mono">
        Shapes
      </h3>

      {/* Shape Selector */}
      <div className="space-y-2.5">
        <label className="text-xs font-bold uppercase tracking-widest text-theme-muted-foreground">
          Shape
        </label>
        <div className="grid grid-cols-2 gap-2">
          {SHAPES.map((shape) => {
            const active = currentShape === shape.id;
            return (
              <button
                key={shape.id}
                onClick={() => onChange({ ...settings, shape: shape.id })}
                className={[
                  "flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold font-mono transition-all",
                  active
                    ? "bg-accent text-text-primary ring-2 ring-accent/50 shadow-md"
                    : "bg-bg-elevated border border-border text-text-secondary hover:border-border-active hover:text-text-primary",
                ].join(" ")}
              >
                <ShapeIcon type={shape.id} />
                <span>{shape.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Stroke Width */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold uppercase tracking-widest text-theme-muted-foreground">
            Stroke Width
          </label>
          <span className="text-xs text-theme-foreground tabular-nums">
            {settings.strokeWidth}px
          </span>
        </div>
        <div className="flex items-center justify-between">
          {STROKE_WIDTH_PRESETS.map((width) => {
            const active = settings.strokeWidth === width;
            return (
              <button
                key={width}
                onClick={() => onChange({ ...settings, strokeWidth: width })}
                className={[
                  "flex items-center justify-center w-10 h-10 rounded-full transition-all",
                  active
                    ? "ring-2 ring-theme-ring ring-offset-2 ring-offset-theme-sidebar"
                    : "hover:bg-theme-accent",
                ].join(" ")}
                aria-label={`Stroke width ${width}`}
              >
                <span
                  className="rounded-full bg-theme-foreground"
                  style={{ width: width * 2, height: width * 2 }}
                />
              </button>
            );
          })}
        </div>
        <div className="relative h-2 w-full rounded-full bg-theme-muted">
          <div
            className="absolute h-full rounded-full bg-gradient-to-r from-theme-primary to-theme-chart4"
            style={{ width: `${((settings.strokeWidth - 1) / 9) * 100}%` }}
          />
          <input
            type="range"
            min={1}
            max={10}
            step={1}
            value={settings.strokeWidth}
            onChange={(e) =>
              onChange({ ...settings, strokeWidth: Number(e.target.value) })
            }
            className="slider-input absolute inset-0 h-full w-full cursor-pointer appearance-none bg-transparent"
          />
        </div>
      </div>

      {/* Color */}
      <div className="space-y-2.5">
        <label className="text-xs font-bold uppercase tracking-widest text-theme-muted-foreground">
          Color
        </label>
        <div className="flex flex-wrap gap-2 py-2">
          {COLORS.map((color) => (
            <button
              key={color}
              onClick={() => onChange({ ...settings, strokeColor: color })}
              className={[
                "w-7 h-7 rounded-full border-2 transition-all",
                settings.strokeColor === color
                  ? "border-accent scale-110 ring-2 ring-accent/30"
                  : "border-transparent hover:scale-105",
              ].join(" ")}
              style={{ backgroundColor: color }}
              aria-label={`Color ${color}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
