// The colour dialog behind every "+" swatch in the app.
//
// Layout (stacks to one column at phone width):
//   ┌──────────────────────────┬────────────────────────┐
//   │ [Wheel | Rectangle]      │ current ▸ new preview  │
//   │                          │ HEX                    │
//   │   wheel / SV square      │ R  G  B  A             │
//   │   hue + brightness       │ H  S  L                │
//   │   alpha                  │ Palette  ● ● ● ● (+)   │
//   └──────────────────────────┴────────────────────────┘
//                                          [Cancel] [Use colour]
//
// State model: HSV + alpha are the source of truth and RGB / HSL / hex are
// DERIVED on every render. Storing RGB instead would lose the hue the moment
// the user drags to black or white (rgb(0,0,0) has no hue), which snaps the
// wheel marker to red on the way back up — the classic picker bug.
//
// "Use colour" hands the picked colour to the control that opened the dialog
// (a stroke, fill, guide colour…). The palette row's own "+" is separate and
// SAVES the colour to the global user palette (hooks/useUserColors.ts) —
// localStorage when signed out, the Convex `user_colors` table when signed in
// — so it shows up on every swatch grid in the app.
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Plus, Check, X, Circle as CircleIcon, Square as SquareIcon } from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FieldLabel } from "@/components/ui/field-label";
import { ToolButtonGroup } from "@/components/ui/tool-button-group";
import { CONFIRM_AFFIRMATIVE, FIELD_NUMERIC } from "@/lib/styles";
import { useUserColors } from "@/hooks/useUserColors";
import { parseColor } from "@/lib/colorParser";
import {
  clamp,
  formatHsl,
  formatRgba,
  hexToRgba,
  hslToHsv,
  hsvToHsl,
  hsvToRgb,
  parseHslString,
  rgbToHsv,
  rgbaToHex,
  wrapHue,
  type HSV,
} from "@/lib/colorConvert";
import { cn } from "@/lib/utils";

type PickerMode = "wheel" | "rect";

const PICKER_MODES = [
  { id: "wheel", label: "Wheel", icon: CircleIcon },
  { id: "rect", label: "Rectangle", icon: SquareIcon },
] as const;

const LS_MODE_KEY = "image-horse-color-picker-mode";

function loadMode(): PickerMode {
  try {
    return localStorage.getItem(LS_MODE_KEY) === "rect" ? "rect" : "wheel";
  } catch {
    return "wheel";
  }
}

/** Colours a control may hold that aren't real colours. Treated as "start
 *  from the default" rather than crashing the parser. */
const FALLBACK: { hsv: HSV; a: number } = { hsv: { h: 0, s: 0, v: 100 }, a: 1 };

export interface ColorPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Colour the dialog opens on — normally the control's current value. */
  initialColor: string;
  /** Receives the normalised `#rrggbb` / `#rrggbbaa` on "Use colour". */
  onPick: (hex: string) => void;
  title?: string;
}

export function ColorPickerDialog({
  open,
  onOpenChange,
  initialColor,
  onPick,
  title = "Pick a colour",
}: ColorPickerDialogProps) {
  const { userColors, addColor, removeColor } = useUserColors();
  const [mode, setModeState] = useState<PickerMode>(loadMode);
  const setMode = useCallback((m: PickerMode) => {
    setModeState(m);
    try {
      localStorage.setItem(LS_MODE_KEY, m);
    } catch {
      // Preference only; losing it costs one extra click next time.
    }
  }, []);

  const [hsv, setHsv] = useState<HSV>(FALLBACK.hsv);
  const [alpha, setAlpha] = useState(FALLBACK.a);
  // What the control held when we opened — the "current" half of the preview.
  const [startHex, setStartHex] = useState<string | null>(null);

  // Seed from the opening colour each time the dialog opens. The hex branch
  // is sync; anything else (rgb(), rgba()) goes through the Rust parser.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const seed = (h: HSV, a: number, hex: string | null) => {
      if (cancelled) return;
      setHsv(h);
      setAlpha(a);
      setStartHex(hex);
    };
    const hex = hexToRgba(initialColor);
    if (hex) {
      seed(rgbToHsv(hex.rgb), hex.a, rgbaToHex(hex.rgb, hex.a));
      return;
    }
    const hsl = parseHslString(initialColor);
    if (hsl) {
      seed(hslToHsv(hsl.hsl), hsl.a, rgbaToHex(hsvToRgb(hslToHsv(hsl.hsl)), hsl.a));
      return;
    }
    void parseColor(initialColor).then((parsed) => {
      if (parsed) {
        const rgb = { r: parsed.r, g: parsed.g, b: parsed.b };
        seed(rgbToHsv(rgb), parsed.a / 255, parsed.hex);
      } else {
        seed(FALLBACK.hsv, FALLBACK.a, null);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [open, initialColor]);

  // ── Derived views ──────────────────────────────────────────────────────
  const rgb = useMemo(() => hsvToRgb(hsv), [hsv]);
  const hsl = useMemo(() => hsvToHsl(hsv), [hsv]);
  const hex = rgbaToHex(rgb, alpha);
  const css = formatRgba(rgb, alpha);
  const alreadySaved = userColors.some((c) => c.trim().toLowerCase() === hex);

  const setRgbChannel = (key: "r" | "g" | "b", raw: number) => {
    if (Number.isNaN(raw)) return;
    setHsv(rgbToHsv({ ...rgb, [key]: clamp(Math.round(raw), 0, 255) }));
  };
  const setHslChannel = (key: "h" | "s" | "l", raw: number) => {
    if (Number.isNaN(raw)) return;
    const next = { ...hsl, [key]: key === "h" ? wrapHue(raw) : clamp(raw, 0, 100) };
    setHsv(hslToHsv(next));
  };

  const confirm = () => {
    onPick(hex);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        // flex column + a viewport-bound height so the body scrolls on a short
        // phone screen instead of the footer falling off the bottom.
        className="flex max-h-[calc(100dvh-2rem)] max-w-[640px] flex-col"
        // The picker is opened from inside a tool panel that has its own
        // pointer-down handlers (data-draw-panel etc.); the dialog is portalled
        // so those don't fire, but Enter should still confirm from any field.
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.target as HTMLElement).tagName === "INPUT") {
            e.preventDefault();
            confirm();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle className="text-base">{title}</DialogTitle>
          <DialogDescription className="text-2xs">
            Drag on the {mode === "wheel" ? "wheel" : "square"}, or type a value. Save it to your
            palette to reuse it on every colour picker.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="grid min-h-0 flex-1 gap-5 overflow-y-auto sm:grid-cols-[minmax(0,1fr)_minmax(0,220px)]">
          {/* ── Left: the picker surface ─────────────────────────────── */}
          <div className="space-y-3">
            <ToolButtonGroup
              options={PICKER_MODES}
              value={mode}
              onChange={setMode}
            />
            {mode === "wheel" ? (
              <HueWheel hsv={hsv} onChange={setHsv} />
            ) : (
              <SvSquare hsv={hsv} onChange={setHsv} />
            )}

            {mode === "wheel" ? (
              <GradientSlider
                label="Brightness"
                value={hsv.v}
                max={100}
                display={`${Math.round(hsv.v)}%`}
                background={`linear-gradient(to right, #000, ${rgbaToHex(hsvToRgb({ ...hsv, v: 100 }))})`}
                onChange={(v) => setHsv({ ...hsv, v })}
              />
            ) : (
              <GradientSlider
                label="Hue"
                value={hsv.h}
                max={360}
                display={`${Math.round(hsv.h)}°`}
                background="linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)"
                onChange={(h) => setHsv({ ...hsv, h })}
              />
            )}

            <GradientSlider
              label="Opacity"
              value={alpha * 100}
              max={100}
              display={`${Math.round(alpha * 100)}%`}
              checker
              background={`linear-gradient(to right, transparent, ${rgbaToHex(rgb)})`}
              onChange={(a) => setAlpha(a / 100)}
            />
          </div>

          {/* ── Right: the numbers ───────────────────────────────────── */}
          <div className="space-y-3">
            <ColorPreview before={startHex} after={hex} />

            <HexField hex={hex} onChange={(h) => {
              const parsed = hexToRgba(h);
              if (!parsed) return;
              setHsv(rgbToHsv(parsed.rgb));
              setAlpha(parsed.a);
            }} />

            <FieldGroup label="RGBA" readout={css}>
              <NumberField label="R" value={rgb.r} max={255} onChange={(n) => setRgbChannel("r", n)} />
              <NumberField label="G" value={rgb.g} max={255} onChange={(n) => setRgbChannel("g", n)} />
              <NumberField label="B" value={rgb.b} max={255} onChange={(n) => setRgbChannel("b", n)} />
              <NumberField
                label="A"
                value={Number(alpha.toFixed(2))}
                max={1}
                step={0.01}
                onChange={(n) => !Number.isNaN(n) && setAlpha(clamp(n, 0, 1))}
              />
            </FieldGroup>

            <FieldGroup label="HSL" readout={formatHsl(hsl, alpha)}>
              <NumberField label="H" value={Math.round(hsl.h)} max={360} onChange={(n) => setHslChannel("h", n)} />
              <NumberField label="S" value={Math.round(hsl.s)} max={100} onChange={(n) => setHslChannel("s", n)} />
              <NumberField label="L" value={Math.round(hsl.l)} max={100} onChange={(n) => setHslChannel("l", n)} />
            </FieldGroup>

            {/* ── Global palette ─────────────────────────────────────── */}
            <div className="space-y-2 border-t border-border pt-3">
              <FieldLabel
                title={`Palette (${userColors.length}/32)`}
                info="Colours you save here show up on every colour picker in the app — stroke, fill, guides, text. They stay in this browser until you sign in, then follow your account."
              />
              <div className="flex flex-wrap gap-2">
                {userColors.map((c) => (
                  <PaletteSwatch
                    key={c}
                    color={c}
                    active={c.toLowerCase() === hex}
                    onClick={() => {
                      const parsed = hexToRgba(c);
                      if (!parsed) return;
                      setHsv(rgbToHsv(parsed.rgb));
                      setAlpha(parsed.a);
                    }}
                    onRemove={() => removeColor(c)}
                  />
                ))}
                <button
                  type="button"
                  onClick={() => addColor(hex)}
                  disabled={alreadySaved}
                  aria-label={alreadySaved ? "Already in your palette" : "Save to palette"}
                  title={alreadySaved ? "Already in your palette" : "Save to palette"}
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-full border-2 transition-all",
                    alreadySaved
                      ? "border-theme-primary bg-theme-primary/15 text-theme-primary"
                      : "border-dashed border-theme-border bg-theme-muted/20 text-theme-muted-foreground hover:border-theme-foreground/50 hover:text-theme-foreground",
                  )}
                >
                  {alreadySaved ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                </button>
              </div>
              <p className="text-2xs leading-relaxed text-text-muted">
                Saved colours appear on every picker.{" "}
                {userColors.length === 0 && "Press + to save the current colour."}
              </p>
            </div>
          </div>
        </DialogBody>

        <DialogFooter>
          <DialogClose asChild>
            <Button size="large" className="flex-1">
              Cancel
            </Button>
          </DialogClose>
          <Button size="large" onClick={confirm} className={`flex-1 ${CONFIRM_AFFIRMATIVE}`}>
            <span
              aria-hidden
              className="checkerboard inline-block h-3.5 w-3.5 overflow-hidden rounded-sm border border-black/30"
            >
              <span className="block h-full w-full" style={{ backgroundColor: css }} />
            </span>
            Use colour
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Picker surfaces
// ─────────────────────────────────────────────────────────────────────────────

/** Shared drag plumbing: capture the pointer on down, report fractional
 *  (0–1, 0–1) coordinates inside the element on down + move. */
function useDragSurface(onPoint: (fx: number, fy: number) => void) {
  const ref = useRef<HTMLDivElement>(null);
  const report = useCallback(
    (e: PointerEvent | React.PointerEvent) => {
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      onPoint((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
    },
    [onPoint],
  );
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    ref.current?.focus();
    ref.current?.setPointerCapture(e.pointerId);
    report(e);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!ref.current?.hasPointerCapture(e.pointerId)) return;
    report(e);
  };
  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    ref.current?.releasePointerCapture(e.pointerId);
  };
  return { ref, onPointerDown, onPointerMove, onPointerUp };
}

const WHEEL_PX = 220;

/** Hue around the rim, saturation from the centre, at the current brightness.
 *  Painted into a canvas with ImageData — ~50k pixels, a millisecond, redrawn
 *  only when V changes. Hue 0 sits at 3 o'clock and increases anticlockwise,
 *  the maths convention, so the marker position is a plain cos/sin. */
function HueWheel({ hsv, onChange }: { hsv: HSV; onChange: (h: HSV) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const v = Math.round(hsv.v);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const size = Math.round(WHEEL_PX * dpr);
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const img = ctx.createImageData(size, size);
    const data = img.data;
    const c = size / 2;
    const radius = c - 1;
    const vn = v / 100;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = x + 0.5 - c;
        const dy = y + 0.5 - c;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const i = (y * size + x) * 4;
        if (dist > radius + 1) continue; // transparent
        const h = wrapHue((Math.atan2(-dy, dx) * 180) / Math.PI);
        const s = Math.min(dist / radius, 1);
        const { r, g, b } = hsvToRgb({ h, s: s * 100, v: vn * 100 });
        data[i] = r;
        data[i + 1] = g;
        data[i + 2] = b;
        // 1px anti-aliased rim.
        data[i + 3] = dist > radius ? Math.round((1 - (dist - radius)) * 255) : 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }, [v]);

  const onPoint = useCallback(
    (fx: number, fy: number) => {
      const dx = fx - 0.5;
      const dy = fy - 0.5;
      const h = wrapHue((Math.atan2(-dy, dx) * 180) / Math.PI);
      const s = clamp((Math.sqrt(dx * dx + dy * dy) / 0.5) * 100, 0, 100);
      onChange({ ...hsv, h, s });
    },
    [hsv, onChange],
  );
  const drag = useDragSurface(onPoint);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 10 : 1;
    switch (e.key) {
      case "ArrowLeft":  onChange({ ...hsv, h: wrapHue(hsv.h - step) }); break;
      case "ArrowRight": onChange({ ...hsv, h: wrapHue(hsv.h + step) }); break;
      case "ArrowUp":    onChange({ ...hsv, s: clamp(hsv.s + step, 0, 100) }); break;
      case "ArrowDown":  onChange({ ...hsv, s: clamp(hsv.s - step, 0, 100) }); break;
      default: return;
    }
    e.preventDefault();
  };

  const rad = (hsv.h * Math.PI) / 180;
  const mx = 50 + Math.cos(rad) * (hsv.s / 100) * 50;
  const my = 50 - Math.sin(rad) * (hsv.s / 100) * 50;

  return (
    <div className="flex justify-center">
      <div
        ref={drag.ref}
        role="application"
        tabIndex={0}
        aria-label={`Colour wheel — hue ${Math.round(hsv.h)}°, saturation ${Math.round(hsv.s)}%. Arrow keys: left/right hue, up/down saturation.`}
        onPointerDown={drag.onPointerDown}
        onPointerMove={drag.onPointerMove}
        onPointerUp={drag.onPointerUp}
        onPointerCancel={drag.onPointerUp}
        onKeyDown={onKeyDown}
        className="relative touch-none select-none rounded-full outline-none ring-offset-2 ring-offset-bg-secondary focus-visible:ring-2 focus-visible:ring-theme-ring"
        style={{ width: WHEEL_PX, height: WHEEL_PX, maxWidth: "100%" }}
      >
        <canvas
          ref={canvasRef}
          aria-hidden
          className="block h-full w-full cursor-crosshair rounded-full"
        />
        <Marker x={mx} y={my} color={rgbaToHex(hsvToRgb(hsv))} />
      </div>
    </div>
  );
}

/** Saturation left→right, brightness bottom→top, at the current hue. Pure
 *  CSS gradients — the hue slider below picks the third axis. */
function SvSquare({ hsv, onChange }: { hsv: HSV; onChange: (h: HSV) => void }) {
  const onPoint = useCallback(
    (fx: number, fy: number) => {
      onChange({
        ...hsv,
        s: clamp(fx * 100, 0, 100),
        v: clamp((1 - fy) * 100, 0, 100),
      });
    },
    [hsv, onChange],
  );
  const drag = useDragSurface(onPoint);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 10 : 1;
    switch (e.key) {
      case "ArrowLeft":  onChange({ ...hsv, s: clamp(hsv.s - step, 0, 100) }); break;
      case "ArrowRight": onChange({ ...hsv, s: clamp(hsv.s + step, 0, 100) }); break;
      case "ArrowUp":    onChange({ ...hsv, v: clamp(hsv.v + step, 0, 100) }); break;
      case "ArrowDown":  onChange({ ...hsv, v: clamp(hsv.v - step, 0, 100) }); break;
      default: return;
    }
    e.preventDefault();
  };

  const pureHue = rgbaToHex(hsvToRgb({ h: hsv.h, s: 100, v: 100 }));

  return (
    <div
      ref={drag.ref}
      role="application"
      tabIndex={0}
      aria-label={`Colour square — saturation ${Math.round(hsv.s)}%, brightness ${Math.round(hsv.v)}%. Arrow keys: left/right saturation, up/down brightness.`}
      onPointerDown={drag.onPointerDown}
      onPointerMove={drag.onPointerMove}
      onPointerUp={drag.onPointerUp}
      onPointerCancel={drag.onPointerUp}
      onKeyDown={onKeyDown}
      className="relative w-full cursor-crosshair touch-none select-none overflow-hidden rounded-lg border border-border outline-none focus-visible:ring-2 focus-visible:ring-theme-ring"
      style={{
        height: WHEEL_PX,
        backgroundImage: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${pureHue})`,
      }}
    >
      <Marker x={hsv.s} y={100 - hsv.v} color={rgbaToHex(hsvToRgb(hsv))} />
    </div>
  );
}

/** The ring that marks the picked point. Filled with the colour under it so
 *  the user sees what they will get; white + dark outline so it reads on
 *  every backdrop. `x`/`y` are percentages of the surface. */
function Marker({ x, y, color }: { x: number; y: number; color: string }) {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1.5px_rgba(0,0,0,0.55)]"
      style={{ left: `${x}%`, top: `${y}%`, backgroundColor: color }}
    />
  );
}

/** A native range input over a gradient track. Native so it's keyboard-
 *  reachable and screen-reader-labelled for free; `.color-range` (styles.css)
 *  hides the track and draws a hollow-ring thumb. */
function GradientSlider({
  label,
  value,
  max,
  display,
  background,
  checker = false,
  onChange,
}: {
  label: string;
  value: number;
  max: number;
  display: string;
  background: string;
  checker?: boolean;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-2xs">
        <span className="text-theme-muted-foreground">{label}</span>
        <span className="tabular-nums text-theme-foreground">{display}</span>
      </div>
      <div
        className={cn(
          "relative h-4 overflow-hidden rounded-full border border-border",
          checker && "checkerboard",
        )}
      >
        <div aria-hidden className="absolute inset-0" style={{ background }} />
        <input
          type="range"
          className="color-range absolute inset-0 w-full"
          aria-label={label}
          min={0}
          max={max}
          step={1}
          value={Math.round(value)}
          onChange={(e) => onChange(Number(e.target.value))}
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Fields
// ─────────────────────────────────────────────────────────────────────────────

/** Split preview: what the control had (left) against what it will get
 *  (right), on a checkerboard so translucent picks read as translucent. */
function ColorPreview({ before, after }: { before: string | null; after: string }) {
  return (
    <div className="checkerboard flex h-12 overflow-hidden rounded-lg border border-border">
      {before && (
        <div
          className="flex-1"
          style={{ backgroundColor: before }}
          title={`Current: ${before}`}
          aria-label={`Current colour ${before}`}
        />
      )}
      <div
        className="flex-1"
        style={{ backgroundColor: after }}
        title={`New: ${after}`}
        aria-label={`New colour ${after}`}
      />
    </div>
  );
}

/** Free-typed hex. Holds a draft while focused so a half-typed `#ab1` isn't
 *  clobbered by the derived value on every keystroke; applies as soon as it
 *  parses; snaps back to the canonical form on blur. Same field class and
 *  label pattern as the width/height boxes (DimensionFields). */
function HexField({ hex, onChange }: { hex: string; onChange: (hex: string) => void }) {
  const id = useId();
  const [draft, setDraft] = useState(hex);
  const [focused, setFocused] = useState(false);
  const shown = focused ? draft : hex;
  const invalid = focused && draft.trim() !== "" && !hexToRgba(draft);
  return (
    <div className="flex flex-col gap-0.5">
      <label htmlFor={id} className="text-xs text-text-secondary">
        hex
      </label>
      <input
        id={id}
        type="text"
        autoComplete="off"
        spellCheck={false}
        value={shown}
        onFocus={() => {
          setDraft(hex);
          setFocused(true);
        }}
        onBlur={() => setFocused(false)}
        onChange={(e) => {
          setDraft(e.target.value);
          onChange(e.target.value);
        }}
        aria-invalid={invalid || undefined}
        placeholder="#ff5a3c"
        className={cn(FIELD_NUMERIC, "font-mono", invalid && "border-destructive")}
      />
    </div>
  );
}

/** A labelled row of channel fields with the CSS string underneath (select-all
 *  so it can be copied out in one click). */
function FieldGroup({
  label,
  readout,
  children,
}: {
  label: string;
  readout: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <FieldLabel title={label} />
      <div className="flex items-end gap-2">{children}</div>
      <p className="select-all truncate font-mono text-2xs text-text-muted" title={readout}>
        {readout}
      </p>
    </div>
  );
}

/** One channel — the DimensionFields width/height box, narrower. A real
 *  `<label htmlFor>` so the letter is attached to the spin button it names. */
function NumberField({
  label,
  value,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  max: number;
  step?: number;
  onChange: (n: number) => void;
}) {
  const id = useId();
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
      <label htmlFor={id} className="text-xs text-text-secondary">
        {label}
      </label>
      <input
        id={id}
        type="number"
        inputMode="decimal"
        min={0}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(e.target.valueAsNumber)}
        className={cn(FIELD_NUMERIC, "px-1 text-center")}
      />
    </div>
  );
}

function PaletteSwatch({
  color,
  active,
  onClick,
  onRemove,
}: {
  color: string;
  active: boolean;
  onClick: () => void;
  onRemove: () => void;
}) {
  return (
    <span className="group relative inline-flex">
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "checkerboard h-7 w-7 overflow-hidden rounded-full border-2 border-transparent transition-all",
          active
            ? "scale-110 ring-2 ring-theme-ring ring-offset-2 ring-offset-bg-secondary"
            : "hover:scale-105",
        )}
        aria-label={`Use ${color}`}
        title={color}
      >
        <span className="block h-full w-full" style={{ backgroundColor: color }} />
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="absolute -right-1 -top-1 hidden h-3.5 w-3.5 items-center justify-center rounded-full border border-theme-border bg-theme-sidebar text-theme-muted-foreground group-hover:flex hover:text-theme-foreground"
        aria-label={`Remove ${color} from palette`}
      >
        <X className="h-2 w-2" />
      </button>
    </span>
  );
}
