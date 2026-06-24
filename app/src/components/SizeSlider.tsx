import type { ReactNode } from "react";

// Presets divide the slider into equal segments so the thumb lines up under each dot.
// e.g. 4 presets → segments at 0%, 33%, 67%, 100%.
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

interface CommonProps {
  label: string;
  value: number;
  onChange: (v: number) => void;
  unit?: string;
  valueDisplay?: string;
  disabled?: boolean;
  onCommit?: (v: number) => void;
}

interface PlainSliderProps extends CommonProps {
  variant?: "slider";
  min: number;
  max: number;
  step?: number;
  presets?: undefined;
}

interface DotsSliderProps extends CommonProps {
  variant?: "dots" | "numbers";
  presets: readonly number[];
  min?: number;
  max?: number;
  blurredDots?: boolean;
  renderPreset?: (preset: number, index: number, isActive: boolean) => ReactNode;
}

type SizeSliderProps = PlainSliderProps | DotsSliderProps;

export function SizeSlider(props: SizeSliderProps) {
  const { label, value, onChange, unit = "", valueDisplay, disabled, onCommit } = props;
  const display = valueDisplay ?? `${value}${unit}`;

  const labelRow = (
    <div className="flex items-center justify-between text-2xs">
      <span className="text-theme-muted-foreground">{label}</span>
      <span className="text-theme-foreground tabular-nums">{display}</span>
    </div>
  );

  const onPointerUp = onCommit
    ? (e: React.PointerEvent<HTMLInputElement>) =>
        onCommit(Number((e.target as HTMLInputElement).value))
    : undefined;

  if (props.presets) {
    const { presets, blurredDots, renderPreset, variant = "dots" } = props;
    const sliderPos = valueToPos(value, presets);
    return (
      <div className="space-y-1.5">
        {labelRow}
        {/* Compact "dots above the track" preset row — tight click targets so
            this variant sits close to the plain slider's height. */}
        <div className="flex items-center justify-between px-1">
          {presets.map((preset, i) => {
            const isActive = value === preset;
            return (
              <button
                key={preset}
                type="button"
                onClick={() => onChange(preset)}
                disabled={disabled}
                className={[
                  "flex items-center justify-center w-7 h-7 rounded-full transition-all",
                  isActive
                    ? "ring-2 ring-theme-ring ring-offset-1 ring-offset-theme-sidebar"
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
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={Math.round(sliderPos)}
          disabled={disabled}
          onChange={(e) => onChange(posToValue(Number(e.target.value), presets))}
          onPointerUp={onPointerUp}
          className="w-full"
        />
      </div>
    );
  }

  const { min, max, step = 1 } = props as PlainSliderProps;
  return (
    <div className="space-y-1.5">
      {labelRow}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        onPointerUp={onPointerUp}
        className="w-full"
      />
    </div>
  );
}
