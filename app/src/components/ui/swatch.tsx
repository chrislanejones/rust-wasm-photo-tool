// One round color swatch — the ColorSwatchGrid tile and the color picker's
// saved-palette tile (which used to carry its own copy, `PaletteSwatch`, of this
// exact button). Its own module because the grid imports the picker, so the
// picker importing the grid back would be a cycle.
import { Pencil, X } from "lucide-react";
import type { RadioItemProps } from "@/components/ui/use-radio-group";

interface SwatchProps {
  color: string;
  /** What the circle SHOWS when it isn't `color` itself — the lit swatch of a
   *  row that carries an opacity shows the color at that opacity. */
  shows?: string;
  /** A number in the middle (the Alt opacity steps' percents). */
  text?: string;
  active: boolean;
  onClick: () => void;
  onRemove?: () => void;
  /** Shows a pencil badge (top-left) that replaces this swatch's color —
   *  the editable Fill Color palette (useEditablePalette). */
  onEdit?: () => void;
  /** Accessible name of the edit badge. Defaults to "Replace #hex". */
  editLabel?: string;
  disabled?: boolean;
  /** Accessible name. Defaults to "Color #hex" (or the checkerboard's name). */
  label?: string;
  /** Accessible name of the remove badge. Defaults to "Remove #hex". */
  removeLabel?: string;
  title?: string;
  /** Radio semantics from the group that owns this swatch (ColorSwatchGrid).
   *  A swatch picks exactly one color, so inside a grid it is a radio: its
   *  lit ring is otherwise a state nothing announces. */
  radio?: RadioItemProps;
}

export function Swatch({
  color,
  shows,
  text,
  active,
  onClick,
  onRemove,
  onEdit,
  editLabel,
  disabled,
  label,
  removeLabel,
  title,
  radio,
}: SwatchProps) {
  // The "transparent" entry is the transparent backing canvas: render the same
  // transparency checkerboard the canvas itself shows (`.checkerboard-canvas`,
  // styles.css — also used by CanvasArea) instead of a flat panel-colored
  // square, so the swatch reads as "no fill / checkerboard". Solid colors keep
  // their flat fill.
  const paint = shows ?? color;
  const isTransparent = paint === "transparent";
  // A translucent pick from the dialog arrives as `#rrggbbaa`. Flat-filled it
  // reads as a darker opaque color (50% blue looks navy on the dark panel),
  // so it sits on the swatch checkerboard the same way the dialog previews it.
  const isTranslucent = /^#[0-9a-f]{8}$/i.test(paint) && !/ff$/i.test(paint);
  return (
    <span className="relative inline-flex group/swatch">
      <button
        type="button"
        {...radio}
        onClick={onClick}
        disabled={disabled}
        className={[
          "relative w-7 h-7 rounded-full border-2 border-transparent transition-all overflow-hidden",
          isTransparent && "checkerboard-canvas",
          isTranslucent && "checkerboard",
          disabled && "opacity-40 pointer-events-none",
          active
            ? "scale-110 ring-2 ring-theme-ring ring-offset-2 ring-offset-theme-sidebar"
            : "hover:scale-105",
        ]
          .filter(Boolean)
          .join(" ")}
        style={isTransparent || isTranslucent ? undefined : { backgroundColor: paint }}
        aria-label={label ?? (color === "transparent" ? "Transparent (checkerboard)" : `Color ${color}`)}
        title={title}
      >
        {isTranslucent && (
          <span className="block h-full w-full" style={{ backgroundColor: paint }} />
        )}
        {text && (
          <span
            aria-hidden
            className="absolute inset-0 flex items-center justify-center font-mono text-[9px] font-bold text-white [text-shadow:0_0_3px_#000,0_0_2px_#000]"
          >
            {text}
          </span>
        )}
      </button>
      {onEdit && !disabled && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          className="absolute -top-1 -left-1 hidden group-hover/swatch:flex group-focus-within/swatch:flex items-center justify-center w-3.5 h-3.5 rounded-full bg-theme-sidebar text-theme-muted-foreground border border-theme-border hover:text-theme-foreground"
          aria-label={editLabel ?? `Replace ${color}`}
          title="Replace this color"
        >
          <Pencil className="h-2 w-2" />
        </button>
      )}
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="absolute -top-1 -right-1 hidden group-hover/swatch:flex group-focus-within/swatch:flex items-center justify-center w-3.5 h-3.5 rounded-full bg-theme-sidebar text-theme-muted-foreground border border-theme-border hover:text-theme-foreground"
          aria-label={removeLabel ?? `Remove ${color}`}
        >
          <X className="h-2 w-2" />
        </button>
      )}
    </span>
  );
}
