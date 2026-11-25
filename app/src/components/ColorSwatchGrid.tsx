import { useEffect, useState } from "react";
import { Plus, RotateCcw } from "lucide-react";
import { useUserColors } from "@/hooks/useUserColors";
import { useEditablePalette, MAX_PALETTE_COLORS } from "@/hooks/useEditablePalette";
import { TRANSPARENT, isTransparent } from "@/lib/colors";
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
  /** False when the thing being edited has NO color of this kind right now —
   *  a reselected outline-only shape's Fill Color. No swatch is checked or
   *  lit; `value` is still what the "+" picker opens on. Default true. */
  selected?: boolean;
  /** Grays out every swatch and the "+" button, and stops them being
   *  keyboard-reachable. The CALLER owns the explanation — a disabled control
   *  with no stated reason is the thing this repo's a11y pass keeps finding. */
  disabled?: boolean;
  /** The checkerboard "transparent" swatch, last before the "+" — every grid
   *  shows it (Chris, 11-24-2026: one swatch UI everywhere). It emits
   *  `TRANSPARENT`. Set false where the color is INK and "transparent" would
   *  draw nothing: a stroke, text, a brush, a guide, a redaction. While it is
   *  on, a "transparent" entry in `colors` moves to this slot. */
  transparent?: boolean;
  /** Makes the presets an EDITABLE palette stored under this key
   *  (useEditablePalette): `colors` is what it starts as, every swatch gets a
   *  replace (pencil) and remove (×) badge, the "+" ADDS the picked color to
   *  the palette as well as using it, and Reset brings the defaults back.
   *  Grids sharing a key share the palette. */
  paletteKey?: string;
}

// A replace remembers the swatch's COLOR, not its slot: another tab can
// remove an earlier swatch while the dialog is open, and the slots shift.
type PickerTarget = { kind: "pick" } | { kind: "add" } | { kind: "replace"; color: string };

/**
 * A row of preset swatches + the user's saved palette + the transparent
 * (checkerboard) swatch + a "+" that opens the
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
  selected = true,
  disabled = false,
  transparent = true,
  paletteKey,
}: Props) {
  const { userColors, removeColor } = useUserColors();
  const palette = useEditablePalette(paletteKey ?? "", colors);
  const editable = paletteKey !== undefined;
  const [picker, setPicker] = useState<PickerTarget | null>(null);
  const pickerOpen = picker !== null;

  // Warm the Rust parser once any picker mounts so the dialog's first open
  // (which may need it to read an rgba() value) is snappy.
  useEffect(() => {
    warmColorParser();
  }, []);

  // With the checkerboard swatch on, "transparent" lives in ITS slot (last
  // before the "+"), never among the presets or the saved colors.
  const keep = (c: string) => !transparent || !isTransparent(c);
  const presets = (editable ? palette.colors : colors).filter(keep);
  const saved = allowCustom ? userColors.filter(keep) : [];

  // Every swatch, presets then the user's own then transparent, is ONE radio
  // group: picking a color is exactly one of N (UI_CONSISTENCY §7). One Tab
  // stop, arrows move and pick. The "+" (and Reset) are actions, not colors,
  // so they stay outside the group. A color may appear twice (a preset the
  // user also saved); the FIRST is the one checked, and both still light.
  const shown = [...presets, ...saved, ...(transparent ? [TRANSPARENT] : [])];
  const radioIds = shown.map((c, i) => `${i}:${c}`);
  const firstIndex = selected
    ? shown.findIndex((c) => c === value || (isTransparent(c) && isTransparent(value)))
    : -1;
  const radio = useRadioGroup({
    ids: radioIds,
    selected: firstIndex >= 0 ? radioIds[firstIndex] : undefined,
    isDisabled: () => disabled,
    onSelect: (id) => onChange(shown[radioIds.indexOf(id)]),
  });

  // A preset's index in the STORED palette (presets may have had
  // "transparent" filtered out of it).
  const paletteIndex = (color: string) => palette.colors.indexOf(color);

  const onPick = (color: string) => {
    if (picker?.kind === "replace") {
      const at = paletteIndex(picker.color);
      // Gone meanwhile (removed in another tab): nothing to replace.
      if (at < 0) return;
      palette.replace(at, color);
      // Replacing the lit swatch recolors what it was lighting; replacing
      // another one only edits the palette.
      if (selected && picker.color === value) onChange(color);
      return;
    }
    if (picker?.kind === "add") palette.add(color);
    onChange(color);
  };

  const full = editable && palette.colors.length >= MAX_PALETTE_COLORS;
  const plusLabel = editable ? `Add a color to ${label}` : "Pick a custom color";

  return (
    <>
      <ControlRow label={label}>
        {({ labelId }) => (
          <div className="flex flex-wrap gap-2 py-1">
            {/* `contents`: the group has no box of its own, so the swatches
                and the "+" keep wrapping as ONE row of circles. The role
                survives (checked in Chromium's accessibility tree, Night 3). */}
            <div {...radio.groupProps} aria-labelledby={labelId} className="contents">
              {presets.map((color, i) => (
                <Swatch
                  key={color}
                  color={color}
                  active={selected && value === color}
                  onClick={() => onChange(color)}
                  onEdit={
                    editable ? () => setPicker({ kind: "replace", color }) : undefined
                  }
                  onRemove={
                    editable && presets.length > 1
                      ? () => palette.remove(paletteIndex(color))
                      : undefined
                  }
                  disabled={disabled}
                  radio={radio.itemProps(i)}
                />
              ))}
              {saved.map((color, i) => (
                <Swatch
                  key={`user:${color}`}
                  color={color}
                  active={selected && value === color}
                  onClick={() => onChange(color)}
                  onRemove={() => removeColor(color)}
                  disabled={disabled}
                  radio={radio.itemProps(presets.length + i)}
                />
              ))}
              {transparent && (
                <Swatch
                  key={TRANSPARENT}
                  color={TRANSPARENT}
                  active={selected && isTransparent(value)}
                  onClick={() => onChange(TRANSPARENT)}
                  disabled={disabled}
                  title="Transparent"
                  radio={radio.itemProps(presets.length + saved.length)}
                />
              )}
            </div>
            {allowCustom && (
              <button
                type="button"
                onClick={() => setPicker({ kind: editable ? "add" : "pick" })}
                disabled={disabled || full}
                aria-label={plusLabel}
                title={full ? `The palette holds ${MAX_PALETTE_COLORS} colors` : undefined}
                aria-haspopup="dialog"
                aria-expanded={pickerOpen && picker?.kind !== "replace"}
                className={[
                  "flex items-center justify-center w-7 h-7 rounded-full border-2 transition-all",
                  pickerOpen && picker?.kind !== "replace"
                    ? "border-theme-primary bg-theme-primary/15 text-theme-primary"
                    : "border-dashed border-theme-border bg-theme-muted/20 text-theme-muted-foreground hover:text-theme-foreground hover:border-theme-foreground/50",
                  (disabled || full) && "opacity-40 pointer-events-none",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            )}
            {editable && palette.edited && (
              <button
                type="button"
                onClick={palette.reset}
                disabled={disabled}
                aria-label={`Reset ${label} to the site colors`}
                title="Reset to the site colors"
                className={[
                  "flex items-center justify-center w-7 h-7 rounded-full border-2 border-theme-border bg-theme-muted/20 text-theme-muted-foreground transition-all hover:text-theme-foreground hover:border-theme-foreground/50",
                  disabled && "opacity-40 pointer-events-none",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}
      </ControlRow>

      {(allowCustom || editable) && (
        <ColorPickerDialog
          open={pickerOpen}
          onOpenChange={(open) => {
            if (!open) setPicker(null);
          }}
          initialColor={picker?.kind === "replace" ? picker.color : value}
          onPick={onPick}
          title={
            picker?.kind === "replace"
              ? `Replace a ${label} swatch`
              : picker?.kind === "add"
                ? `Add a ${label} swatch`
                : label === "Color"
                  ? "Pick a color"
                  : `${label} color`
          }
        />
      )}
    </>
  );
}
