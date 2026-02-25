// app/src/components/StatusBar.tsx
import React from "react";
import type { CloneStampState } from "../hooks/useCloneStamp";

interface Props {
  state: CloneStampState;
}

export const StatusBar: React.FC<Props> = ({ state }) => {
  return (
    <footer className="status-bar">
      <div className="status-section">
        <span
          className={`source-status ${state.hasSource ? "has-source" : ""}`}
        >
          <span className="status-dot" />
          {state.hasSource
            ? "Source set — click to paint"
            : "Alt + Click to set source point"}
        </span>
      </div>
      <div className="status-section status-center">
        <span className="status-shortcut-hint">
          <kbd>Alt</kbd>+<kbd>Click</kbd> set source
        </span>
        <span className="status-divider" />
        <span className="status-shortcut-hint">
          <kbd>Alt</kbd>+<kbd>Scroll</kbd> zoom
        </span>
        <span className="status-divider" />
        <span className="status-shortcut-hint">
          <kbd>Ctrl</kbd>+<kbd>Z</kbd> undo
        </span>
      </div>
      <div className="status-section status-right">
        <span className="status-zoom">
          {Math.round(state.zoom * 100)}%
        </span>
      </div>
    </footer>
  );
};