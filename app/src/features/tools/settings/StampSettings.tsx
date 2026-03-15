import type { StampSettings } from "@/lib/types";

interface Props {
  settings: StampSettings;
  onChange: (s: StampSettings) => void;
  hasSource: boolean;
}

export function StampSettings({ settings, onChange, hasSource }: Props) {
  return (
    <div className="space-y-5">
      <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)] font-mono">
        Clone Stamp
      </h3>

      {/* Source status */}
      <div
        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-mono ${
          hasSource
            ? "bg-[var(--success-dim)] text-[var(--success)]"
            : "bg-[var(--bg-elevated)] text-[var(--text-muted)]"
        }`}
      >
        <span
          className={`w-2 h-2 rounded-full ${
            hasSource
              ? "bg-[var(--success)] shadow-[0_0_6px_rgba(34,197,94,0.5)]"
              : "bg-[var(--text-muted)]"
          }`}
        />
        {hasSource ? "Source set — click to paint" : "Alt+Click to set source"}
      </div>

      {/* Brush Size */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)] font-mono">
            Size
          </label>
          <span className="text-xs font-mono text-[var(--text-secondary)]">
            {settings.brushSize}px
          </span>
        </div>
        <input
          type="range"
          min={2}
          max={200}
          value={settings.brushSize}
          onChange={(e) =>
            onChange({ ...settings, brushSize: Number(e.target.value) })
          }
          className="w-full"
        />
      </div>

      {/* Hardness */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)] font-mono">
            Hardness
          </label>
          <span className="text-xs font-mono text-[var(--text-secondary)]">
            {Math.round(settings.hardness * 100)}%
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(settings.hardness * 100)}
          onChange={(e) =>
            onChange({
              ...settings,
              hardness: Number(e.target.value) / 100,
            })
          }
          className="w-full"
        />
      </div>

      {/* Opacity */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)] font-mono">
            Opacity
          </label>
          <span className="text-xs font-mono text-[var(--text-secondary)]">
            {Math.round(settings.opacity * 100)}%
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(settings.opacity * 100)}
          onChange={(e) =>
            onChange({
              ...settings,
              opacity: Number(e.target.value) / 100,
            })
          }
          className="w-full"
        />
      </div>
    </div>
  );
}
