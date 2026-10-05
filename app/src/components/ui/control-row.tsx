// One control in a tool panel: label on the left, live value on the right, the
// control underneath, and — when the control is off — the reason under that.
//
// FOUR FIXED SLOTS, marked with `data-slot` so a test can find them without
// knowing the markup: `label`, `value`, `control`, `reason`. Before Night 3
// this row existed twice, half each time: `SizeSlider` had label + value +
// control and no way to say why it was disabled; `StabilizerRow` had a label
// and a control and no value. Crop's "Ratio" and Pen's "Background" were a
// third and fourth spelling. They now share this one.
//
// ONE RHYTHM: `space-y-2` (8px) from the header to the control and from the
// control to the reason. The slider used 6px and the tile groups 8px; 8px is
// the spacing scale's most-used step (UI_CONSISTENCY §2) and what
// `ToolButtonGroup`'s own label already used, so the slider moved, not the
// fifteen tile-group importers.
//
// NAMING THE CONTROL. The label is a plain span with an id, handed to the
// control through the render-prop form of `children`, so a radio group can
// point `aria-labelledby` at the words already on screen. The info lightbulb
// sits beside the label, not inside it, so its "info" button name never leaks
// into the control's accessible name.
//
// THE REASON. A disabled control with no explanation is a dead end — the
// reader sees an off switch and no way to turn it on. `reason` renders as
// visible text (not a tooltip: touch has no hover) and its id is handed to the
// control for `aria-describedby`, so a screen reader hears it too.
//
// EDITED. A per-photo value this photo has moved off its default gets a dot
// after the label and a reset button beside the value (Plan A §4.3), so after
// a photo switch you can tell at a glance which numbers this photo changed.
// Defaults show nothing. Pass `edited` only for per-photo values.
import * as React from "react";
import { RotateCcw } from "lucide-react";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { ReasonNote } from "@/components/ui/status-note";
import { cn } from "@/lib/utils";

export interface ControlRowIds {
  /** id of the visible label text — for `aria-labelledby`. */
  labelId: string;
  /** id of the reason line, present only while a reason renders — for
   *  `aria-describedby`. */
  reasonId: string | undefined;
}

export interface ControlRowProps {
  /** The control's name, left-aligned. Plain words: it is also the name a
   *  screen reader reads for a control that points at it. */
  label: string;
  /** Lightbulb hint, placed right after the label (the right side is the
   *  value's). */
  info?: React.ReactNode;
  /** The live value, right-aligned, tabular figures. Omit for a control whose
   *  state is already visible in the control itself (a lit tile). */
  value?: React.ReactNode;
  /** Why the control is unavailable. Render it only while it is. */
  reason?: React.ReactNode;
  /** A per-photo value moved off its default: shows the edited dot and a
   *  reset button that calls `onReset`. Omit, or pass `isEdited: false`, for
   *  a default. */
  edited?: { isEdited: boolean; onReset: () => void; disabled?: boolean };
  /** The control. Use the function form to wire the label / reason ids. */
  children: React.ReactNode | ((ids: ControlRowIds) => React.ReactNode);
  className?: string;
}

export function ControlRow({ label, info, value, reason, edited, children, className }: ControlRowProps) {
  const baseId = React.useId();
  const labelId = `${baseId}-label`;
  const reasonId = reason ? `${baseId}-reason` : undefined;
  return (
    <div data-slot="control-row" className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between gap-2 text-2xs">
        <span className="flex items-center gap-1 text-theme-muted-foreground">
          <span id={labelId} data-slot="label">
            {label}
          </span>
          {info && <InfoTooltip info={info} label={label} />}
          {edited?.isEdited && (
            <span
              data-slot="edited"
              role="img"
              aria-label={`${label} changed on this photo`}
              title="Changed on this photo"
              className="size-1.5 rounded-full bg-theme-primary"
            />
          )}
        </span>
        <span className="flex items-center gap-1">
          {edited?.isEdited && (
            <button
              type="button"
              data-slot="reset"
              onClick={edited.onReset}
              disabled={edited.disabled}
              aria-label={`Reset ${label}`}
              title={`Reset ${label}`}
              className="flex size-4 items-center justify-center rounded text-theme-muted-foreground hover:text-theme-foreground disabled:opacity-40"
            >
              <RotateCcw aria-hidden className="size-3" />
            </button>
          )}
          {value != null && (
            <span data-slot="value" className="tabular-nums text-theme-foreground">
              {value}
            </span>
          )}
        </span>
      </div>
      <div data-slot="control">
        {typeof children === "function" ? children({ labelId, reasonId }) : children}
      </div>
      {reason && (
        <ReasonNote id={reasonId}>{reason}</ReasonNote>
      )}
    </div>
  );
}
