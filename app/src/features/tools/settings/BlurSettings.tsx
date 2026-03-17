// ===== FILE: app/src/features/tools/settings/BlurSettings.tsx =====
import type { ToolSettings } from "@/lib/types";

const SIZE_PRESETS = [8, 16, 32, 64] as const;

interface BlurSettingsProps {
  settings: ToolSettings;
  onChange: (settings: ToolSettings) => void;
}

export function BlurSettings({ settings, onChange }: BlurSettingsProps) {
  return (
    <div className="space-y-5">
      <h3 className="text-xs font-bold uppercase tracking-widest text-text-muted font-mono">
        Blur &amp; Redact
      </h3>

      {/* ── Blur Size ── */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold uppercase tracking-widest text-theme-muted-foreground">
            Size
          </label>
          <span className="text-xs text-theme-foreground tabular-nums">
            {settings.blurSize}px
          </span>
        </div>

        {/* Dot presets — same pattern as Clone Stamp hardness/size */}
        <div className="flex items-center justify-between">
          {SIZE_PRESETS.map((size) => {
            const active = settings.blurSize === size;
            // Visual dot scales with preset
            const dotSize =
              size <= 8 ? 4 : size <= 16 ? 6 : size <= 32 ? 8 : 10;
            return (
              <button
                key={size}
                onClick={() => onChange({ ...settings, blurSize: size })}
                className={[
                  "flex items-center justify-center",
                  "w-10 h-10",
                  "rounded-full",
                  "transition-all",
                  active
                    ? "ring-2 ring-theme-ring ring-offset-2 ring-offset-theme-sidebar"
                    : "hover:bg-theme-accent",
                ].join(" ")}
                aria-label={`Blur size ${size}`}
              >
                <span
                  className="rounded-full bg-theme-foreground/50"
                  style={{
                    width: dotSize,
                    height: dotSize,
                    filter: "blur(1.5px)",
                  }}
                />
              </button>
            );
          })}
        </div>

        {/* Clone Stamp style gradient slider */}
        <div className="relative h-2 w-full rounded-full bg-theme-muted">
          <div
            className="absolute h-full rounded-full bg-gradient-to-r from-theme-primary to-theme-chart4"
            style={{ width: `${((settings.blurSize - 4) / (128 - 4)) * 100}%` }}
          />
          <input
            type="range"
            min={4}
            max={128}
            step={1}
            value={settings.blurSize}
            onChange={(e) =>
              onChange({ ...settings, blurSize: Number(e.target.value) })
            }
            className="slider-input absolute inset-0 h-full w-full cursor-pointer appearance-none bg-transparent"
          />
        </div>
      </div>

      {/* ── Blur Intensity ── */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold uppercase tracking-widest text-theme-muted-foreground">
            Intensity
          </label>
          <span className="text-xs text-theme-foreground tabular-nums">
            {settings.blurIntensity}px
          </span>
        </div>

        <div className="relative h-2 w-full rounded-full bg-theme-muted">
          <div
            className="absolute h-full rounded-full bg-gradient-to-r from-theme-primary to-theme-chart4"
            style={{ width: `${((settings.blurIntensity - 1) / 19) * 100}%` }}
          />
          <input
            type="range"
            min={1}
            max={20}
            step={1}
            value={settings.blurIntensity}
            onChange={(e) =>
              onChange({ ...settings, blurIntensity: Number(e.target.value) })
            }
            className="slider-input absolute inset-0 h-full w-full cursor-pointer appearance-none bg-transparent"
          />
        </div>
      </div>

      {/* ── Info hint ── */}
      <p className="text-[10px] text-theme-muted-foreground leading-relaxed">
        Click and drag on the image to blur. Uses WASM Gaussian blur for fast
        per-pixel processing.
      </p>
    </div>
  );
}
