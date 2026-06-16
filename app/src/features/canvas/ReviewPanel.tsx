import { useState } from "react";
import { motion } from "framer-motion";
import {
  History,
  Layers,
  MousePointerSquareDashed,
  Plus,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import { slideFromRight } from "@/lib/animations";
import { TinyButton } from "@/components/ui/tiny-button";
import { TinyNumberBox } from "@/components/ui/tiny-number-box";
import { ToggleButtonGroup } from "@/components/ui/toggle-button-group";
import { TIERS } from "@/lib/tiers";
import type { UserMode } from "@/components/StatusBar";
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

/** The three toggleable body sections of the Review panel. */
type SectionKey = "history" | "reselect" | "layers";

interface Props {
  history: HistoryEntry[];
  onJump: (index: number) => void;
  onDelete: (index: number) => void;
  onClose: () => void;
  /** Undo button in the History section header. */
  onUndo: () => void;
  canUndo: boolean;
  /** Live placed objects (text + shapes) for the Reselect list. */
  objects: ReselectObject[];
  /** Click an object → load it into the canvas edit overlay to move/resize. */
  onSelectObject: (o: ReselectObject) => void;
  /** Hover-X → delete that object. */
  onDeleteObject: (o: ReselectObject) => void;
  /** Current effective tier — drives the Layers section's allowance. */
  userMode: UserMode;
}

const DeleteGlyph = () => (
  <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M2 2l8 8M10 2l-8 8" />
  </svg>
);

const TOGGLES: { key: SectionKey; icon: typeof History; label: string }[] = [
  { key: "history", icon: History, label: "History" },
  { key: "reselect", icon: MousePointerSquareDashed, label: "Reselect" },
  { key: "layers", icon: Layers, label: "Layers" },
];

export function ReviewPanel({
  history,
  onJump,
  onDelete,
  onClose,
  onUndo,
  canUndo,
  objects,
  onSelectObject,
  onDeleteObject,
  userMode,
}: Props) {
  // Which body sections are open. The body splits its height evenly among the
  // open sections (1 → full, 2 → halves, 3 → thirds), each with its own header
  // and scroll area. All three start open.
  const [open, setOpen] = useState<Record<SectionKey, boolean>>({
    history: true,
    reselect: true,
    layers: true,
  });
  const toggle = (k: SectionKey) =>
    setOpen((prev) => ({ ...prev, [k]: !prev[k] }));
  const openCount = TOGGLES.filter((t) => open[t.key]).length;

  return (
    <motion.aside
      variants={slideFromRight}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="review-panel"
    >
      {/* ── Panel header: title + close ─────────────────────────────────── */}
      <div className="review-head">
        <span className="review-title">Review</span>
        <TinyButton onClick={onClose} title="Close" className="ml-auto">
          <X className="h-4 w-4" />
        </TinyButton>
      </div>
      <hr className="review-rule" />

      {/* ── Section toggles — same multi-select button group the top bar
          uses for Upload / Tools / Gallery. ───────────────────────────── */}
      <div className="review-toggles">
        <ToggleButtonGroup
          fill
          noIcons
          items={TOGGLES.map(({ key, icon, label }) => ({
            key,
            icon,
            label,
            active: open[key],
            onToggle: () => toggle(key),
          }))}
        />
      </div>

      {/* ── Body: open sections share the height; each scrolls ──────────── */}
      <div className="review-body">
        {openCount === 0 && (
          <div className="review-empty">
            <span className="large-badge">Toggle a section above</span>
          </div>
        )}

        {open.history && (
          <section className="review-section">
            <div className="review-section-head">
              <History className="h-3.5 w-3.5" />
              <span className="review-section-name">History</span>
              <div className="ml-auto flex items-center gap-1.5">
                <TinyButton onClick={onUndo} disabled={!canUndo} title="Undo">
                  <Undo2 className="h-3.5 w-3.5" />
                </TinyButton>
                <TinyNumberBox>{history.length}</TinyNumberBox>
              </div>
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
          </section>
        )}

        {/* ── Reselect: live placed objects (text + shapes) ───────────────
            Click a row to load it back into the canvas edit overlay (move /
            resize / re-angle); hover the X to delete it. */}
        {open.reselect && (
          <section className="review-section">
            <div className="review-section-head">
              <MousePointerSquareDashed className="h-3.5 w-3.5" />
              <span className="review-section-name">Reselect</span>
              <div className="ml-auto flex items-center gap-1.5">
                <TinyNumberBox>{objects.length}</TinyNumberBox>
                <TinyButton
                  onClick={() => toggle("reselect")}
                  title="Close section"
                >
                  <X className="h-4 w-4" />
                </TinyButton>
              </div>
            </div>
            <ul className="history-list reselect-list">
              {objects.length === 0 && (
                <li className="history-empty">
                  <span className="large-badge">
                    Add text or a shape to reselect it
                  </span>
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
          </section>
        )}

        {/* ── Layers: placeholder (always 0 for now). ─────────────────────── */}
        {open.layers && (
          <section className="review-section">
            <div className="review-section-head">
              <Layers className="h-3.5 w-3.5" />
              <span className="review-section-name">Layers</span>
              <div className="ml-auto flex items-center gap-1.5">
                {/* Per-tier layer allowance (— / 3 / ∞) from the tier config. */}
                <TinyNumberBox title={`Layers per image: ${TIERS[userMode].layersLabel}`}>
                  {TIERS[userMode].layersShort}
                </TinyNumberBox>
                {/* Add / delete layer — disabled until Layers ships. */}
                <TinyButton disabled title="Add layer (coming soon)">
                  <Plus className="h-3.5 w-3.5" />
                </TinyButton>
                <TinyButton disabled title="Delete layer (coming soon)">
                  <Trash2 className="h-3.5 w-3.5" />
                </TinyButton>
                <TinyButton
                  onClick={() => toggle("layers")}
                  title="Close section"
                >
                  <X className="h-4 w-4" />
                </TinyButton>
              </div>
            </div>
            <div className="review-coming-soon">
              <span className="large-badge">Coming soon</span>
            </div>
          </section>
        )}
      </div>
    </motion.aside>
  );
}
