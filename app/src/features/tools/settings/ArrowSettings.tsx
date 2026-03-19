// ===== FILE: app/src/features/tools/settings/ArrowSettings.tsx =====
import type { ToolSettings } from "@/lib/types";

const COLORS = [
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#14b8a6",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#000000",
] as const;

const STROKE_WIDTH_PRESETS = [2, 4, 6, 8] as const;

interface ArrowSettingsProps {
  settings: ToolSettings;
  onChange: (s: ToolSettings) => void;
}

export function ArrowSettings({ settings, onChange }: ArrowSettingsProps) {
  return (
    <div className="space-y-5">
      <h3 className="text-xs font-bold uppercase tracking-widest text-text-muted font-mono">
        Arrow &amp; Pointer
      </h3>

      {/* ── Stroke Width ── */}
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
                  style={{ width: width, height: width }}
                />
              </button>
            );
          })}
        </div>

        <div className="relative h-2 w-full rounded-full bg-theme-muted">
          <div
            className="absolute h-full rounded-full bg-linear-to-r from-theme-primary to-theme-chart4"
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

      {/* ── Arrow Style ── */}
      <div className="space-y-3">
        <label className="text-xs font-bold uppercase tracking-widest text-theme-muted-foreground">
          Arrow Style
        </label>
        <div className="grid grid-cols-2 gap-2">
          {(["single", "double"] as const).map((style) => {
            const active = settings.arrowStyle === style;
            return (
              <button
                key={style}
                onClick={() => onChange({ ...settings, arrowStyle: style })}
                className={[
                  "flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-medium transition-all",
                  active
                    ? "bg-accent text-text-primary ring-2 ring-accent/50 shadow-md"
                    : "bg-bg-elevated text-text-secondary hover:ring-2 hover:ring-accent/30",
                ].join(" ")}
              >
                {style === "single" ? "→ Single" : "↔ Double"}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Color ── */}
      <div className="space-y-3">
        <label className="text-xs font-bold uppercase tracking-widest text-theme-muted-foreground">
          Color
        </label>
        <div className="grid grid-cols-5 gap-2">
          {COLORS.map((color) => {
            const active = settings.strokeColor === color;
            return (
              <button
                key={color}
                onClick={() => onChange({ ...settings, strokeColor: color })}
                className={[
                  "w-8 h-8 rounded-lg transition-transform hover:scale-110",
                  active
                    ? "ring-2 ring-theme-ring ring-offset-2 ring-offset-theme-sidebar"
                    : "",
                ].join(" ")}
                style={{ backgroundColor: color }}
                aria-label={`Arrow color ${color}`}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
