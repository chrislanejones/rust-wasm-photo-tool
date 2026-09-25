// The canonical slider row: a `ControlRow` (label left, value right) around an
// optional `PresetRow` and a range input.
//
// Lived in `components/` until Night 3 with 14 importers — ranked by
// importers it would have been the fifth primitive in `ui/`, so the folder
// was lying about what a primitive is (UI_INVENTORY Finding 5).
//
// WHAT THE RANGE ANNOUNCES. With presets, the input's own value is a TRACK
// POSITION (0–100, each preset an equal segment), not the setting: a Brush
// Size of 20 sits at position 67. A screen reader read "67". `aria-valuetext`
// now carries the same text the value slot shows, so what is heard is what
// is seen.
import type { ReactNode } from "react";
import { ControlRow } from "@/components/ui/control-row";
import { PresetRow } from "@/components/ui/preset-row";

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
  /** Renders a lightbulb info tooltip immediately after the label text (not
   *  pushed to the far right, since that side already shows the live value). */
  labelInfo?: ReactNode;
  value: number;
  onChange: (v: number) => void;
  unit?: string;
  valueDisplay?: string;
  disabled?: boolean;
  /** Why the slider is disabled — visible under it, and its description.
   *  Pass it only while `disabled` is true. */
  reason?: ReactNode;
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
  const { label, labelInfo, value, onChange, unit = "", valueDisplay, disabled, reason, onCommit } = props;
  const display = valueDisplay ?? `${value}${unit}`;

  const onPointerUp = onCommit
    ? (e: React.PointerEvent<HTMLInputElement>) =>
        onCommit(Number((e.target as HTMLInputElement).value))
    : undefined;

  return (
    <ControlRow label={label} info={labelInfo} value={display} reason={reason}>
      {({ reasonId }) => {
        if (props.presets) {
          const { presets, blurredDots, renderPreset, variant = "dots" } = props;
          return (
            <div className="space-y-1.5">
              <PresetRow
                label={label}
                presets={presets}
                value={value}
                onChange={onChange}
                unit={unit}
                variant={variant === "numbers" ? "numbers" : "dots"}
                blurredDots={blurredDots}
                renderPreset={renderPreset}
                disabled={disabled}
                aria-describedby={reasonId}
              />
              <input
                type="range"
                aria-label={label}
                aria-valuetext={display}
                aria-describedby={reasonId}
                min={0}
                max={100}
                step={1}
                value={Math.round(valueToPos(value, presets))}
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
          <input
            type="range"
            aria-label={label}
            aria-valuetext={display}
            aria-describedby={reasonId}
            min={min}
            max={max}
            step={step}
            value={value}
            disabled={disabled}
            onChange={(e) => onChange(Number(e.target.value))}
            onPointerUp={onPointerUp}
            className="w-full"
          />
        );
      }}
    </ControlRow>
  );
}
