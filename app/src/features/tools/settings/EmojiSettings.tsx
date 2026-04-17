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
  return (
    <div className="space-y-4">
      <h3 className="text-xs font-bold uppercase tracking-widest text-text-muted font-mono">
        Emoji Stamp
      </h3>
      {/* FIX (issue #6): removed wrapping bordered/elevated/rounded div.
          The emoji-mart picker is rendered directly; padding and frame are
          killed via `em-emoji-picker` overrides in styles.css. */}
      <div className="emoji-picker-host">
        <Picker
          data={data}
          onEmojiSelect={(e: { native: string }) => {
            onEmojiChange(e.native);
          }}
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
          <label className="text-xs font-bold uppercase tracking-widest text-text-muted font-mono">
            Size
          </label>
          <span className="text-xs text-text-secondary tabular-nums font-mono">
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
                  "flex items-center justify-center w-10 h-10 rounded-lg transition-all",
                  active
                    ? "bg-accent text-text-primary ring-2 ring-accent/50"
                    : "bg-bg-elevated border border-border text-text-secondary hover:border-border-active",
                ].join(" ")}
                aria-label={`Emoji size ${size}`}
              >
                <span style={{ fontSize: size * 0.4 }}>😀</span>
              </button>
            );
          })}
        </div>
        <input
          type="range"
          min={16}
          max={128}
          step={1}
          value={emojiSize}
          onChange={(e) => onSizeChange(Number(e.target.value))}
          className="w-full h-2 rounded-full bg-bg-elevated appearance-none cursor-pointer accent-accent"
        />
      </div>
      {emoji && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-accent/10 border border-accent/30">
          <span className="text-2xl">{emoji}</span>
          <span className="text-xs text-text-secondary font-mono">
            Selected
          </span>
        </div>
      )}
    </div>
  );
}