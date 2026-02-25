import React from "react";
import type { HistoryEntry } from "../hooks/useCloneStamp";

interface Props {
  history: HistoryEntry[];
  onJump: (index: number) => void;
  onDelete: (index: number) => void;
  onClear: () => void;
}

export const HistoryPanel: React.FC<Props> = ({
  history,
  onJump,
  onDelete,
  onClear,
}) => {
  return (
    <aside className="history-panel">
      <div className="panel-header">
        <span className="panel-title">History</span>
        <span className="panel-count">{history.length}</span>
        <button
          className="btn-icon"
          onClick={onClear}
          title="Clear history"
          style={{ marginLeft: "auto" }}
        >
          <svg
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path d="M2 4h12M5 4V2h6v2M6 7v5M10 7v5M3 4l1 9h8l1-9" />
          </svg>
        </button>
      </div>

      <ul className="history-list">
        {history.map((entry) => (
          <li
            key={entry.index}
            className={`history-item type-${entry.type}`}
            onClick={() => onJump(entry.index)}
          >
            <span className="history-dot" />
            <span className="history-index">{entry.index}</span>
            <span className="history-label">{entry.label}</span>

            {entry.type === "undo" && (
              <button
                className="history-delete"
                title="Delete entry"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(entry.index);
                }}
              >
                <svg
                  viewBox="0 0 12 12"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <path d="M2 2l8 8M10 2l-8 8" />
                </svg>
              </button>
            )}
          </li>
        ))}
      </ul>
    </aside>
  );
};
