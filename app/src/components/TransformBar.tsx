import React, { useState } from "react";

interface Props {
  disabled: boolean;
  onFlipH: () => void;
  onFlipV: () => void;
  onRotate90Cw: () => void;
  onBrightness: (delta: number) => void;
  onContrast: (factor: number) => void;
}

export const TransformBar: React.FC<Props> = ({
  disabled,
  onFlipH,
  onFlipV,
  onRotate90Cw,
  onBrightness,
  onContrast,
}) => {
  // Sliders hold *pending* values; changes are committed on pointerUp
  // so each drag gesture produces one undo entry instead of hundreds.
  const [brightness, setBrightness] = useState(0); // −100 … +100
  const [contrast, setContrast] = useState(100); //   0 … 400 (100 = no change)

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

  return (
    <div className="transform-bar">
      {/* ── Geometry ──────────────────────────────────────────────────── */}
      <div className="transform-group">
        <span className="transform-label">Transform</span>

        <button
          className="btn-icon"
          onClick={onFlipH}
          disabled={disabled}
          title="Flip horizontal"
        >
          {/* left-right arrow */}
          <svg
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path d="M8 2v12" strokeDasharray="2 1.5" />
            <path d="M2 8l3-3v2h2V5l-3-3" />
            <path d="M14 8l-3-3v2h-2V5l3-3" />
          </svg>
        </button>

        <button
          className="btn-icon"
          onClick={onFlipV}
          disabled={disabled}
          title="Flip vertical"
        >
          {/* up-down arrow */}
          <svg
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path d="M2 8h12" strokeDasharray="2 1.5" />
            <path d="M8 2l3 3h-2v2H11l3-3" />
            <path d="M8 14l3-3h-2v-2H11l3 3" />
          </svg>
        </button>

        <button
          className="btn-icon"
          onClick={onRotate90Cw}
          disabled={disabled}
          title="Rotate 90° clockwise"
        >
          <svg
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path d="M13 5A6 6 0 103 11" />
            <path d="M13 2v3h-3" />
          </svg>
        </button>
      </div>

      <div className="toolbar-divider" />

      {/* ── Brightness ────────────────────────────────────────────────── */}
      <div className="transform-group">
        <label className="toolbar-label" title="Drag, then release to commit">
          {/* sun icon */}
          <svg
            viewBox="0 0 14 14"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            style={{ width: 12, height: 12, flexShrink: 0 }}
          >
            <circle cx="7" cy="7" r="2.5" />
            <path d="M7 1v1.5M7 11.5V13M1 7h1.5M11.5 7H13M2.5 2.5l1 1M10.5 10.5l1 1M11.5 2.5l-1 1M3.5 10.5l-1 1" />
          </svg>
          <input
            type="range"
            className="toolbar-range"
            min={-100}
            max={100}
            step={1}
            value={brightness}
            disabled={disabled}
            onChange={(e) => setBrightness(Number(e.target.value))}
            onPointerUp={commitBrightness}
          />
          <span className="toolbar-value" style={{ minWidth: "3ch" }}>
            {brightness > 0 ? `+${brightness}` : brightness}
          </span>
        </label>
      </div>

      <div className="toolbar-divider" />

      {/* ── Contrast ──────────────────────────────────────────────────── */}
      <div className="transform-group">
        <label className="toolbar-label" title="Drag, then release to commit">
          {/* circle-half icon */}
          <svg
            viewBox="0 0 14 14"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            style={{ width: 12, height: 12, flexShrink: 0 }}
          >
            <circle cx="7" cy="7" r="5.5" />
            <path d="M7 1.5v11" />
            <path
              d="M7 2.5A4.5 4.5 0 017 11.5"
              fill="currentColor"
              stroke="none"
            />
          </svg>
          <input
            type="range"
            className="toolbar-range"
            min={0}
            max={300}
            step={1}
            value={contrast}
            disabled={disabled}
            onChange={(e) => setContrast(Number(e.target.value))}
            onPointerUp={commitContrast}
          />
          <span className="toolbar-value" style={{ minWidth: "3ch" }}>
            {contrast}%
          </span>
        </label>
      </div>
    </div>
  );
};
