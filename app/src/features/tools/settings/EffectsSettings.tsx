// ===== FILE: app/src/features/tools/settings/EffectsSettings.tsx =====
// Item 7: Replaces BlurSettings. Adds brightness + contrast using Rust WASM.
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sun, Contrast } from "lucide-react";
import type { ToolSettings } from "@/lib/types";
import { TabGroup } from "@/components/TabGroup";
import { quickSpring } from "@/lib/animations";

const SIZE_PRESETS = [8, 16, 32, 64] as const;

interface EffectsSettingsProps {
  settings: ToolSettings;
  onChange: (settings: ToolSettings) => void;
  onBrightness: (delta: number) => void;
  onContrast: (factor: number) => void;
  imageReady: boolean;
}

type EffectsMode = "effects" | "blur";

export function EffectsSettings({
  settings,
  onChange,
  onBrightness,
  onContrast,
  imageReady,
}: EffectsSettingsProps) {
  const [mode, setMode] = useState<EffectsMode>("effects");
  const [brightness, setBrightness] = useState(0);
  const [contrast, setContrast] = useState(100);

  const commitBrightness = (v: number) => {
    if (v !== 0) {
      onBrightness(v / 100);
      setBrightness(0);
    }
  };

  const commitContrast = (v: number) => {
    if (v !== 100) {
      onContrast(v / 100);
      setContrast(100);
    }
  };

  return (
    <div className="space-y-8">
      <TabGroup
        tabs={[
          { id: "effects", label: "Effects" },
          { id: "blur", label: "Blur Brush" },
        ]}
        active={mode}
        onChange={(id) => setMode(id as EffectsMode)}
      />

      {/* ── Tab panels — animate on switch ── */}
      <AnimatePresence mode="wait">
      {/* ── Effects panel ── */}
      {mode === "effects" && (
        <motion.div
          key="effects"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0, transition: quickSpring }}
          exit={{ opacity: 0, y: -8, transition: { duration: 0.12 } }}
          className="space-y-8"
        >
          {/* ── Brightness (Rust WASM) ── */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Sun className="h-3.5 w-3.5 text-theme-muted-foreground" />
              <span className="text-xs font-bold uppercase tracking-widest text-theme-muted-foreground flex-1">
                Brightness
              </span>
              <span className="text-xs text-theme-foreground min-w-[3.5ch] text-right tabular-nums">
                {brightness > 0 ? `+${brightness}` : brightness}
              </span>
            </div>
            <div className="relative h-2 w-full rounded-full bg-theme-muted">
              <div
                className="absolute h-full rounded-full bg-gradient-to-r from-theme-primary to-theme-chart4"
                style={{ width: `${((brightness + 100) / 200) * 100}%` }}
              />
              <input
                type="range"
                min={-100}
                max={100}
                step={1}
                value={brightness}
                disabled={!imageReady}
                onChange={(e) => setBrightness(Number(e.target.value))}
                onPointerUp={(e) =>
                  commitBrightness(Number((e.target as HTMLInputElement).value))
                }
                className="slider-input absolute inset-0 h-full w-full cursor-pointer appearance-none bg-transparent"
              />
            </div>
            <p className="text-[9px] text-theme-muted-foreground">
              Drag and release — processes in Rust. Each adjustment is
              undo-able.
            </p>
          </div>

          {/* ── Contrast (Rust WASM) ── */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Contrast className="h-3.5 w-3.5 text-theme-muted-foreground" />
              <span className="text-xs font-bold uppercase tracking-widest text-theme-muted-foreground flex-1">
                Contrast
              </span>
              <span className="text-xs text-theme-foreground min-w-[3.5ch] text-right tabular-nums">
                {contrast}%
              </span>
            </div>
            <div className="relative h-2 w-full rounded-full bg-theme-muted">
              <div
                className="absolute h-full rounded-full bg-gradient-to-r from-theme-primary to-theme-chart4"
                style={{ width: `${(contrast / 300) * 100}%` }}
              />
              <input
                type="range"
                min={0}
                max={300}
                step={1}
                value={contrast}
                disabled={!imageReady}
                onChange={(e) => setContrast(Number(e.target.value))}
                onPointerUp={(e) =>
                  commitContrast(Number((e.target as HTMLInputElement).value))
                }
                className="slider-input absolute inset-0 h-full w-full cursor-pointer appearance-none bg-transparent"
              />
            </div>
            <p className="text-[9px] text-theme-muted-foreground">
              100% = original. Processed via Rust adjust_contrast().
            </p>
          </div>
        </motion.div>
      )}

      {/* ── Blur Brush panel ── */}
      {mode === "blur" && (
        <motion.div
          key="blur"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0, transition: quickSpring }}
          exit={{ opacity: 0, y: -8, transition: { duration: 0.12 } }}
          className="space-y-8"
        >
          {/* ── Blur Size ── */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-widest text-theme-muted-foreground">
                Brush Size
              </label>
              <span className="text-xs text-theme-foreground tabular-nums">
                {settings.blurSize}px
              </span>
            </div>

            <div className="flex items-center justify-between py-2">
              {SIZE_PRESETS.map((size) => {
                const active = settings.blurSize === size;
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

            <div className="relative h-2 w-full rounded-full bg-theme-muted">
              <div
                className="absolute h-full rounded-full bg-gradient-to-r from-theme-primary to-theme-chart4"
                style={{
                  width: `${((settings.blurSize - 4) / (128 - 4)) * 100}%`,
                }}
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
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-widest text-theme-muted-foreground">
                Blur Intensity
              </label>
              <span className="text-xs text-theme-foreground tabular-nums">
                {settings.blurIntensity}px
              </span>
            </div>

            <div className="relative h-2 w-full rounded-full bg-theme-muted">
              <div
                className="absolute h-full rounded-full bg-gradient-to-r from-theme-primary to-theme-chart4"
                style={{
                  width: `${((settings.blurIntensity - 1) / 19) * 100}%`,
                }}
              />
              <input
                type="range"
                min={1}
                max={20}
                step={1}
                value={settings.blurIntensity}
                onChange={(e) =>
                  onChange({
                    ...settings,
                    blurIntensity: Number(e.target.value),
                  })
                }
                className="slider-input absolute inset-0 h-full w-full cursor-pointer appearance-none bg-transparent"
              />
            </div>
          </div>

          <p className="text-[10px] text-theme-muted-foreground leading-relaxed">
            Click and drag on the image to blur regions. Uses WASM separable
            Gaussian blur.
          </p>
        </motion.div>
      )}
      </AnimatePresence>
    </div>
  );
}
