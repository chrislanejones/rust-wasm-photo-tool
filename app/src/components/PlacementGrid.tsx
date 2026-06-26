// A 3×3 placement grid — nine full-width buttons, one per cell of a 3×3 grid
// over the canvas. Clicking a cell centers the selected object in that ninth
// (the grid itself is never drawn). Same look as the other settings button rows
// (full-width `grid-cols-3` + `ToolButton`), with lucide align icons inside.
//
// Two uses, one component:
//   • persistent setting  — pass `value`; the chosen cell highlights (batch).
//   • momentary action     — omit `value`; clicking just fires (place now).
//
// Numpad maps spatially: 7/8/9 = top row, 4/5/6 = middle, 1/2/3 = bottom.
import { useEffect } from "react";
import {
  AlignVerticalJustifyStart,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
} from "lucide-react";
import { ToolButton } from "@/components/ui/tool-button";

export type PlacementCell =
  | "top-left"
  | "top-center"
  | "top-right"
  | "middle-left"
  | "center"
  | "middle-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

const CELLS: {
  id: PlacementCell;
  label: string;
  row: 0 | 1 | 2;
  /** Numpad code that maps to this cell (spatial layout). */
  numpad: string;
}[] = [
  { id: "top-left", label: "Top left", row: 0, numpad: "Numpad7" },
  { id: "top-center", label: "Top center", row: 0, numpad: "Numpad8" },
  { id: "top-right", label: "Top right", row: 0, numpad: "Numpad9" },
  { id: "middle-left", label: "Middle left", row: 1, numpad: "Numpad4" },
  { id: "center", label: "Center", row: 1, numpad: "Numpad5" },
  { id: "middle-right", label: "Middle right", row: 1, numpad: "Numpad6" },
  { id: "bottom-left", label: "Bottom left", row: 2, numpad: "Numpad1" },
  { id: "bottom-center", label: "Bottom center", row: 2, numpad: "Numpad2" },
  { id: "bottom-right", label: "Bottom right", row: 2, numpad: "Numpad3" },
];

// Icon shows the vertical placement (top / middle / bottom row); the button's
// column within the 3-wide grid gives the horizontal placement.
const ROW_ICON = [
  AlignVerticalJustifyStart,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
];

export function PlacementGrid({
  value,
  onChange,
  disabled = false,
  label,
  numpadKeys = false,
}: {
  value?: PlacementCell | null;
  onChange: (cell: PlacementCell) => void;
  disabled?: boolean;
  label?: string;
  numpadKeys?: boolean;
}) {
  useEffect(() => {
    if (!numpadKeys || disabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target instanceof HTMLElement && e.target.isContentEditable)
      )
        return;
      const cell = CELLS.find((c) => c.numpad === e.code);
      if (cell) {
        e.preventDefault();
        onChange(cell.id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [numpadKeys, disabled, onChange]);

  return (
    <div className="space-y-2">
      {label && (
        <label className="text-2xs text-theme-muted-foreground">{label}</label>
      )}
      <div
        role="group"
        aria-label={label ?? "Placement"}
        className="grid grid-cols-3 gap-2 [grid-auto-rows:1fr]"
      >
        {CELLS.map(({ id, label: cellLabel, row }) => {
          const Icon = ROW_ICON[row];
          return (
            <ToolButton
              key={id}
              active={value === id}
              disabled={disabled}
              title={cellLabel}
              aria-label={cellLabel}
              onClick={() => onChange(id)}
            >
              <Icon />
            </ToolButton>
          );
        })}
      </div>
    </div>
  );
}
