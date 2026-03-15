import { useState } from "react";
import {
  FlipHorizontal,
  FlipVertical,
  RotateCw,
  Sun,
  Contrast,
} from "lucide-react";

interface Props {
  disabled: boolean;
  onFlipH: () => void;
  onFlipV: () => void;
  onRotate90Cw: () => void;
  onBrightness: (delta: number) => void;
  onContrast: (factor: number) => void;
}

export function TransformSettings({
  disabled,
  onFlipH,
  onFlipV,
  onRotate90Cw,
  onBrightness,
  onContrast,
}: Props) {
  const [brightness, setBrightness] = useState(0);
  const [contrast, setContrast] = useState(100);

  const commitBrightness = () => {
    if (brightness !== 0) {
      onBrightness(brightness / 100);
      setBrightness(0);
    }
  };

  const commitContrast = () => {
    if (contrast !== 100) {
      onContrast(contrast / 100);
      setContrast(100);
    }
  };

  const btnClass = `flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-medium transition-all
    bg-[var(--bg-elevated)] border border-[var(--border)] text-[var(--text-secondary)]
    hover:border-[var(--border-active)] hover:text-[var(--text-primary)]
    disabled:opacity-30 disabled:cursor-not-allowed`;

  return (
    <div className="space-y-5">
      <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)] font-mono">
        Transform
      </h3>

      {/* Geometry buttons */}
      <div className="grid grid-cols-3 gap-2">
        <button className={btnClass} onClick={onFlipH} disabled={disabled} title="Flip horizontal">
          <FlipHorizontal className="h-4 w-4" />
        </button>
        <button className={btnClass} onClick={onFlipV} disabled={disabled} title="Flip vertical">
          <FlipVertical className="h-4 w-4" />
        </button>
        <button className={btnClass} onClick={onRotate90Cw} disabled={disabled} title="Rotate 90° CW">
          <RotateCw className="h-4 w-4" />
        </button>
      </div>

      {/* Brightness */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Sun className="h-3.5 w-3.5 text-[var(--text-muted)]" />
          <label className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)] font-mono flex-1">
            Brightness
          </label>
          <span className="text-xs font-mono text-[var(--text-secondary)] min-w-[3ch] text-right">
            {brightness > 0 ? `+${brightness}` : brightness}
          </span>
        </div>
        <input
          type="range"
          min={-100}
          max={100}
          step={1}
          value={brightness}
          disabled={disabled}
          onChange={(e) => setBrightness(Number(e.target.value))}
          onPointerUp={commitBrightness}
          className="w-full"
        />
      </div>

      {/* Contrast */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Contrast className="h-3.5 w-3.5 text-[var(--text-muted)]" />
          <label className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)] font-mono flex-1">
            Contrast
          </label>
          <span className="text-xs font-mono text-[var(--text-secondary)] min-w-[3ch] text-right">
            {contrast}%
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={300}
          step={1}
          value={contrast}
          disabled={disabled}
          onChange={(e) => setContrast(Number(e.target.value))}
          onPointerUp={commitContrast}
          className="w-full"
        />
      </div>
    </div>
  );
}
