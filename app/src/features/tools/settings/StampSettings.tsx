import { useState } from "react";
import Picker from "@emoji-mart/react";
import data from "@emoji-mart/data";
import type { StampSettings } from "@/lib/types";
import { TabGroup } from "@/components/TabGroup";
import { SizeSlider } from "@/components/SizeSlider";
import { SectionHeader } from "@/components/ui/section-header";
import { useResolvedTheme } from "@/lib/useTheme";

const SIZE_PRESETS = [8, 16, 24, 32] as const;
const HARDNESS_PRESETS = [0, 33, 66, 100] as const;
const OPACITY_PRESETS = [25, 50, 75, 100] as const;
const EMOJI_SIZE_PRESETS = [32, 48, 64, 96] as const;

interface StampSettingsPanelProps {
  settings: StampSettings;
  onChange: (s: StampSettings) => void;
  hasSource: boolean;
  emoji?: string;
  emojiSize?: number;
  onEmojiChange?: (e: string) => void;
  onEmojiSizeChange?: (s: number) => void;
  activeMode?: StampMode;
  onModeChange?: (mode: StampMode) => void;
}

/** Red stamp presets that get rendered via OffscreenCanvas → Rust stamp_pixels */
export const RED_STAMP_PRESETS = [
  { id: "rejected", label: "REJECTED", color: "#dc2626" },
  { id: "approved", label: "APPROVED", color: "#16a34a" },
  { id: "draft", label: "DRAFT", color: "#d97706" },
  { id: "confidential", label: "CONFIDENTIAL", color: "#dc2626" },
  { id: "review", label: "UNDER REVIEW", color: "#2563eb" },
] as const;

export type StampMode = "clone" | "red" | "emojis";

export function StampSettingsPanel({
  settings,
  onChange,
  hasSource,
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
  const [selectedStampId, setSelectedStampId] = useState<string | null>(null);

  const handleModeChange = (id: string) => {
    const m = id as StampMode;
    setInternalMode(m);
    // Sub-mode teardown clears the armed stamp (useStampTeardown), so the
    // panel's own selection highlight must not survive the switch either —
    // otherwise a stamp looks selected while clicks no longer place it.
    setSelectedStampId(null);
    onModeChange?.(m);
  };

  const handleStampPreset = (id: string, label: string, color: string) => {
    setSelectedStampId(id);
    window.dispatchEvent(
      new CustomEvent("red-stamp-select", {
        detail: { label, color },
      }),
    );
  };

  return (
    <div className="space-y-4 -mt-2">
      {/* ── Mode switcher ── */}
      <TabGroup
        tabs={[
          { id: "clone", label: "Clone" },
          { id: "red", label: "Stamps" },
          { id: "emojis", label: "Emojis" },
        ]}
        active={mode}
        onChange={handleModeChange}
      />

      {/* ── Clone Stamp panel ── */}
      {mode === "clone" && (
        <div className="space-y-3">
          <SectionHeader
            title="Clone"
            info="Alt+Click to set the clone source, then paint elsewhere on the canvas to stamp copies of it."
          />

          <div className="flex justify-center gap-2 px-3 py-4 rounded-lg text-xs full-width-badge type-current">
            <span className="large-badge">
              {hasSource
                ? "Source set — click to paint"
                : "Alt+Click to set source"}
            </span>
          </div>

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
        </div>
      )}

      {/* ── Red Stamps panel ── */}
      {mode === "red" && (
        <div className="space-y-3">
          <SectionHeader
            title="Stamps"
            info="Select a stamp, then click on the image to place it. Full undo/redo via Rust."
          />

          {/* Brush Size */}
          <SizeSlider
            label="Brush Size"
            value={settings.brushSize}
            min={4}
            max={64}
            onChange={(v) => onChange({ ...settings, brushSize: v })}
            presets={SIZE_PRESETS}
          />

          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-2">
              {RED_STAMP_PRESETS.map((stamp) => {
                const isSelected = selectedStampId === stamp.id;
                return (
                  <button
                    key={stamp.id}
                    onClick={() =>
                      handleStampPreset(stamp.id, stamp.label, stamp.color)
                    }
                    className="relative flex items-center justify-center py-3 px-4 rounded-lg border-2 transition-all hover:scale-[1.02] active:scale-[0.98]"
                    style={{
                      borderStyle: isSelected ? "solid" : "dashed",
                      borderColor: isSelected
                        ? stamp.color
                        : stamp.color + "60",
                      backgroundColor: isSelected
                        ? stamp.color + "20"
                        : stamp.color + "08",
                      boxShadow: isSelected
                        ? `0 0 0 1px ${stamp.color}40, 0 0 12px ${stamp.color}25`
                        : "none",
                    }}
                  >
                    {isSelected && (
                      <span
                        className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: stamp.color }}
                      />
                    )}
                    <span
                      className="text-sm font-bold tracking-[0.15em] uppercase"
                      style={{
                        color: stamp.color,
                        fontFamily: '"Arial Black", "Impact", sans-serif',
                        transform: "rotate(-2deg)",
                        display: "inline-block",
                        textShadow: isSelected
                          ? `0 0 20px ${stamp.color}50`
                          : `0 0 20px ${stamp.color}20`,
                      }}
                    >
                      [{stamp.label}]
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Emojis panel ── */}
      {mode === "emojis" && (
        <div className="space-y-3">
          <SectionHeader
            title="Emojis"
            info="Pick an emoji, then click on the canvas to place it at the chosen size."
          />

          <div className="emoji-picker-host">
            <Picker
              data={data}
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
        </div>
      )}
    </div>
  );
}

// Also export as StampSettings for backwards compat
export { StampSettingsPanel as StampSettings };
