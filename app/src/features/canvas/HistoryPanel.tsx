import { motion } from "framer-motion";
import type { HistoryEntry } from "@/hooks/useCloneStamp";

interface Props {
  history: HistoryEntry[];
  onJump: (index: number) => void;
  onDelete: (index: number) => void;
  onClear: () => void;
  onClose: () => void;
}

export function HistoryPanel({
  history,
  onJump,
  onDelete,
  onClear,
  onClose,
}: Props) {
  return (
    <motion.aside
      initial={{ x: "100%", opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: "100%", opacity: 0 }}
      transition={{ type: "spring", damping: 25, stiffness: 200 }}
      className="history-panel"
    >
      <div className="panel-header">
        <span className="panel-title">History</span>
        <span className="panel-count">{history.length}</span>
        <button
          className="btn-icon"
          onClick={onClear}
          title="Clear history"
          style={{ marginLeft: "auto" }}
        >
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M2 4h12M5 4V2h6v2M6 7v5M10 7v5M3 4l1 9h8l1-9" />
          </svg>
        </button>
        <button
          className="btn-icon"
          onClick={onClose}
          title="Close history"
        >
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M4 4l8 8M12 4l-8 8" />
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
                <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M2 2l8 8M10 2l-8 8" />
                </svg>
              </button>
            )}
          </li>
        ))}
      </ul>
    </motion.aside>
  );
}
