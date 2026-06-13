import { motion } from "framer-motion";
import { History, MousePointerSquareDashed, RotateCcw, X } from "lucide-react";
import { slideFromRight } from "@/lib/animations";
import { TinyButton } from "@/components/ui/tiny-button";
import { TinyNumberBox } from "@/components/ui/tiny-number-box";
import type { HistoryEntry } from "@/hooks/useCloneStamp";

/** One placed object shown in the Reselect list (text or shape annotation). */
export interface ReselectObject {
  /** Stable React key, e.g. `t12` / `s7`. */
  key: string;
  type: "text" | "shape";
  /** Annotation id within its own (text vs shape) id-space. */
  id: number;
  /** Display name, e.g. "Text #1", "Square #1", "Line #2". */
  label: string;
}

interface Props {
  history: HistoryEntry[];
  onJump: (index: number) => void;
  onDelete: (index: number) => void;
  onClear: () => void;
  onClose: () => void;
  /** Live placed objects (text + shapes) for the Reselect list. */
  objects: ReselectObject[];
  /** Click an object → load it into the canvas edit overlay to move/resize. */
  onSelectObject: (o: ReselectObject) => void;
  /** Hover-X → delete that object. */
  onDeleteObject: (o: ReselectObject) => void;
}

const DeleteGlyph = () => (
  <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M2 2l8 8M10 2l-8 8" />
  </svg>
);

export function HistoryPanel({
  history,
  onJump,
  onDelete,
  onClear,
  onClose,
  objects,
  onSelectObject,
  onDeleteObject,
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
        <h2 className="flex items-center gap-2 text-xs font-semibold">
          <History className="h-3.5 w-3.5" />
          History
        </h2>
        <TinyNumberBox>{history.length}</TinyNumberBox>
        <TinyButton
          onClick={onClear}
          title="Clear history"
          disabled={history.length === 0}
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </TinyButton>
        <TinyButton onClick={onClose} title="Close history" className="ml-auto">
          <X className="h-4 w-4" />
        </TinyButton>
      </div>
      <ul className="history-list">
        {history.length === 0 && (
          <li className="history-empty">
            <span className="large-badge">No history yet</span>
          </li>
        )}
        {history.map((entry, listIdx) => (
          // FIX: compound key so identical entry.index values across
          // re-renders never collide (seen when redo stack rebuilds).
          <li
            key={`${entry.type}-${entry.index}-${listIdx}`}
            className={`large-badge-item type-${entry.type}`}
            role="button"
            tabIndex={0}
            onClick={() => onJump(entry.index)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onJump(entry.index);
              } else if (e.key === "Delete" && entry.type === "undo") {
                e.preventDefault();
                onDelete(entry.index);
              }
            }}
            title={
              entry.type === "current"
                ? "Current state"
                : `Jump to: ${entry.label}`
            }
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
                <DeleteGlyph />
              </button>
            )}
          </li>
        ))}
      </ul>

      {/* ── Reselect: live placed objects (text + shapes) ───────────────
          Bottom half of the panel. Click a row to load it back into the
          canvas edit overlay (move / resize / re-angle); hover the X to
          delete it. Replaces the old Recent Texts list. */}
      <div className="reselect-section">
        <div className="reselect-header">
          <MousePointerSquareDashed className="h-3.5 w-3.5" />
          <span>Reselect</span>
          <TinyNumberBox className="ml-auto">{objects.length}</TinyNumberBox>
        </div>
        <ul className="history-list reselect-list">
          {objects.length === 0 && (
            <li className="history-empty">
              <span className="large-badge">Add text or a shape to reselect it</span>
            </li>
          )}
          {objects.map((o) => (
            <li
              key={o.key}
              className="large-badge-item type-redo"
              role="button"
              tabIndex={0}
              onClick={() => onSelectObject(o)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelectObject(o);
                } else if (e.key === "Delete" || e.key === "Backspace") {
                  e.preventDefault();
                  onDeleteObject(o);
                }
              }}
              title={`Reselect ${o.label}`}
            >
              <span className="history-dot" />
              <span className="large-badge">{o.label}</span>
              <button
                className="history-delete"
                title={`Delete ${o.label}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteObject(o);
                }}
              >
                <DeleteGlyph />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </motion.aside>
  );
}
