import React, { useRef } from "react";
import type { CloneStampState } from "../hooks/useCloneStamp";

interface Props {
    state: CloneStampState;
    brushSize: number;
    hardness: number;
    opacity: number;
    onFileChange: (file: File) => void;
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
    onBrushSizeChange,
    onHardnessChange,
    onOpacityChange,
    onUndo,
    onRedo,
    onExport,
}) => {
    const fileInputRef = useRef<HTMLInputElement>(null);

    return (
        <header className="toolbar">
            <span className="toolbar-logo">
                clone<span>stamp</span>
            </span>

            <div className="toolbar-divider" />

            <button
                className="upload-btn"
                onClick={() => fileInputRef.current?.click()}
            >
                Open Image
            </button>
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) onFileChange(file);
                    e.target.value = "";
                }}
            />

            <div className="toolbar-divider" />

            <div className="toolbar-group">
                <span className="toolbar-label">Size</span>
                <input
                    type="range"
                    min={2}
                    max={200}
                    value={brushSize}
                    onChange={(e) => onBrushSizeChange(Number(e.target.value))}
                />
                <span className="toolbar-value">{brushSize}</span>
            </div>

            <div className="toolbar-group">
                <span className="toolbar-label">Hardness</span>
                <input
                    type="range"
                    min={0}
                    max={100}
                    value={Math.round(hardness * 100)}
                    onChange={(e) =>
                        onHardnessChange(Number(e.target.value) / 100)
                    }
                />
                <span className="toolbar-value">
                    {Math.round(hardness * 100)}%
                </span>
            </div>

            <div className="toolbar-group">
                <span className="toolbar-label">Opacity</span>
                <input
                    type="range"
                    min={0}
                    max={100}
                    value={Math.round(opacity * 100)}
                    onChange={(e) =>
                        onOpacityChange(Number(e.target.value) / 100)
                    }
                />
                <span className="toolbar-value">
                    {Math.round(opacity * 100)}%
                </span>
            </div>

            <div className="toolbar-divider" />

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
                    <path d="M3 7H11C13 7 14 8 14 10C14 12 13 13 11 13H8" />
                    <path d="M6 4L3 7L6 10" />
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
                    <path d="M13 7H5C3 7 2 8 2 10C2 12 3 13 5 13H8" />
                    <path d="M10 4L13 7L10 10" />
                </svg>
            </button>

            <div className="toolbar-divider" />

            <div className="toolbar-group">
                <span className="toolbar-label">Zoom</span>
                <span className="toolbar-value">
                    {state.zoom.toFixed(1)}&times;
                </span>
            </div>

            <div
                className={`toolbar-status${state.hasSource ? " has-source" : ""}`}
            >
                {state.hasSource ? "Source set" : "Alt+Click to set source"}
            </div>

            {state.ready && (
                <button className="upload-btn" onClick={onExport}>
                    Export PNG
                </button>
            )}
        </header>
    );
};