import type { StampSettings } from "@/lib/types";

interface Props {
  settings: StampSettings;
  onChange: (s: StampSettings) => void;
  hasSource: boolean;
}

const SIZE_PRESETS = [4, 8, 16, 32] as const;

function SliderField({
  value,
  min,
  max,
  onChange,
  label,
  display,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  label?: string;
  display: string;
}) {
  const pct = ((value - min) / (max - min)) * 100;

  return (
    <div className="space-y-3">
      {label && (
        <h3 className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
          {label}
        </h3>
      )}
      <div className="relative h-5 w-full flex items-center">
        {/* visual track — centered vertically within the h-5 hit area */}
        <div className="absolute inset-x-0 h-2 rounded-full top-1/2 -translate-y-1/2" style={{ background: "var(--bg-elevated)" }}>
          <div
            className="absolute h-full rounded-full pointer-events-none"
            style={{
              width: `${pct}%`,
              background: `linear-gradient(to right, var(--accent), #8a7a6e)`,
            }}
          />
        </div>
        {/* full-height transparent input for hit target + thumb */}
        <input
          type="range"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="slider-overlay absolute inset-0 w-full cursor-pointer appearance-none"
        />
      </div>
      <div className="text-xs" style={{ color: "var(--text-muted)" }}>
        {display}
      </div>
    </div>
  );
}

export function StampSettings({ settings, onChange, hasSource }: Props) {
  return (
    <div className="space-y-6">
      <h3 className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
        Brush & Stamp
      </h3>

      {/* Source status */}
      <div
        className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
        style={{
          background: hasSource ? "var(--accent-dim)" : "var(--bg-elevated)",
          color: hasSource ? "var(--accent)" : "var(--text-muted)",
        }}
      >
        <span
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{
            background: hasSource ? "var(--accent)" : "var(--text-muted)",
            boxShadow: hasSource ? "0 0 6px var(--accent-dim)" : "none",
          }}
        />
        {hasSource ? "Source set — click to paint" : "Alt+Click to set source"}
      </div>

      {/* Brush Size */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
          Brush Size
        </h3>

        <div className="flex items-center justify-between">
          {SIZE_PRESETS.map((size) => {
            const active = settings.brushSize === size;
            return (
              <button
                key={size}
                onClick={() => onChange({ ...settings, brushSize: size })}
                className="flex items-center justify-center w-10 h-10 rounded-full transition-all"
                style={{
                  boxShadow: active
                    ? `0 0 0 2px var(--bg-secondary), 0 0 0 4px var(--accent)`
                    : undefined,
                  background: active ? "transparent" : undefined,
                }}
                aria-label={`Brush size ${size}`}
              >
                <span
                  className="rounded-full"
                  style={{
                    width: size / 2,
                    height: size / 2,
                    background: "var(--text-primary)",
                  }}
                />
              </button>
            );
          })}
        </div>

        <SliderField
          value={settings.brushSize}
          min={2}
          max={200}
          onChange={(v) => onChange({ ...settings, brushSize: v })}
          display={`${settings.brushSize}px`}
        />
      </div>

      {/* Hardness */}
      <SliderField
        label="Hardness"
        value={Math.round(settings.hardness * 100)}
        min={0}
        max={100}
        onChange={(v) => onChange({ ...settings, hardness: v / 100 })}
        display={`${Math.round(settings.hardness * 100)}%`}
      />

      {/* Opacity */}
      <SliderField
        label="Opacity"
        value={Math.round(settings.opacity * 100)}
        min={0}
        max={100}
        onChange={(v) => onChange({ ...settings, opacity: v / 100 })}
        display={`${Math.round(settings.opacity * 100)}%`}
      />
    </div>
  );
}
