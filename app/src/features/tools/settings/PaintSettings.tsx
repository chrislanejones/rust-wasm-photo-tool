// ===== FILE: app/src/features/tools/settings/PaintSettings.tsx =====
import type { ToolSettings } from "@/lib/types";
import { PAINT_COLORS as COLORS } from "@/lib/colors";

const BRUSH_SIZE_PRESETS = [4, 8, 16, 32] as const;

interface PaintSettingsProps {
  settings: ToolSettings;
  onChange: (s: ToolSettings) => void;
}

export function PaintSettings({ settings, onChange }: PaintSettingsProps) {
  return (
    <div className="space-y-8">
      <h3 className="text-xs font-bold uppercase tracking-widest text-text-muted font-mono">
        Paint / Brush
      </h3>

      {/* ── Brush Size ── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold uppercase tracking-widest text-theme-muted-foreground">
            Brush Size
          </label>
          <span className="text-xs text-theme-foreground tabular-nums">
            {settings.brushSize}px
          </span>
        </div>

        <div className="flex items-center justify-between">
          {BRUSH_SIZE_PRESETS.map((size) => {
            const active = settings.brushSize === size;
            return (
              <button
                key={size}
                onClick={() => onChange({ ...settings, brushSize: size })}
                className={[
                  "flex items-center justify-center w-10 h-10 rounded-full transition-all",
                  active
                    ? "ring-2 ring-theme-ring ring-offset-2 ring-offset-theme-sidebar"
                    : "hover:bg-theme-accent",
                ].join(" ")}
                aria-label={`Brush size ${size}`}
              >
                <span
                  className="rounded-full bg-theme-foreground"
                  style={{ width: size / 2, height: size / 2 }}
                />
              </button>
            );
          })}
        </div>

        <div className="relative h-2 w-full rounded-full bg-theme-muted">
          <div
            className="absolute h-full rounded-full bg-gradient-to-r from-theme-primary to-theme-chart4"
            style={{ width: `${((settings.brushSize - 1) / 49) * 100}%` }}
          />
          <input
            type="range"
            min={1}
            max={50}
            step={1}
            value={settings.brushSize}
            onChange={(e) =>
              onChange({ ...settings, brushSize: Number(e.target.value) })
            }
            className="slider-input absolute inset-0 h-full w-full cursor-pointer appearance-none bg-transparent"
          />
        </div>
      </div>

      {/* ── Opacity ── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold uppercase tracking-widest text-theme-muted-foreground">
            Opacity
          </label>
          <span className="text-xs text-theme-foreground tabular-nums">
            {settings.brushOpacity}%
          </span>
        </div>

        <div className="relative h-2 w-full rounded-full bg-theme-muted">
          <div
            className="absolute h-full rounded-full bg-gradient-to-r from-theme-primary to-theme-chart4"
            style={{ width: `${((settings.brushOpacity - 10) / 90) * 100}%` }}
          />
          <input
            type="range"
            min={10}
            max={100}
            step={1}
            value={settings.brushOpacity}
            onChange={(e) =>
              onChange({ ...settings, brushOpacity: Number(e.target.value) })
            }
            className="slider-input absolute inset-0 h-full w-full cursor-pointer appearance-none bg-transparent"
          />
        </div>
      </div>

      {/* ── Color ── */}
      <div className="space-y-4">
        <label className="text-xs font-bold uppercase tracking-widest text-theme-muted-foreground">
          Color
        </label>
        <div className="grid grid-cols-5 gap-2 py-2">
          {COLORS.map((color) => {
            const active = settings.brushColor === color;
            return (
              <button
                key={color}
                onClick={() => onChange({ ...settings, brushColor: color })}
                className={[
                  "w-8 h-8 rounded-lg transition-transform hover:scale-110",
                  active
                    ? "ring-2 ring-theme-ring ring-offset-2 ring-offset-theme-sidebar"
                    : "",
                ].join(" ")}
                style={{ backgroundColor: color }}
                aria-label={`Brush color ${color}`}
              />
            );
          })}
        </div>
      </div>

      <p className="text-[10px] text-theme-muted-foreground leading-relaxed">
        Click and drag to paint. Rendering runs in WASM for smooth strokes.
      </p>
    </div>
  );
}
