// ===== FILE: app/src/features/tools/settings/EmojiSettings.tsx =====
import { useState } from "react";
import Picker from "@emoji-mart/react";
import data from "@emoji-mart/data";

const SIZE_PRESETS = [32, 48, 64, 96] as const;

interface EmojiSettingsProps {
  emoji: string;
  emojiSize: number;
  onEmojiChange: (emoji: string) => void;
  onSizeChange: (size: number) => void;
}

export function EmojiSettings({
  emoji,
  emojiSize,
  onEmojiChange,
  onSizeChange,
}: EmojiSettingsProps) {
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <div className="space-y-5">
      <h3 className="text-xs font-bold uppercase tracking-widest text-text-muted font-mono">
        Emoji Stamp
      </h3>

      {/* Current emoji + picker toggle */}
      <div className="space-y-3">
        <button
          onClick={() => setPickerOpen((v) => !v)}
          className={[
            "w-full flex items-center justify-center gap-3 px-4 py-3 rounded-lg transition-all",
            emoji
              ? "bg-accent/20 ring-1 ring-accent/40"
              : "bg-bg-elevated border border-border hover:border-border-active",
          ].join(" ")}
        >
          <span className="text-3xl">{emoji || "😀"}</span>
          <span className="text-sm font-medium text-text-secondary">
            {emoji ? "Change Emoji" : "Choose Emoji"}
          </span>
        </button>

        {pickerOpen && (
          <div className="rounded-lg overflow-hidden border border-border">
            <Picker
              data={data}
              onEmojiSelect={(e: { native: string }) => {
                onEmojiChange(e.native);
                setPickerOpen(false);
              }}
              theme="dark"
              previewPosition="none"
              skinTonePosition="none"
              navPosition="top"
              perLine={7}
              maxFrequentRows={1}
            />
          </div>
        )}
      </div>

      {/* Size */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold uppercase tracking-widest text-theme-muted-foreground">
            Size
          </label>
          <span className="text-xs text-theme-foreground tabular-nums">
            {emojiSize}px
          </span>
        </div>

        <div className="flex items-center justify-between">
          {SIZE_PRESETS.map((size) => {
            const active = emojiSize === size;
            return (
              <button
                key={size}
                onClick={() => onSizeChange(size)}
                className={[
                  "flex items-center justify-center w-10 h-10 rounded-full transition-all",
                  active
                    ? "ring-2 ring-theme-ring ring-offset-2 ring-offset-theme-sidebar"
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
            onChange={(e) => onSizeChange(Number(e.target.value))}
            className="slider-input absolute inset-0 h-full w-full cursor-pointer appearance-none bg-transparent"
          />
        </div>
      </div>

      {/* Instructions */}
      <p className="text-[10px] text-theme-muted-foreground leading-relaxed">
        Click anywhere on the image to stamp the emoji. Compositing runs in WASM
        for performance.
      </p>
    </div>
  );
}
