import React, { useRef } from "react";
import type { CloneStampState } from "../hooks/useCloneStamp";

interface Props {
  state: CloneStampState;
  brushSize: number;
  hardness: number;
  opacity: number;
  onFileChange: (file: File) => void;
  onPhotosAdd?: (files: File[]) => void;
  onBrushSizeChange: (v: number) => void;
  onHardnessChange: (v: number) => void;
  onOpacityChange: (v: number) => void;
  onUndo: () => void;
  onRedo: () => void;
  onExport: () => void;
}

export const Toolbar: React.FC<Props> = ({
  state,
  brushSize,
  hardness,
  opacity,
  onFileChange,
  onPhotosAdd,
  onBrushSizeChange,
  onHardnessChange,
  onOpacityChange,
  onUndo,
  onRedo,
  onExport,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []).filter((f) =>
      f.type.startsWith("image/"),
    );
    if (files.length === 0) return;

    if (onPhotosAdd) {
      // Multi-photo path: hand all files to the strip handler
      onPhotosAdd(files);
    } else {
      // Fallback: single-file behaviour
      onFileChange(files[0]);
    }

    // Reset so the same file(s) can be re-selected
    e.target.value = "";
  };

  return (
    <header className="toolbar">
      <span className="toolbar-logo">
        clone<span>stamp</span>
      </span>
      <div className="toolbar-divider" />

      {/* ── Open / add photos ──────────────────────────────────────────── */}
      <button
        className="upload-btn"
        onClick={() => fileInputRef.current?.click()}
        title="Open one or more images"
      >
        {/* image icon */}
        <svg
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          style={{
            width: 14,
            height: 14,
            marginRight: 5,
            verticalAlign: "middle",
          }}
        >
          <rect x="1" y="3" width="14" height="10" rx="1.5" />
          <circle cx="5.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
          <path d="M1 10.5l3.5-3 3 3 2.5-2.5L15 11" />
        </svg>
        Open Images
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: "none" }}
        onChange={handleFileChange}
      />

      <div className="toolbar-divider" />

      {/* ── Undo / Redo ────────────────────────────────────────────────── */}
      <button
        className="btn-icon"
        onClick={onUndo}
        disabled={state.undoCount === 0}
        title="Undo (Ctrl+Z)"
      >
        <svg
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="M3 7H10a3 3 0 010 6H7" />
          <path d="M5 4L2 7l3 3" />
        </svg>
      </button>
      <button
        className="btn-icon"
        onClick={onRedo}
        disabled={state.redoCount === 0}
        title="Redo (Ctrl+Shift+Z)"
      >
        <svg
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="M13 7H6a3 3 0 000 6h3" />
          <path d="M11 4l3 3-3 3" />
        </svg>
      </button>

      <div className="toolbar-divider" />

      {/* ── Brush Size ─────────────────────────────────────────────────── */}
      <label className="toolbar-label">
        Size
        <input
          type="range"
          min={2}
          max={200}
          value={brushSize}
          onChange={(e) => onBrushSizeChange(Number(e.target.value))}
          className="toolbar-range"
        />
        <span className="toolbar-value">{brushSize}</span>
      </label>

      {/* ── Hardness ───────────────────────────────────────────────────── */}
      <label className="toolbar-label">
        Hard
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(hardness * 100)}
          onChange={(e) => onHardnessChange(Number(e.target.value) / 100)}
          className="toolbar-range"
        />
        <span className="toolbar-value">{Math.round(hardness * 100)}%</span>
      </label>

      {/* ── Opacity ────────────────────────────────────────────────────── */}
      <label className="toolbar-label">
        Opacity
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(opacity * 100)}
          onChange={(e) => onOpacityChange(Number(e.target.value) / 100)}
          className="toolbar-range"
        />
        <span className="toolbar-value">{Math.round(opacity * 100)}%</span>
      </label>

      <div className="toolbar-divider" style={{ marginLeft: "auto" }} />

      {/* ── Export ─────────────────────────────────────────────────────── */}
      <button
        className="btn-icon"
        onClick={onExport}
        disabled={!state.ready}
        title="Export PNG"
      >
        <svg
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="M8 2v8M5 7l3 3 3-3" />
          <path d="M2 11v2a1 1 0 001 1h10a1 1 0 001-1v-2" />
        </svg>
      </button>
    </header>
  );
};
