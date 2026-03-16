import type { StampSettings } from "@/lib/types";

/* ── Preset configs ──────────────────────────────────────────────────── */

const SIZE_PRESETS = [5, 20, 60, 120] as const;
const HARDNESS_PRESETS = [0, 33, 66, 100] as const;
const OPACITY_PRESETS = [25, 50, 75, 100] as const;

/* ── Reusable dot-preset row ─────────────────────────────────────────── */

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

/* ── Main component ──────────────────────────────────────────────────── */

interface Props {
  settings: StampSettings;
  onChange: (s: StampSettings) => void;
  hasSource: boolean;
}

export function StampSettings({ settings, onChange, hasSource }: Props) {
  return (
    <div className="space-y-5">
      <h3 className="text-xs font-bold uppercase tracking-widest text-theme-muted-foreground">
        Clone Stamp
      </h3>

      {/* Source indicator */}
      <div
        className={[
          "flex items-center gap-2 px-3 py-2 rounded-lg text-xs",
          hasSource
            ? "bg-emerald-500/10 text-emerald-400"
            : "bg-theme-accent text-theme-muted-foreground",
        ].join(" ")}
      >
        <span
          className={[
            "w-2 h-2 rounded-full shrink-0",
            hasSource
              ? "bg-emerald-400 shadow-[0_0_6px_rgba(34,197,94,0.5)]"
              : "bg-theme-muted-foreground",
          ].join(" ")}
        />
        {hasSource ? "Source set — click to paint" : "Alt+Click to set source"}
      </div>

      {/* ── Brush Size ────────────────────────────────────────────── */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold uppercase tracking-widest text-theme-muted-foreground">
            Size
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
            const dotSize = preset <= 5 ? 2 : preset <= 20 ? 4 : preset <= 60 ? 6 : 8;
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
            style={{ width: `${((settings.brushSize - 2) / (200 - 2)) * 100}%` }}
          />
          <input
            type="range"
            min={2}
            max={200}
            step={1}
            value={settings.brushSize}
            onChange={(e) => onChange({ ...settings, brushSize: Number(e.target.value) })}
            className="slider-input absolute inset-0 h-full w-full cursor-pointer appearance-none bg-transparent"
          />
        </div>
      </div>

      {/* ── Hardness ──────────────────────────────────────────────── */}
      <div className="space-y-2.5">
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
            const dotSize = preset <= 0 ? 2 : preset <= 33 ? 4 : preset <= 66 ? 6 : 8;
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
            style={{ width: `${Math.round(settings.hardness * 100)}%` }}
          />
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={Math.round(settings.hardness * 100)}
            onChange={(e) => onChange({ ...settings, hardness: Number(e.target.value) / 100 })}
            className="slider-input absolute inset-0 h-full w-full cursor-pointer appearance-none bg-transparent"
          />
        </div>
      </div>

      {/* ── Opacity ───────────────────────────────────────────────── */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold uppercase tracking-widest text-theme-muted-foreground">
            Opacity
          </label>
          <span className="text-xs text-theme-foreground tabular-nums">
            {Math.round(settings.opacity * 100)}%
          </span>
        </div>

        <DotRow
          presets={OPACITY_PRESETS}
          value={Math.round(settings.opacity * 100)}
          onSelect={(v) => onChange({ ...settings, opacity: v / 100 })}
          dot={(preset) => {
            const dotSize = preset <= 25 ? 2 : preset <= 50 ? 4 : preset <= 75 ? 6 : 8;
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
            style={{ width: `${Math.round(settings.opacity * 100)}%` }}
          />
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={Math.round(settings.opacity * 100)}
            onChange={(e) => onChange({ ...settings, opacity: Number(e.target.value) / 100 })}
            className="slider-input absolute inset-0 h-full w-full cursor-pointer appearance-none bg-transparent"
          />
        </div>
      </div>
    </div>
  );
}
