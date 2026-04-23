import { useState } from "react";
import Picker from "@emoji-mart/react";
import data from "@emoji-mart/data";
import type { StampSettings } from "@/lib/types";
import { TabGroup } from "@/components/TabGroup";

const SIZE_PRESETS = [8, 16, 24, 32] as const;
const HARDNESS_PRESETS = [0, 33, 66, 100] as const;
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

function DotRow({
  presets,
  value,
  onSelect,
  dot,
}: {
  presets: readonly number[];
  value: number;
  onSelect: (v: number) => void;
  dot: (preset: number, active: boolean) => React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between">
      {presets.map((p) => {
        const active = value === p;
        return (
          <button
            key={p}
            type="button"
            onClick={() => onSelect(p)}
            className={[
              "flex items-center justify-center",
              "w-10 h-10",
              "rounded-full",
              "transition-all",
              active
                ? "ring-2 ring-theme-ring ring-offset-2 ring-offset-theme-sidebar"
                : "hover:bg-theme-accent",
            ].join(" ")}
            aria-label={String(p)}
          >
            {dot(p, active)}
          </button>
        );
      })}
    </div>
  );
}

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
  const [selectedStampId, setSelectedStampId] = useState<string | null>(null);

  const handleModeChange = (id: string) => {
    const m = id as StampMode;
    setInternalMode(m);
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
    <div className="space-y-8">
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
        <div className="space-y-8">
          <div className="flex justify-center gap-2 px-3 py-4 rounded-lg text-xs large-badge-item type-current">
            <span className="large-badge">
              {hasSource
                ? "Source set — click to paint"
                : "Alt+Click to set source"}
            </span>
          </div>

          {/* Brush Size */}
          <div className="space-y-4 pt-8">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-widest text-theme-muted-foreground">
                Brush Size
              </label>
              <span className="text-xs text-theme-foreground tabular-nums">
                {settings.brushSize}px
              </span>
            </div>
            <DotRow
              presets={SIZE_PRESETS}
              value={settings.brushSize}
              onSelect={(v) => onChange({ ...settings, brushSize: v })}
              dot={(preset) => {
                const dotSize =
                  preset <= 8 ? 4 : preset <= 16 ? 6 : preset <= 24 ? 8 : 10;
                return (
                  <span
                    className="rounded-full bg-theme-foreground"
                    style={{ width: dotSize, height: dotSize }}
                  />
                );
              }}
            />
            <div className="relative h-2 w-full rounded-full bg-theme-muted">
              <div
                className="absolute h-full rounded-full bg-gradient-to-r from-theme-primary to-theme-chart4"
                style={{
                  width: `${((settings.brushSize - 4) / (64 - 4)) * 100}%`,
                }}
              />
              <input
                type="range"
                min={4}
                max={64}
                step={1}
                value={settings.brushSize}
                onChange={(e) =>
                  onChange({ ...settings, brushSize: Number(e.target.value) })
                }
                className="slider-input absolute inset-0 h-full w-full cursor-pointer appearance-none bg-transparent"
              />
            </div>
          </div>

          {/* Hardness */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-widest text-theme-muted-foreground">
                Hardness
              </label>
              <span className="text-xs text-theme-foreground tabular-nums">
                {Math.round(settings.hardness * 100)}%
              </span>
            </div>
            <DotRow
              presets={HARDNESS_PRESETS}
              value={Math.round(settings.hardness * 100)}
              onSelect={(v) => onChange({ ...settings, hardness: v / 100 })}
              dot={(preset) => {
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
            <div className="relative h-2 w-full rounded-full bg-theme-muted">
              <div
                className="absolute h-full rounded-full bg-gradient-to-r from-theme-primary to-theme-chart4"
                style={{
                  width: `${Math.round(settings.hardness * 100)}%`,
                }}
              />
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={Math.round(settings.hardness * 100)}
                onChange={(e) =>
                  onChange({
                    ...settings,
                    hardness: Number(e.target.value) / 100,
                  })
                }
                className="slider-input absolute inset-0 h-full w-full cursor-pointer appearance-none bg-transparent"
              />
            </div>
          </div>

          {/* Opacity */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-widest text-theme-muted-foreground">
                Opacity
              </label>
              <span className="text-xs text-theme-foreground tabular-nums">
                {Math.round(settings.opacity * 100)}%
              </span>
            </div>
            <div className="relative h-2 w-full rounded-full bg-theme-muted">
              <div
                className="absolute h-full rounded-full bg-gradient-to-r from-theme-primary to-theme-chart4"
                style={{
                  width: `${Math.round(settings.opacity * 100)}%`,
                }}
              />
              <input
                type="range"
                min={10}
                max={100}
                step={1}
                value={Math.round(settings.opacity * 100)}
                onChange={(e) =>
                  onChange({
                    ...settings,
                    opacity: Number(e.target.value) / 100,
                  })
                }
                className="slider-input absolute inset-0 h-full w-full cursor-pointer appearance-none bg-transparent"
              />
            </div>
          </div>
        </div>
      )}

      {/* ── Red Stamps panel ── */}
      {mode === "red" && (
        <div className="space-y-8">
          {/* Brush Size */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-widest text-theme-muted-foreground">
                Brush Size
              </label>
              <span className="text-xs text-theme-foreground tabular-nums">
                {settings.brushSize}px
              </span>
            </div>
            <DotRow
              presets={SIZE_PRESETS}
              value={settings.brushSize}
              onSelect={(v) => onChange({ ...settings, brushSize: v })}
              dot={(preset) => {
                const dotSize =
                  preset <= 8 ? 4 : preset <= 16 ? 6 : preset <= 24 ? 8 : 10;
                return (
                  <span
                    className="rounded-full bg-theme-foreground"
                    style={{ width: dotSize, height: dotSize }}
                  />
                );
              }}
            />
            <div className="relative h-2 w-full rounded-full bg-theme-muted">
              <div
                className="absolute h-full rounded-full bg-gradient-to-r from-theme-primary to-theme-chart4"
                style={{
                  width: `${((settings.brushSize - 4) / (64 - 4)) * 100}%`,
                }}
              />
              <input
                type="range"
                min={4}
                max={64}
                step={1}
                value={settings.brushSize}
                onChange={(e) =>
                  onChange({ ...settings, brushSize: Number(e.target.value) })
                }
                className="slider-input absolute inset-0 h-full w-full cursor-pointer appearance-none bg-transparent"
              />
            </div>
          </div>

          <div className="space-y-4">
            <p className="text-[10px] text-text-muted/60 leading-relaxed">
              Select a stamp, then click on the image to place it. Full
              undo/redo via Rust.
            </p>
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
                      className="text-sm font-black tracking-[0.15em] uppercase"
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
        <div className="space-y-4">
          <div className="emoji-picker-host">
            <Picker
              data={data}
              onEmojiSelect={(e: { native: string }) => onEmojiChange?.(e.native)}
              theme="dark"
              previewPosition="none"
              skinTonePosition="none"
              navPosition="top"
              perLine={7}
              maxFrequentRows={1}
              dynamicWidth={true}
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-widest text-theme-muted-foreground">
                Size
              </label>
              <span className="text-xs text-theme-foreground tabular-nums">
                {emojiSize}px
              </span>
            </div>
            <div className="flex items-center justify-between">
              {EMOJI_SIZE_PRESETS.map((size) => {
                const active = emojiSize === size;
                return (
                  <button
                    key={size}
                    onClick={() => onEmojiSizeChange?.(size)}
                    className={[
                      "flex items-center justify-center w-10 h-10 rounded-lg transition-all",
                      active
                        ? "ring-2 ring-theme-ring ring-offset-2 ring-offset-theme-sidebar bg-theme-accent"
                        : "hover:bg-theme-accent",
                    ].join(" ")}
                    aria-label={`Emoji size ${size}`}
                  >
                    <span style={{ fontSize: size * 0.4 }}>😀</span>
                  </button>
                );
              })}
            </div>
            <div className="relative h-2 w-full rounded-full bg-theme-muted">
              <div
                className="absolute h-full rounded-full bg-gradient-to-r from-theme-primary to-theme-chart4"
                style={{ width: `${((emojiSize - 16) / (128 - 16)) * 100}%` }}
              />
              <input
                type="range"
                min={16}
                max={128}
                step={1}
                value={emojiSize}
                onChange={(e) => onEmojiSizeChange?.(Number(e.target.value))}
                className="slider-input absolute inset-0 h-full w-full cursor-pointer appearance-none bg-transparent"
              />
            </div>
          </div>
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
