import { motion } from "framer-motion";
import { History, RotateCcw, X } from "lucide-react";
import { slideFromRight } from "@/lib/animations";
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
      variants={slideFromRight}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="history-panel"
    >
      <div className="panel-header">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <History className="h-4 w-4" />
          History
        </h2>
        <span className="panel-count">{history.length}</span>
        <button
          className="btn-icon"
          onClick={onClear}
          title="Clear history"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={onClose}
          title="Close history"
          className="ml-auto p-1.5 rounded-lg hover:bg-bg-elevated text-text-muted hover:text-text-primary transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <ul className="history-list">
        {history.map((entry) => (
          <li
            key={entry.index}
            className={`large-badge-item type-${entry.type}`}
            onClick={() => onJump(entry.index)}
          >
            <span className="history-dot" />
            <span className="history-index">{entry.index}</span>
            <span className="large-badge">{entry.label}</span>

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
    </motion.aside>
  );
}
