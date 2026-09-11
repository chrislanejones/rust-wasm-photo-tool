import type { ComponentType, MouseEvent, ReactNode } from "react";
import { Button } from "@/components/ui/button";

/**
 * The trailing action buttons on a DENSE LIST ROW — Layers, Reselect, History,
 * guides. One definition so every list in the app spells "delete this row" the
 * same way.
 *
 * WHY THIS FILE EXISTS. `DeleteGlyph` was defined twice, identically, in
 * `ReviewPanel.tsx` and `reselect-bar.tsx`, and the two lists they drew also
 * disagreed on chrome: Layers rows used `<Button size="xs">` while Reselect
 * and History used bare `<button className="history-delete">`. Same job, three
 * spellings, and a change to one never reached the others.
 *
 * The glyphs are drawn rather than imported from lucide because they sit at
 * 12×12 beside each other and must share a stroke weight exactly; a lucide
 * icon at this size reads visibly heavier next to them. Icons that DO come
 * from lucide (Copy, GamepadDirectional) are passed in by the caller.
 */

/** ✕ — delete/remove this row. */
export const DeleteGlyph = () => (
  <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M2 2l8 8M10 2l-8 8" />
  </svg>
);

/** ▲ / ▼ — restack this row within its draw order. */
export const ChevronGlyph = ({ up }: { up: boolean }) => (
  <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d={up ? "M2.5 7.5L6 4l3.5 3.5" : "M2.5 4.5L6 8l3.5-3.5"} />
  </svg>
);

interface RowActionProps {
  /** Lucide component or one of the glyphs above. */
  icon?: ComponentType<{ className?: string }>;
  /** Pre-rendered glyph, when the icon takes props (ChevronGlyph). */
  children?: ReactNode;
  /** Native tooltip AND the accessible name — icon-only buttons need one. */
  label: string;
  disabled?: boolean;
  /** Toggle state for the few row actions that are modes rather than
   *  one-shots (the duplicate pad). Sets `aria-pressed` and the accent. */
  pressed?: boolean;
  /** Omit for a permanently-disabled placeholder. */
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void;
}

/**
 * One trailing button on a list row. Always `size="xs"` — the 20×20 dense-row
 * variant the Layers list already uses.
 *
 * ALWAYS STOPS PROPAGATION. Every list that uses these has a clickable row
 * behind the buttons, so without it "delete" or "duplicate" would also select
 * the row it just acted on.
 *
 * `label` fills both `title` and `aria-label` deliberately: these are
 * icon-only, and the guardrails ratchet counts unlabelled ones.
 */
export function RowAction({
  icon: Icon,
  children,
  label,
  disabled = false,
  pressed,
  onClick,
}: RowActionProps) {
  return (
    <Button
      size="xs"
      title={label}
      aria-label={label}
      disabled={disabled || !onClick}
      aria-pressed={pressed}
      className={pressed ? "text-theme-primary" : undefined}
      onClick={(e) => {
        e.stopPropagation();
        if (!disabled) onClick?.(e);
      }}
    >
      {Icon ? <Icon /> : children}
    </Button>
  );
}
