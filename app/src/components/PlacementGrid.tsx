// A 3×3 placement grid — nine buttons, one per quadrant of a frame (corners,
// edge-centers, center). The grid spatially mirrors the canvas, and each button
// puts its dot in the matching position so it reads on its own too.
//
// Two uses, one component:
//   • persistent setting  — pass `value`; the chosen cell highlights (batch).
//   • momentary action     — omit `value`; clicking just fires (place a selected
//                            text/shape now).
//
// Numpad maps spatially: 7/8/9 = top row, 4/5/6 = middle, 1/2/3 = bottom.
import { useEffect } from "react";
import { cn } from "@/lib/utils";

/** Single-axis modes Rust `align_annotation` understands. */
export type AlignMode =
  | "left"
  | "centerH"
  | "right"
  | "top"
  | "middleV"
  | "bottom";

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
  col: 0 | 1 | 2;
  row: 0 | 1 | 2;
  /** Numpad code that maps to this cell (spatial layout). */
  numpad: string;
}[] = [
  { id: "top-left", label: "Top left", col: 0, row: 0, numpad: "Numpad7" },
  { id: "top-center", label: "Top center", col: 1, row: 0, numpad: "Numpad8" },
  { id: "top-right", label: "Top right", col: 2, row: 0, numpad: "Numpad9" },
  { id: "middle-left", label: "Middle left", col: 0, row: 1, numpad: "Numpad4" },
  { id: "center", label: "Center", col: 1, row: 1, numpad: "Numpad5" },
  { id: "middle-right", label: "Middle right", col: 2, row: 1, numpad: "Numpad6" },
  { id: "bottom-left", label: "Bottom left", col: 0, row: 2, numpad: "Numpad1" },
  { id: "bottom-center", label: "Bottom center", col: 1, row: 2, numpad: "Numpad2" },
  { id: "bottom-right", label: "Bottom right", col: 2, row: 2, numpad: "Numpad3" },
];

const JUSTIFY = ["justify-start", "justify-center", "justify-end"] as const;
const ITEMS = ["items-start", "items-center", "items-end"] as const;

/** Map a placement cell → [horizontal, vertical] single-axis align modes. */
const ALIGN: Record<PlacementCell, [AlignMode, AlignMode]> = {
  "top-left": ["left", "top"],
  "top-center": ["centerH", "top"],
  "top-right": ["right", "top"],
  "middle-left": ["left", "middleV"],
  center: ["centerH", "middleV"],
  "middle-right": ["right", "middleV"],
  "bottom-left": ["left", "bottom"],
  "bottom-center": ["centerH", "bottom"],
  "bottom-right": ["right", "bottom"],
};

export function placementToAlign(cell: PlacementCell): [AlignMode, AlignMode] {
  return ALIGN[cell];
}

export function PlacementGrid({
  value,
  onChange,
  disabled = false,
  label,
  /** Enable Numpad 1-9 → cells while mounted (only when not disabled). */
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
        className="grid w-fit grid-cols-3 gap-1"
      >
        {CELLS.map(({ id, label: cellLabel, col, row }) => {
          const active = value === id;
          return (
            <button
              key={id}
              type="button"
              disabled={disabled}
              aria-label={cellLabel}
              aria-pressed={active}
              title={cellLabel}
              onClick={() => onChange(id)}
              className={cn(
                "flex h-8 w-8 rounded-md border p-1.5 transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                JUSTIFY[col],
                ITEMS[row],
                active
                  ? "border-accent bg-accent/15"
                  : "border-border bg-bg-elevated hover:bg-bg-elevated/70",
              )}
            >
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-sm",
                  active ? "bg-accent" : "bg-text-muted",
                )}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
