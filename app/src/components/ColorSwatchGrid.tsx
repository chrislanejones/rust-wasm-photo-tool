import { useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { useUserColors } from "@/hooks/useUserColors";
import { useEditablePalette, MAX_PALETTE_COLORS } from "@/hooks/useEditablePalette";
import {
  OPACITY_STEPS,
  keepAlpha,
  TRANSPARENT,
  alphaOf,
  isTransparent,
  rgbOf,
  withAlpha,
} from "@/lib/colors";
import { warmColorParser } from "@/lib/colorParser";
import { ColorPickerDialog } from "@/components/ColorPickerDialog";
import { Swatch, SwatchAction } from "@/components/ui/swatch";
import { ControlRow } from "@/components/ui/control-row";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useRadioGroup } from "@/components/ui/use-radio-group";
import { useAltOverRow } from "@/hooks/useAltOverRow";
import { useKeepFocusOnSwap } from "@/hooks/useKeepFocusOnSwap";
import { ModeRing } from "@/components/ui/mode-ring";
import { cn } from "@/lib/utils";

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
   *  a reselected gradient shape's Fill Color. No swatch is checked or lit;
   *  `value` is still what the "+" picker opens on. Default true. */
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
   *  (useEditablePalette): `colors` is what it starts as. It is edited in the
   *  "+" dialog — × on each color, + to add, Reset, then OK — never on the
   *  row itself (Chris, 11-25-2026). Grids sharing a key share the palette. */
  paletteKey?: string;
  /** The color carries an OPACITY (Chris, 11-25-2026 — mock-up D): the row's
   *  value slot shows it (100% by default), and while Alt (⌥ Option) is held
   *  with the pointer or focus on the row — or after a click on that % — the
   *  swatches turn into the current color at 100% … 0%. Emits `#rrggbb` at
   *  100%, `#rrggbbaa` below, `TRANSPARENT` at 0%; a color swatch picked
   *  keeps the opacity. Only for a value the engine stores alpha for (a
   *  shape's fill). */
  opacity?: boolean;
}

type PickerTarget = { kind: "pick" } | { kind: "add" };

/** One circle in the row's radio group. */
interface Entry {
  key: string;
  /** What the swatch IS (its name). */
  color: string;
  /** What the swatch SHOWS — the lit color swatch at the row's opacity. */
  shows: string;
  label?: string;
  text?: string;
  active: boolean;
  pick: () => void;
  title?: string;
}

const OPACITY_HINT = "Hold Alt (⌥ Option on a Mac) over the swatches to change the opacity";
/** The readout's hover text — short, a tooltip not a manual. */
const OPACITY_HINT_SHORT = "Hold Alt (⌥) to change opacity — or click";

/**
 * A row of preset swatches + the user's saved palette + the transparent
 * (checkerboard) swatch + a "+" that opens the
 * ColorPickerDialog (wheel / square, RGBA / HSL / hex fields). OK in
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
  opacity = false,
}: Props) {
  const { userColors } = useUserColors();
  const palette = useEditablePalette(paletteKey ?? "", colors);
  const editable = paletteKey !== undefined;
  const [picker, setPicker] = useState<PickerTarget | null>(null);
  const pickerOpen = picker !== null;
  // The % was clicked: opacity mode without a held key (touch, or anyone
  // who'd rather click). A step picked closes it.
  const [pinned, setPinned] = useState(false);
  const { alt, handlers } = useAltOverRow(opacity && !disabled);
  const opacityMode = opacity && !disabled && (alt || pinned);
  // The swap unmounts a focused swatch: hand focus to the new set's lit one.
  const rowRef = useRef<HTMLDivElement>(null);
  useKeepFocusOnSwap(rowRef, opacityMode, (root) =>
    root.querySelector<HTMLElement>('[role="radio"][tabindex="0"]') ??
    root.querySelector<HTMLElement>('[role="radio"]'),
  );

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

  // The opacity row's color: the value's own, or — while the value is
  // transparent (0%) — the last solid color this row held.
  const lastSolid = useRef<string | null>(null);
  if (!isTransparent(value)) lastSolid.current = rgbOf(value);
  const base = lastSolid.current ?? presets[0] ?? "#000000";
  const pct = selected ? alphaOf(value) : 100;

  // A color swatch matches the value by its RGB when the row carries an
  // opacity (60% blue is still the blue swatch), exactly otherwise.
  const matches = (c: string) =>
    opacity && !isTransparent(value) ? rgbOf(c) === rgbOf(value) : c === value;
  // A color picked keeps the row's opacity (its exact alpha byte, not the
  // rounded percent); from transparent it is solid.
  const emit = (c: string) =>
    onChange(opacity && !isTransparent(value) ? keepAlpha(c, value) : c);

  let entries: Entry[];
  if (opacityMode) {
    entries = OPACITY_STEPS.map((n) => ({
      key: `opacity:${n}`,
      color: withAlpha(base, n),
      shows: withAlpha(base, n),
      label: `Opacity ${n}%`,
      text: String(n),
      active: selected && pct === n,
      pick: () => {
        onChange(withAlpha(base, n));
        setPinned(false);
      },
    }));
  } else {
    // Only the FIRST matching swatch lights (a preset the user also saved).
    let lit = false;
    const lights = (c: string) => {
      if (lit || !selected || !matches(c)) return false;
      lit = true;
      return true;
    };
    entries = [
      ...presets.map((color) => {
        const active = lights(color);
        return {
          key: color,
          color,
          shows: active && opacity ? value : color,
          active,
          pick: () => emit(color),
        };
      }),
      ...saved.map((color) => {
        const active = lights(color);
        return {
          key: `user:${color}`,
          color,
          shows: active && opacity ? value : color,
          active,
          pick: () => emit(color),
        };
      }),
      ...(transparent
        ? [
            {
              key: TRANSPARENT,
              color: TRANSPARENT,
              shows: TRANSPARENT,
              active: selected && isTransparent(value),
              pick: () => onChange(TRANSPARENT),
              title: "Transparent",
            },
          ]
        : []),
    ];
  }

  // Every swatch is ONE radio group: picking a color is exactly one of N
  // (UI_CONSISTENCY §7). One Tab stop, arrows move and pick. The "+" (and
  // Reset) are actions, not colors, so they stay outside the group.
  const radioIds = entries.map((e) => e.key);
  const litIndex = entries.findIndex((e) => e.active);
  const radio = useRadioGroup({
    ids: radioIds,
    selected: litIndex >= 0 ? radioIds[litIndex] : undefined,
    isDisabled: () => disabled,
    onSelect: (id) => entries[radioIds.indexOf(id)]?.pick(),
  });

  const onPick = (color: string) => onChange(color);

  const plusLabel = editable ? `Edit the ${label} palette` : "Pick a custom color";

  const readout = opacity ? (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={() => setPinned((p) => !p)}
          disabled={disabled}
          aria-pressed={opacityMode}
          aria-label={`${label} opacity ${pct}%. ${OPACITY_HINT}, or click here.`}
          className={cn(
            "rounded-sm px-0.5 tabular-nums transition hover:text-theme-primary disabled:opacity-40",
            opacityMode && "text-theme-primary",
          )}
        >
          <span className="text-theme-muted-foreground">Opacity</span> {pct}%
        </button>
      </TooltipTrigger>
      <TooltipContent side="left" className="max-w-56 text-2xs leading-relaxed">
        {OPACITY_HINT_SHORT}
      </TooltipContent>
    </Tooltip>
  ) : undefined;

  return (
    <>
      <div {...handlers} ref={rowRef} className="relative">
        {/* The mode ring (Compare's): the swatches are opacity steps now. */}
        {opacityMode && <ModeRing inset={6} radius={10} thickness={2} />}
        <ControlRow
          label={label}
          // No lightbulb (Chris, 11-25-2026: "not little light bulbs just
          // everywhere"): the "Opacity N%" readout carries the hint itself.
          value={readout}
        >
          {({ labelId }) => (
            <div className="flex flex-wrap gap-2 py-1">
              {/* `contents`: the group has no box of its own, so the swatches
                  and the "+" keep wrapping as ONE row of circles. The role
                  survives (checked in Chromium's accessibility tree, Night 3). */}
              <div {...radio.groupProps} aria-labelledby={labelId} className="contents">
                {entries.map((e, i) => (
                  <Swatch
                    key={e.key}
                    color={e.color}
                    shows={e.shows}
                    text={e.text}
                    label={e.label}
                    title={e.title}
                    active={e.active}
                    onClick={e.pick}
                    disabled={disabled}
                    radio={radio.itemProps(i)}
                  />
                ))}
              </div>
              {allowCustom && !opacityMode && (
                <SwatchAction
                  onClick={() => setPicker({ kind: editable ? "add" : "pick" })}
                  disabled={disabled}
                  aria-label={plusLabel}
                  aria-haspopup="dialog"
                  aria-expanded={pickerOpen}
                  open={pickerOpen}
                  dashed
                >
                  <Plus className="h-3.5 w-3.5" />
                </SwatchAction>
              )}
            </div>
          )}
        </ControlRow>
      </div>

      {(allowCustom || editable) && (
        <ColorPickerDialog
          open={pickerOpen}
          onOpenChange={(open) => {
            if (!open) setPicker(null);
          }}
          // Opened on a transparent value it would show black at 0%: open
          // on the row's last solid color instead.
          initialColor={isTransparent(value) ? base : value}
          onPick={onPick}
          title={
            picker?.kind === "add"
              ? `${label} palette`
              : label === "Color"
                ? "Pick a color"
                : `${label} color`
          }
          palette={
            editable
              ? {
                  label,
                  colors: palette.colors,
                  defaults: colors,
                  max: MAX_PALETTE_COLORS,
                  save: palette.set,
                }
              : undefined
          }
        />
      )}
    </>
  );
}
