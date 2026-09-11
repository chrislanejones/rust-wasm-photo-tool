import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import { useUserColors } from "@/hooks/useUserColors";
import { warmColorParser } from "@/lib/colorParser";
import { ColorPickerDialog } from "@/components/ColorPickerDialog";

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
  /** Greys out every swatch and the "+" button, and stops them being
   *  keyboard-reachable. The CALLER owns the explanation — a disabled control
   *  with no stated reason is the thing this repo's a11y pass keeps finding. */
  disabled?: boolean;
}

/**
 * A row of preset swatches + the user's saved palette + a "+" that opens the
 * ColorPickerDialog (wheel / square, RGBA / HSL / hex fields). "Use colour" in
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

  return (
    <div className="space-y-2">
      <label className="text-2xs text-theme-muted-foreground">{label}</label>
      <div className="flex flex-wrap gap-2 py-1">
        {colors.map((color) => (
          <Swatch
            key={color}
            color={color}
            active={value === color}
            onClick={() => onChange(color)}
            disabled={disabled}
          />
        ))}
        {allowCustom &&
          userColors.map((color) => (
            <Swatch
              key={`user:${color}`}
              color={color}
              active={value === color}
              onClick={() => onChange(color)}
              onRemove={() => removeColor(color)}
              disabled={disabled}
            />
          ))}
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

      {allowCustom && (
        <ColorPickerDialog
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          initialColor={value}
          onPick={onChange}
          title={label === "Color" ? "Pick a colour" : `${label} colour`}
        />
      )}
    </div>
  );
}

interface SwatchProps {
  color: string;
  active: boolean;
  onClick: () => void;
  onRemove?: () => void;
  disabled?: boolean;
}

function Swatch({ color, active, onClick, onRemove, disabled }: SwatchProps) {
  // The "transparent" entry is the transparent backing canvas: render the same
  // transparency checkerboard the canvas itself shows (`.checkerboard-canvas`,
  // styles.css — also used by CanvasArea) instead of a flat panel-coloured
  // square, so the swatch reads as "no fill / checkerboard". Solid colours keep
  // their flat fill.
  const isTransparent = color === "transparent";
  // A translucent pick from the dialog arrives as `#rrggbbaa`. Flat-filled it
  // reads as a darker opaque colour (50% blue looks navy on the dark panel),
  // so it sits on the swatch checkerboard the same way the dialog previews it.
  const isTranslucent = /^#[0-9a-f]{8}$/i.test(color) && !/ff$/i.test(color);
  return (
    <span className="relative inline-flex group">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={[
          "w-7 h-7 rounded-full border-2 border-transparent transition-all overflow-hidden",
          isTransparent && "checkerboard-canvas",
          isTranslucent && "checkerboard",
          disabled && "opacity-40 pointer-events-none",
          active
            ? "scale-110 ring-2 ring-theme-ring ring-offset-2 ring-offset-theme-sidebar"
            : "hover:scale-105",
        ]
          .filter(Boolean)
          .join(" ")}
        style={isTransparent || isTranslucent ? undefined : { backgroundColor: color }}
        aria-label={isTransparent ? "Transparent (checkerboard)" : `Color ${color}`}
      >
        {isTranslucent && (
          <span className="block h-full w-full" style={{ backgroundColor: color }} />
        )}
      </button>
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="absolute -top-1 -right-1 hidden group-hover:flex items-center justify-center w-3.5 h-3.5 rounded-full bg-theme-sidebar text-theme-muted-foreground border border-theme-border hover:text-theme-foreground"
          aria-label={`Remove ${color}`}
        >
          <X className="h-2 w-2" />
        </button>
      )}
    </span>
  );
}
