// The row of quick values above a slider — Brush Size's four dots, Opacity's
// 25 / 50 / 75 / 100. ONE component for every preset row in the app; it used
// to be inlined in SizeSlider as four raw buttons.
//
// A SELECT, so a radio group (UI_CONSISTENCY §7). Picking a preset is exactly
// one of N, and the ring on the matching one is a checked state that was
// never announced: a screen reader heard four unrelated "Opacity 25, button"s
// and no way to tell which was current. Now it is one Tab stop, arrows move
// and pick, and the matching preset is `aria-checked`. When the value sits
// between presets nothing is checked, and the first preset is the Tab stop
// (use-radio-group.ts).
import * as React from "react";
import { useRadioGroup } from "@/components/ui/use-radio-group";
import { cn } from "@/lib/utils";

export interface PresetRowProps {
  /** The control's name: the group is "<label> presets", each option
   *  "<label> <preset><unit>". */
  label: string;
  presets: readonly number[];
  value: number;
  onChange: (v: number) => void;
  unit?: string;
  /** `dots` draws growing dots (sizes); `numbers` prints the value. */
  variant?: "dots" | "numbers";
  /** Soft, half-opacity dots — the blur brush's footprint. */
  blurredDots?: boolean;
  /** Draw your own glyph per preset (Shapes, Stamps). */
  renderPreset?: (preset: number, index: number, isActive: boolean) => React.ReactNode;
  disabled?: boolean;
  "aria-describedby"?: string;
}

export function PresetRow({
  label,
  presets,
  value,
  onChange,
  unit = "",
  variant = "dots",
  blurredDots = false,
  renderPreset,
  disabled = false,
  "aria-describedby": describedBy,
}: PresetRowProps) {
  const ids = presets.map(String);
  const radio = useRadioGroup({
    ids,
    selected: presets.includes(value) ? String(value) : undefined,
    isDisabled: () => disabled,
    onSelect: (id) => onChange(Number(id)),
  });
  return (
    // Compact "dots above the track" row — tight 28px targets so it sits
    // close to a plain slider's height.
    <div
      {...radio.groupProps}
      aria-label={`${label} presets`}
      aria-describedby={describedBy}
      className="flex items-center justify-between px-1"
    >
      {presets.map((preset, i) => {
        const isActive = value === preset;
        return (
          <button
            key={preset}
            type="button"
            {...radio.itemProps(i)}
            onClick={() => onChange(preset)}
            disabled={disabled}
            aria-label={`${label} ${preset}${unit}`}
            className={cn(
              "flex size-7 items-center justify-center rounded-full transition-all",
              "disabled:pointer-events-none disabled:opacity-40",
              isActive
                ? "ring-2 ring-theme-ring ring-offset-1 ring-offset-theme-sidebar"
                : "hover:bg-theme-muted",
            )}
          >
            {renderPreset ? (
              renderPreset(preset, i, isActive)
            ) : variant === "numbers" ? (
              <span className="font-mono text-xs text-theme-foreground">{preset}</span>
            ) : (
              <span
                className="rounded-full bg-theme-foreground"
                // Computed per index (4, 6, 8, 10px), so a style and not a
                // class: four arbitrary-value utilities would be the drift.
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
  );
}
