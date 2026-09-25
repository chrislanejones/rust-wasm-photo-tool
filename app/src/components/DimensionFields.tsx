import { Lock, Unlock } from "lucide-react";
import { SizeSlider } from "@/components/SizeSlider";
import { NumberField } from "@/components/ui/number-field";

interface Props {
  /** Width / height as strings (controlled — lets the field hold transient input). */
  width: string;
  height: string;
  /** Scale slider value (percent of the original width). */
  widthPercent: number;
  lockAspect: boolean;
  disabled?: boolean;
  onWidthChange: (v: string) => void;
  onHeightChange: (v: string) => void;
  onPercentChange: (pct: number) => void;
  onToggleLock: () => void;
}

/**
 * Shared resize controls — the Scale slider + Width/Height inputs + aspect-lock
 * toggle. Extracted from the Resize tool so the Resize panel and the Layer
 * Settings → Canvas Size resizer render the exact same UI. Presentational only;
 * the owner holds the dimension state and does the (Rust) resample on apply.
 */
export function DimensionFields({
  width,
  height,
  widthPercent,
  lockAspect,
  disabled,
  onWidthChange,
  onHeightChange,
  onPercentChange,
  onToggleLock,
}: Props) {

  return (
    <div className="space-y-2.5">
      {/* space-y-2.5, not 4: the slider box carries ~7px of thumb room below
          the visible track, so 10px here lands the visual gap to width/height
          at ~17 — the same distance the Method dropdown sits from Quality. */}
      {/* Scale slider — proportional percent of the original dimensions. */}
      <SizeSlider
        label="Scale"
        value={widthPercent}
        onChange={onPercentChange}
        min={1}
        max={100}
        unit="%"
        disabled={disabled}
      />

      {/* Dimensions: width / height / lock-aspect on one row.
          The boxes are the shared NumberField, which owns the real
          <label htmlFor> this component used to spell out itself. */}
      <div className="flex items-end gap-2">
        <NumberField
          label="width"
          value={width}
          onChange={(e) => onWidthChange(e.target.value)}
          min={1}
          disabled={disabled}
        />
        <NumberField
          label="height"
          value={height}
          onChange={(e) => onHeightChange(e.target.value)}
          min={1}
          disabled={disabled}
        />
        <button
          onClick={onToggleLock}
          title={lockAspect ? "Unlock aspect ratio" : "Lock aspect ratio"}
          aria-pressed={lockAspect}
          disabled={disabled}
          className={`flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-lg border transition-colors ${
            lockAspect
              ? "bg-theme-primary text-theme-primary-foreground border-theme-primary"
              : "bg-theme-muted/20 hover:bg-theme-muted/30 text-theme-muted-foreground border-theme-border"
          }`}
        >
          {lockAspect ? (
            <Lock className="h-4 w-4" />
          ) : (
            <Unlock className="h-4 w-4" />
          )}
        </button>
      </div>
    </div>
  );
}
