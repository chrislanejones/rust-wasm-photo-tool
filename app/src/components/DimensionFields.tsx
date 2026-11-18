import { Lock, Unlock } from "lucide-react";
import { SizeSlider } from "@/components/ui/size-slider";
import type { ControlRowProps } from "@/components/ui/control-row";
import { NumberField } from "@/components/ui/number-field";

const SCALE_PRESETS = [10, 25, 50, 75, 100] as const;

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
  /** The edited dot + reset, on the Scale row (ControlRow §9): W/H are
   *  per-photo values, and Scale is the row that reads them as one number. */
  edited?: { isEdited: boolean; onReset: () => void; disabled?: boolean };
  /** A one-click icon on the Scale row, between its reset and its value. */
  scaleAction?: ControlRowProps["action"];
  /** Put the Scale slider under width/height instead of above them. */
  scaleLast?: boolean;
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
  edited,
  scaleAction,
  scaleLast = false,
}: Props) {

  // Scale — proportional percent of the original dimensions.
  const scaleSlider = (
    <SizeSlider
        label="Scale"
        value={widthPercent}
        onChange={onPercentChange}
        // The numbers variant, like Resize › Quality (11-18). The circles print
        // bare numbers; the value and each preset's name carry the "%". The
        // track runs 10–100%; a smaller size is still typed in width/height.
        presets={SCALE_PRESETS}
        variant="numbers"
        min={10}
        max={100}
        unit="%"
        disabled={disabled}
        edited={edited}
        action={scaleAction}
      />
  );

  return (
    <div className="space-y-2.5">
      {/* space-y-2.5, not 4: the slider box carries ~7px of thumb room below
          the visible track, so 10px here lands the visual gap to width/height
          at ~17 — the same distance the Method dropdown sits from Quality. */}
      {!scaleLast && scaleSlider}
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
          // A STABLE name, with aria-pressed carrying on/off (Night 2's toggle
          // rule). The only name used to be this flipping title, so a screen
          // reader heard "Unlock aspect ratio, pressed" — which contradicts
          // itself. The title still flips, for the hover hint.
          aria-label="Lock aspect ratio"
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
      {scaleLast && scaleSlider}
    </div>
  );
}
