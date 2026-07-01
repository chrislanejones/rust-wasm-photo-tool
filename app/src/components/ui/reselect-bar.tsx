import { forwardRef, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * A full-width, clickable "reselect" bar — a labelled row with a trailing ✕
 * delete affordance — extracted from the History/Reselect list so the same look
 * (token colours, height, hover, hover-revealed ✕) is the single source of
 * truth wherever we list re-selectable things (placed text/shapes, guides…).
 *
 * Visual: reuses the existing `.large-badge-item .type-redo` / `.history-dot` /
 * `.large-badge` / `.history-delete` classes (styles.css), plus an
 * `.is-selected` highlight for lists that keep a persistent selection.
 *
 * a11y: the bar is a `role="button"` (Enter/Space → select; Delete/Backspace →
 * delete when focused); the ✕ is a real `<button>` with an `aria-label` that
 * stops propagation so deleting never also selects.
 */
export interface ReselectBarProps {
  /** Row label (text/shape name, "H · 120px", …). */
  label: ReactNode;
  /** Persistent-selection highlight (lists without selection just omit it). */
  selected?: boolean;
  onSelect: () => void;
  onDelete: () => void;
  disabled?: boolean;
  /** Title/tooltip for the row. */
  title?: string;
  /** aria-label for the ✕ button. Default "Delete". */
  deleteLabel?: string;
  className?: string;
}

const DeleteGlyph = () => (
  <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M2 2l8 8M10 2l-8 8" />
  </svg>
);

export const ReselectBar = forwardRef<HTMLDivElement, ReselectBarProps>(
  (
    {
      label,
      selected = false,
      onSelect,
      onDelete,
      disabled = false,
      title,
      deleteLabel = "Delete",
      className,
    },
    ref,
  ) => {
    const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
      if (disabled) return;
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onSelect();
      } else if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        onDelete();
      }
    };

    return (
      <div
        ref={ref}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-pressed={selected}
        aria-disabled={disabled || undefined}
        title={title}
        onClick={disabled ? undefined : onSelect}
        onKeyDown={onKeyDown}
        className={cn(
          "large-badge-item type-redo",
          selected && "is-selected",
          disabled && "is-disabled",
          className,
        )}
      >
        <span className="history-dot" />
        <span className="large-badge">{label}</span>
        <button
          type="button"
          className="history-delete"
          aria-label={deleteLabel}
          disabled={disabled}
          onClick={(e) => {
            e.stopPropagation();
            if (!disabled) onDelete();
          }}
        >
          <DeleteGlyph />
        </button>
      </div>
    );
  },
);
ReselectBar.displayName = "ReselectBar";
