import type { ReactNode } from "react";

// Presets divide the slider into equal segments so the thumb lines up under each circle.
// e.g. 4 presets → segments at 0%, 33%, 67%, 100% matching justify-between circle positions.
function valueToPos(val: number, presets: readonly number[]): number {
  const n = presets.length;
  if (val <= presets[0]) return 0;
  if (val >= presets[n - 1]) return 100;
  for (let i = 0; i < n - 1; i++) {
    if (val <= presets[i + 1]) {
      const segStart = (i / (n - 1)) * 100;
      const segEnd = ((i + 1) / (n - 1)) * 100;
      const t = (val - presets[i]) / (presets[i + 1] - presets[i]);
      return segStart + t * (segEnd - segStart);
    }
  }
  return 100;
}

function posToValue(pos: number, presets: readonly number[]): number {
  const n = presets.length;
  const segSize = 100 / (n - 1);
  if (pos <= 0) return presets[0];
  if (pos >= 100) return presets[n - 1];
  const segIdx = Math.min(Math.floor(pos / segSize), n - 2);
  const t = (pos - segIdx * segSize) / segSize;
  return Math.round(presets[segIdx] + t * (presets[segIdx + 1] - presets[segIdx]));
}

interface SizeSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  presets: readonly number[];
  unit?: string;
  variant?: "dots" | "numbers";
  blurredDots?: boolean;
  renderPreset?: (preset: number, index: number, isActive: boolean) => ReactNode;
}

export function SizeSlider({
  label,
  value,
  min: _min,
  max: _max,
  onChange,
  presets,
  unit = "px",
  variant = "dots",
  blurredDots = false,
  renderPreset,
}: SizeSliderProps) {
  const sliderPos = valueToPos(value, presets);

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold uppercase tracking-widest text-theme-muted-foreground">
          {label}
        </label>
        <span className="text-xs text-theme-foreground tabular-nums">
          {value}{unit}
        </span>
      </div>

      {/* Preset circles — top section, evenly spaced */}
      <div className="flex items-center justify-between">
        {presets.map((preset, i) => {
          const isActive = value === preset;
          return (
            <button
              key={preset}
              type="button"
              onClick={() => onChange(preset)}
              className={[
                "flex items-center justify-center w-10 h-10 rounded-full transition-all",
                isActive
                  ? "ring-2 ring-theme-ring ring-offset-2 ring-offset-theme-sidebar"
                  : "hover:bg-theme-accent",
              ].join(" ")}
              aria-label={`${label} ${preset}${unit}`}
            >
              {renderPreset ? (
                renderPreset(preset, i, isActive)
              ) : variant === "numbers" ? (
                <span className="text-xs font-mono text-theme-foreground">{preset}</span>
              ) : (
                <span
                  className="rounded-full bg-theme-foreground"
                  style={{
                    width: 4 + i * 2,
                    height: 4 + i * 2,
                    ...(blurredDots ? { opacity: 0.5, filter: "blur(1.5px)" } : {}),
                  }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Slider — separate row below with more breathing room.
          Thumb aligns with circles because sliderPos uses the same equal-segment scale. */}
      <div className="relative h-2 w-full rounded-full bg-theme-muted mt-5">
        <div
          className="absolute h-full rounded-full bg-gradient-to-r from-theme-primary to-theme-chart4"
          style={{ width: `${sliderPos}%` }}
        />
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={Math.round(sliderPos)}
          onChange={(e) => onChange(posToValue(Number(e.target.value), presets))}
          className="slider-input absolute inset-0 h-full w-full cursor-pointer appearance-none bg-transparent"
        />
      </div>
    </div>
  );
}
