import { useState } from "react";
import Picker from "@emoji-mart/react";
import { Copy, Smile } from "lucide-react";
import type { StampSettings } from "@/lib/types";
import { SizeSlider } from "@/components/ui/size-slider";
import { StabilizerRow } from "./StabilizerRow";
import { useToolStore } from "@/stores/useToolStore";
import { ToolModeToggle } from "@/components/ui/tool-mode-toggle";
import type { ToolMode } from "@/components/ui/tool-mode-toggle";
import { useResolvedTheme } from "@/lib/useTheme";

// The emoji list is ~80 KB gzipped. Imported at the top it rode in the main
// chunk on every load; emoji-mart takes `data` as an async function, so the
// list is fetched the first time the picker opens and never before.
const loadEmojiData = async () => (await import("@emoji-mart/data")).default;

const SIZE_PRESETS = [8, 16, 24, 32] as const;
const HARDNESS_PRESETS = [0, 33, 66, 100] as const;
const OPACITY_PRESETS = [25, 50, 75, 100] as const;
const EMOJI_SIZE_PRESETS = [32, 48, 64, 96] as const;

interface StampSettingsPanelProps {
  settings: StampSettings;
  onChange: (s: StampSettings) => void;
  emoji?: string;
  emojiSize?: number;
  onEmojiChange?: (e: string) => void;
  onEmojiSizeChange?: (s: number) => void;
  activeMode?: StampMode;
  onModeChange?: (mode: StampMode) => void;
}

/** "red" (Red Stamps) moved to the Text tool as its Stamps mode in v17
 *  (ADR-109): a stamp is an editable text now. */
export type StampMode = "clone" | "emojis";

/** Stamp's sub-modes for the shared ToolModeToggle — the icon-grid pattern
 *  the Ratio picker uses (see ShapeSettings.tsx's SHAPES_TOOL_MODES for the
 *  identical treatment). */
const STAMP_TOOL_MODES: readonly ToolMode<StampMode>[] = [
  {
    id: "clone",
    label: "Clone Stamp",
    icon: Copy,
    info: "Alt+Click to set the clone source, then paint elsewhere on the canvas to stamp copies of it.",
  },
  {
    id: "emojis",
    label: "Emoji",
    icon: Smile,
    info: "Pick an emoji, then click on the canvas to place it at the chosen size.",
  },
];

export function StampSettingsPanel({
  settings,
  onChange,
  emoji = "",
  emojiSize = 48,
  onEmojiChange,
  onEmojiSizeChange,
  activeMode,
  onModeChange,
}: StampSettingsPanelProps) {
  const [internalMode, setInternalMode] = useState<StampMode>("clone");
  const mode = activeMode ?? internalMode;
  const emojiTheme = useResolvedTheme();
  // The stroke stabilizer is a ToolSettings field shared by paint, eraser,
  // blur and the clone stamp; this panel is handed StampSettings, so it reads
  // and writes the one shared field directly rather than growing a copy.
  const stabilizer = useToolStore((st) => st.toolSettings.paintStabilizer);
  const setToolSettings = useToolStore((st) => st.setToolSettings);

  const handleModeChange = (id: string) => {
    const m = id as StampMode;
    setInternalMode(m);
    onModeChange?.(m);
  };

  return (
    <ToolModeToggle
      modes={STAMP_TOOL_MODES}
      columns={2}
      activeMode={mode}
      onModeChange={handleModeChange}
    >
      {(m) => {
        switch (m) {
          // ── Clone Stamp ──
          case "clone":
            return (
              <>
                {/* Brush Size */}
                <SizeSlider
                  label="Brush Size"
                  value={settings.brushSize}
                  min={4}
                  max={64}
                  onChange={(v) => onChange({ ...settings, brushSize: v })}
                  presets={SIZE_PRESETS}
                />

                {/* Hardness */}
                <SizeSlider
                  variant="dots"
                  label="Hardness"
                  value={Math.round(settings.hardness * 100)}
                  onChange={(v) => onChange({ ...settings, hardness: v / 100 })}
                  presets={HARDNESS_PRESETS}
                  unit="%"
                  renderPreset={(preset) => {
                    const dotSize =
                      preset <= 0 ? 2 : preset <= 33 ? 4 : preset <= 66 ? 6 : 8;
                    return (
                      <span
                        className="rounded-full bg-theme-foreground"
                        style={{ width: dotSize, height: dotSize }}
                      />
                    );
                  }}
                />

                {/* Opacity — preset dots (numbers) to match Brush Size / Hardness. */}
                <SizeSlider
                  label="Opacity"
                  value={Math.round(settings.opacity * 100)}
                  onChange={(v) => onChange({ ...settings, opacity: v / 100 })}
                  presets={OPACITY_PRESETS}
                  variant="numbers"
                  unit="%"
                />

                {/* Reads the STORE, not `settings`: the stabilizer lives on
                    ToolSettings (shared with paint, eraser and blur) while
                    this panel is handed StampSettings. One dial everywhere is
                    the whole point, so it must not be copied onto a second
                    settings object to make a prop line up. */}
                <StabilizerRow
                  value={stabilizer}
                  onChange={(paintStabilizer) =>
                    setToolSettings((p) => ({ ...p, paintStabilizer }))
                  }
                />
              </>
            );

          // ── Emojis ──
          case "emojis":
            return (
              <>
                <div className="emoji-picker-host">
                  <Picker
                    data={loadEmojiData}
                    onEmojiSelect={(e: { native: string }) =>
                      onEmojiChange?.(e.native)
                    }
                    theme={emojiTheme}
                    previewPosition="none"
                    skinTonePosition="none"
                    navPosition="top"
                    perLine={7}
                    maxFrequentRows={1}
                    dynamicWidth={true}
                  />
                </div>
                <SizeSlider
                  label="Size"
                  value={emojiSize}
                  min={16}
                  max={128}
                  onChange={(v) => onEmojiSizeChange?.(v)}
                  presets={EMOJI_SIZE_PRESETS}
                  renderPreset={(size) => (
                    <span style={{ fontSize: size * 0.4 }}>😀</span>
                  )}
                />
                {emoji && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-theme-primary/10 border border-theme-primary/30">
                    <span className="text-2xl">{emoji}</span>
                    <span className="text-xs text-theme-muted-foreground">
                      Selected
                    </span>
                  </div>
                )}
              </>
            );
        }
      }}
    </ToolModeToggle>
  );
}
