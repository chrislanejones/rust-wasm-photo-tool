import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { useUserColors } from "@/hooks/useUserColors";
import { warmColorParser } from "@/lib/colorParser";
import { ColorPickerDialog } from "@/components/ColorPickerDialog";
import { Swatch } from "@/components/ui/swatch";
import { ControlRow } from "@/components/ui/control-row";
import { useRadioGroup } from "@/components/ui/use-radio-group";

interface Props {
  colors: readonly string[];
  value: string;
  onChange: (color: string) => void;
  label?: string;
  /**
   * Set to false to hide the "+" custom-color button and the user-added
   * swatches. Defaults to true so all pickers share the global user palette.
   */
  allowCustom?: boolean;
  /** Grays out every swatch and the "+" button, and stops them being
   *  keyboard-reachable. The CALLER owns the explanation — a disabled control
   *  with no stated reason is the thing this repo's a11y pass keeps finding. */
  disabled?: boolean;
}

/**
 * A row of preset swatches + the user's saved palette + a "+" that opens the
 * ColorPickerDialog (wheel / square, RGBA / HSL / hex fields). "Use color" in
 * the dialog applies to THIS control; the dialog's own palette "+" saves to the
 * global list every grid shows (localStorage signed out, Convex signed in).
 */
export function ColorSwatchGrid({
  colors,
  value,
  onChange,
  label = "Color",
  allowCustom = true,
  disabled = false,
}: Props) {
  const { userColors, removeColor } = useUserColors();
  const [pickerOpen, setPickerOpen] = useState(false);

  // Warm the Rust parser once any picker mounts so the dialog's first open
  // (which may need it to read an rgba() value) is snappy.
  useEffect(() => {
    warmColorParser();
  }, []);

  // Every swatch, presets then the user's own, is ONE radio group: picking a
  // color is exactly one of N (UI_CONSISTENCY §7). One Tab stop, arrows move
  // and pick. The "+" is an action, not a color, so it stays outside the
  // group. A color may appear twice (a preset the user also saved); the
  // FIRST is the one checked, and both still light, as before.
  const shown = allowCustom ? [...colors, ...userColors] : [...colors];
  const radioIds = shown.map((c, i) => `${i}:${c}`);
  const firstIndex = shown.indexOf(value);
  const radio = useRadioGroup({
    ids: radioIds,
    selected: firstIndex >= 0 ? radioIds[firstIndex] : undefined,
    isDisabled: () => disabled,
    onSelect: (id) => onChange(shown[radioIds.indexOf(id)]),
  });

  return (
    <>
      <ControlRow label={label}>
        {({ labelId }) => (
          <div className="flex flex-wrap gap-2 py-1">
            {/* `contents`: the group has no box of its own, so the swatches
                and the "+" keep wrapping as ONE row of circles. The role
                survives (checked in Chromium's accessibility tree, Night 3). */}
            <div {...radio.groupProps} aria-labelledby={labelId} className="contents">
              {colors.map((color, i) => (
                <Swatch
                  key={color}
                  color={color}
                  active={value === color}
                  onClick={() => onChange(color)}
                  disabled={disabled}
                  radio={radio.itemProps(i)}
                />
              ))}
              {allowCustom &&
                userColors.map((color, i) => (
                  <Swatch
                    key={`user:${color}`}
                    color={color}
                    active={value === color}
                    onClick={() => onChange(color)}
                    onRemove={() => removeColor(color)}
                    disabled={disabled}
                    radio={radio.itemProps(colors.length + i)}
                  />
                ))}
            </div>
            {allowCustom && (
              <button
                type="button"
                onClick={() => setPickerOpen(true)}
                disabled={disabled}
                aria-label="Pick a custom color"
                aria-haspopup="dialog"
                aria-expanded={pickerOpen}
                className={[
                  "flex items-center justify-center w-7 h-7 rounded-full border-2 transition-all",
                  pickerOpen
                    ? "border-theme-primary bg-theme-primary/15 text-theme-primary"
                    : "border-dashed border-theme-border bg-theme-muted/20 text-theme-muted-foreground hover:text-theme-foreground hover:border-theme-foreground/50",
                  disabled && "opacity-40 pointer-events-none",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}
      </ControlRow>

      {allowCustom && (
        <ColorPickerDialog
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          initialColor={value}
          onPick={onChange}
          title={label === "Color" ? "Pick a color" : `${label} color`}
        />
      )}
    </>
  );
}
