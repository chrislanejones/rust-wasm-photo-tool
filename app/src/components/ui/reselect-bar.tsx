import { forwardRef, type KeyboardEvent, type ReactNode } from "react";
import { Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import { ChevronGlyph, DeleteGlyph, RowAction } from "@/components/ui/row-actions";

/**
 * A full-width, clickable "reselect" bar — a labeled row with an optional
 * trailing ✕ delete affordance — extracted from the History/Reselect list so
 * the same look (token colors, height, hover, hover-revealed ✕) is the single
 * source of truth wherever we list re-selectable things (History entries,
 * placed text/shapes, guides…).
 *
 * Two variants: pass `onDelete` for a deletable row (Reselect, guides, undo-
 * type History entries); omit it for a plain jump-to-state row with no ✕
 * (History's "current"/"redo" entries).
 *
 * Visual: reuses the existing `.full-width-badge .type-*` / `.large-badge` /
 * `.history-delete` classes (styles.css), plus an `.is-selected` highlight
 * for lists that keep a persistent selection.
 *
 * The colored dot is gone (2026-09-11): the leading slot is the INDEX, and a
 * dot beside a number said the same thing twice. `type-*` still colors the
 * row itself, so the state it carried is not lost.
 *
 * Trailing buttons live in one `.row-actions` cluster, hidden until the row is
 * hovered OR focus enters it. The focus half is not optional — hover-only
 * reveal hides a focusable control from every keyboard user.
 *
 * a11y: the bar is a `role="button"` (Enter/Space → select; Delete/Backspace →
 * delete when a delete handler is present); the ✕ is a real `<button>` with an
 * `aria-label` that stops propagation so deleting never also selects.
 */
export interface ReselectBarProps {
  /** Row label (text/shape name, "H · 120px", a history step's label…). */
  label: ReactNode;
  /** Leading slot: a History step index, a Reselect ordinal, or — in `lg` —
   *  a layer's name. Omit to skip it. */
  index?: ReactNode;
  /** `lg` is the Layers list: a taller row whose leading slot carries a name
   *  rather than a number, and which may render `children` beneath itself. */
  size?: "sm" | "lg";
  /** Extra trailing buttons, rendered inside `.row-actions` BEFORE the
   *  built-in duplicate/delete. Lets a caller (Layers) bring its own without
   *  a second row component drifting away from this one. */
  actions?: ReactNode;
  /** Rendered below the row inside the same badge — the Layers opacity
   *  slider. It stays inside so it inherits the row's selected/hover state. */
  children?: ReactNode;
  /** Row color/dot variant — `.full-width-badge.type-*`. Default "redo". */
  type?: "undo" | "redo" | "current";
  current?: boolean;
  /** Persistent-selection highlight (lists without selection just omit it). */
  selected?: boolean;
  onSelect: () => void;
  /** Omit entirely for the no-✕ variant. */
  onDelete?: () => void;
  /** Duplicate affordance, rendered immediately BEFORE the ✕. Omit for rows
   *  that cannot be duplicated (History entries, guides) — only placed
   *  objects have a meaningful copy. */
  onDuplicate?: () => void;
  /** aria-label for the duplicate button. Default "Duplicate". */
  duplicateLabel?: string;
  disabled?: boolean;
  /** Title/tooltip for the row. */
  title?: string;
  /** aria-label for the ✕ button. Default "Delete". */
  deleteLabel?: string;
  /** Restack controls (▲ / ▼), shown only when provided — shape rows have a
   *  draw order, text rows do not. The handler receives `shiftKey` so a
   *  Shift-click can mean "all the way" (ADR-044, shape z-order). */
  onMoveUp?: (shiftKey: boolean) => void;
  onMoveDown?: (shiftKey: boolean) => void;
  /** False disables the matching arrow — the row is already at that end. */
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  /** aria-labels for the arrows (icon-only buttons need one — #64). */
  moveUpLabel?: string;
  moveDownLabel?: string;
  className?: string;
}

export const ReselectBar = forwardRef<HTMLDivElement, ReselectBarProps>(
  (
    {
      label,
      index,
      size = "sm",
      actions,
      children,
      type = "redo",
      current = false,
      selected = false,
      onSelect,
      onDelete,
      onDuplicate,
      disabled = false,
      title,
      deleteLabel = "Delete",
      duplicateLabel = "Duplicate",
      onMoveUp,
      onMoveDown,
      canMoveUp = true,
      canMoveDown = true,
      moveUpLabel = "Bring forward",
      moveDownLabel = "Send backward",
      className,
    },
    ref,
  ) => {
    const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
      if (disabled) return;
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onSelect();
      } else if ((e.key === "Delete" || e.key === "Backspace") && onDelete) {
        e.preventDefault();
        onDelete();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d" && onDuplicate) {
        // Keyboard parity with the ✕, which already answers Delete/Backspace.
        // An icon-only button that only works with a mouse is half a control.
        e.preventDefault();
        onDuplicate();
      }
    };

    return (
      <div
        ref={ref}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-pressed={selected}
        aria-current={current ? "step" : undefined}
        aria-disabled={disabled || undefined}
        title={title}
        onClick={disabled ? undefined : onSelect}
        onKeyDown={onKeyDown}
        className={cn(
          `full-width-badge type-${type}`,
          size === "lg" && "full-width-badge-lg",
          selected && "is-selected",
          disabled && "is-disabled",
          className,
        )}
      >
        {index !== undefined && <span className="history-index">{index}</span>}
        <span className="large-badge">{label}</span>
        <div className="row-actions">
          {actions}
          {onMoveUp && (
            <RowAction
              label={`${moveUpLabel} (Shift: to front)`}
              disabled={disabled || !canMoveUp}
              onClick={(e) => onMoveUp(e.shiftKey)}
            >
              <ChevronGlyph up />
            </RowAction>
          )}
          {onMoveDown && (
            <RowAction
              label={`${moveDownLabel} (Shift: to back)`}
              disabled={disabled || !canMoveDown}
              onClick={(e) => onMoveDown(e.shiftKey)}
            >
              <ChevronGlyph up={false} />
            </RowAction>
          )}
          {/* Duplicate then delete; delete stays rightmost, where it has
              always been. Reselect rows dropped both the d-pad and Duplicate
              for the canvas action bar (ShapeActionsOverlay); Layers keeps
              its Duplicate. */}
          {onDuplicate && (
            <RowAction
              icon={Copy}
              label={duplicateLabel}
              disabled={disabled}
              onClick={onDuplicate}
            />
          )}
          {onDelete && (
            <RowAction
              icon={DeleteGlyph}
              label={deleteLabel}
              disabled={disabled}
              onClick={onDelete}
            />
          )}
        </div>
        {children}
      </div>
    );
  },
);
ReselectBar.displayName = "ReselectBar";
