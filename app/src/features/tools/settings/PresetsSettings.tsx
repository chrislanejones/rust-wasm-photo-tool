// Enhance › Presets — one click for a whole look, shown on your photo first.
//
// The engine does the work (src/presets.rs): hovering a preset recomputes the
// layer from an untouched copy, moving away puts the copy back, and clicking
// commits ONE undo step. This file holds the preset table and the hover
// wiring; it has no pixel logic of its own.
//
// WHY HOVER AND NOT A THUMBNAIL PER PRESET. Lightroom and Google Photos render
// every preset onto a small copy of the photo. That is N remaps on load, which
// is the case that wants a dirty-rect path this engine does not have, so the
// cheaper middle is one preview at a time on the real canvas — the same
// machinery Levels already uses, at one remap per hover.
import { useEffect, useRef, useState } from "react";
import { Flame, Cloud, Moon, Sun, Snowflake, Wand2 } from "lucide-react";
import { SectionHeader } from "@/components/ui/section-header";
import { ToolButton } from "@/components/ui/tool-button";
import type { PresetControls, PresetStack } from "@/hooks/useTransforms";

/** The presets, in the engine's own units — brightness is a -1..1 fraction,
 *  contrast and saturation are factors (1 = as-is), and shadows/highlights are
 *  ABSOLUTE 8-bit (-255..255). That last pair is the trap: 0.1 there is a tenth
 *  of one level out of 255 and does nothing at all, so these are tens.
 *  Enhance/Vivid/Fade/Dark keep the brightness and contrast the Quick Adjust
 *  grid used, so the looks people already know do not change under them. */
interface Preset extends PresetStack {
  label: string;
  Icon: typeof Flame;
  blurb: string;
}

const PRESETS: Preset[] = [
  {
    label: "Enhance",
    Icon: Wand2,
    blurb: "Lifts contrast a little and opens the shadows",
    brightness: 0.08,
    contrast: 1.25,
    saturation: 1.05,
    shadows: 14,
    highlights: 6,
  },
  {
    label: "Vivid",
    Icon: Flame,
    blurb: "Pushes contrast and colour hard",
    brightness: 0,
    contrast: 1.5,
    saturation: 1.35,
    shadows: 0,
    highlights: 10,
  },
  {
    label: "Fade",
    Icon: Cloud,
    blurb: "Flattens contrast for a soft, matte look",
    brightness: 0.06,
    contrast: 0.72,
    saturation: 0.85,
    shadows: 18,
    highlights: 0,
  },
  {
    label: "Dark",
    Icon: Moon,
    blurb: "Deepens the shadows and holds the highlights",
    brightness: -0.12,
    contrast: 1.1,
    saturation: 1,
    shadows: -10,
    highlights: 14,
  },
  {
    label: "Warm",
    Icon: Sun,
    blurb: "Brighter and more saturated, with softer highlights",
    brightness: 0.05,
    contrast: 1.12,
    saturation: 1.22,
    shadows: 8,
    highlights: 12,
  },
  {
    label: "Cool",
    Icon: Snowflake,
    blurb: "Pulls colour back for a cleaner, cooler picture",
    brightness: 0.02,
    contrast: 1.18,
    saturation: 0.78,
    shadows: 0,
    highlights: 8,
  },
];

function stackOf(p: Preset): PresetStack {
  return {
    brightness: p.brightness,
    contrast: p.contrast,
    saturation: p.saturation,
    shadows: p.shadows,
    highlights: p.highlights,
  };
}

interface PresetsSettingsProps {
  presets?: PresetControls;
  imageReady: boolean;
}

export function PresetsSettings({ presets, imageReady }: PresetsSettingsProps) {
  const [hovered, setHovered] = useState<string | null>(null);
  const [applied, setApplied] = useState<string | null>(null);

  // The preview is opened lazily on the first hover rather than on mount: the
  // slot is shared with Levels, and a panel that grabbed it just by being open
  // would block the other tool for as long as it stayed open.
  const openedRef = useRef(false);
  const presetsRef = useRef(presets);
  presetsRef.current = presets;

  // Leaving the panel mid-hover must put the photo back. Without this, closing
  // the panel on a hover would leave the previewed pixels on screen with no
  // undo step behind them.
  useEffect(() => {
    return () => {
      if (openedRef.current) {
        openedRef.current = false;
        void presetsRef.current?.cancel();
      }
    };
  }, []);

  const enter = async (p: Preset) => {
    if (!imageReady || !presets) return;
    setHovered(p.label);
    if (!openedRef.current) {
      openedRef.current = true;
      await presets.begin();
    }
    presets.preview(stackOf(p));
  };

  const leave = async () => {
    setHovered(null);
    if (!openedRef.current) return;
    openedRef.current = false;
    await presets?.cancel();
  };

  const commit = async (p: Preset) => {
    if (!imageReady || !presets) return;
    openedRef.current = false;
    setHovered(null);
    const changed = await presets.apply(stackOf(p));
    if (changed) {
      setApplied(p.label);
      window.setTimeout(() => setApplied(null), 1400);
    }
  };

  return (
    <div className="space-y-3 -mt-2">
      <SectionHeader
        title="Presets"
        info="Hover a preset to see it on your photo; click to keep it. Each one is a single undo-able step, and they stack if you apply more than one."
      />

      <div
        className="grid grid-cols-3 gap-2 [grid-auto-rows:1fr]"
        onMouseLeave={() => void leave()}
      >
        {PRESETS.map((p) => (
          <ToolButton
            key={p.label}
            stacked
            disabled={!imageReady}
            title={p.blurb}
            aria-label={`Apply ${p.label} — ${p.blurb}`}
            onMouseEnter={() => void enter(p)}
            onFocus={() => void enter(p)}
            onBlur={() => void leave()}
            onClick={() => void commit(p)}
          >
            <p.Icon /> {p.label}
          </ToolButton>
        ))}
      </div>

      <p className="text-xs text-muted-foreground" aria-live="polite">
        {applied
          ? `${applied} applied — Ctrl+Z puts it back.`
          : hovered
            ? `Previewing ${hovered}. Click to keep it.`
            : imageReady
              ? "Hover a preset to try it on your photo."
              : "Load a photo to use presets."}
      </p>
    </div>
  );
}
