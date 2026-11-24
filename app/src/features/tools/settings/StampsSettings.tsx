// Create › Stamps — the Text tool's `stamps` mode (ADR-109).
//
// Pick a classic or type any word, pick its color and size, then click the
// photo: the Text tool places a text in the stamp's style (`lib/stamps`). The
// choice lives in the tool settings, which the Text tool's click reads, so
// nothing has to be announced from here to the canvas — the window
// CustomEvent the Red Stamps panel used is gone with it.
import type { ToolSettings } from "@/lib/types";
import { TEXT_COLORS } from "@/lib/colors";
import { STAMP_PRESETS, stampWord } from "@/lib/stamps";
import { SizeSlider } from "@/components/ui/size-slider";
import { ColorSwatchGrid } from "@/components/ColorSwatchGrid";
import { TextField } from "@/components/ui/number-field";
import { ToolButtonGroup } from "@/components/ui/tool-button-group";
import { ControlRow } from "@/components/ui/control-row";

const STAMP_SIZE_PRESETS = [32, 48, 72, 96] as const;
const PRESET_OPTIONS = STAMP_PRESETS.map((p) => ({ id: p.id, label: p.name }));

/** Longest word the field takes. A stamp is a word or two, not a caption. */
const MAX_STAMP_CHARS = 24;

interface StampsSettingsProps {
  settings: ToolSettings;
  onChange: (s: ToolSettings) => void;
}

export function StampsSettings({ settings, onChange }: StampsSettingsProps) {
  // A preset is "picked" while the word and color are still exactly its own;
  // typing a word or choosing another color makes it a custom stamp.
  const picked = STAMP_PRESETS.find(
    (p) => p.label === stampWord(settings.stampLabel) && p.color === settings.stampColor,
  );
  const pick = (id: string) => {
    const p = STAMP_PRESETS.find((s) => s.id === id);
    if (p) onChange({ ...settings, stampLabel: p.label, stampColor: p.color });
  };
  return (
    <div className="space-y-4" data-stamps-panel>
      {/* The palette first, as every panel leads (ADR-107): the stamp's word
          and its border. A preset sets it; picking another color makes the
          stamp a custom one. */}
      <ColorSwatchGrid
        label="Color"
        colors={TEXT_COLORS}
        transparent={false}
        value={settings.stampColor}
        onChange={(color) => onChange({ ...settings, stampColor: color })}
      />

      {/* The presets are an ordinary ToolButtonGroup, like every other pick
          in the toolbar — not the dashed, tinted tiles Red Stamps drew. Its
          color shows in the Color swatches above. */}
      <ControlRow label="Stamp">
        {({ labelId }) => (
          <ToolButtonGroup
            aria-labelledby={labelId}
            options={PRESET_OPTIONS}
            value={picked?.id}
            onChange={pick}
            columns={2}
          />
        )}
      </ControlRow>

      {/* Any word: PAID, FINAL, SOLD… Placed in capitals, on one line. */}
      <TextField
        label="Word"
        value={settings.stampLabel}
        maxLength={MAX_STAMP_CHARS}
        placeholder="PAID"
        autoComplete="off"
        spellCheck={false}
        onChange={(e) => onChange({ ...settings, stampLabel: e.target.value })}
      />

      <SizeSlider
        label="Size"
        value={settings.stampSize}
        min={16}
        max={160}
        unit="px"
        onChange={(v) => onChange({ ...settings, stampSize: v })}
        presets={STAMP_SIZE_PRESETS}
        variant="numbers"
      />
    </div>
  );
}
