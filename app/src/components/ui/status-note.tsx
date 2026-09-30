// The short lines a tool panel shows around its controls — one definition
// each, so a batch panel, AI Rename and the AI tools cannot drift into three
// spellings of "it failed", "it worked" or "you can't yet, because".
import * as React from "react";

/** A failure message under a panel action. Plain text, no box: an error is
 *  read once and acted on, and a red box in a dense panel reads as a control. */
export function ErrorNote({ children }: { children: React.ReactNode }) {
  return <p className="text-2xs text-destructive leading-relaxed">{children}</p>;
}

/** Why a control is off right now — "Drag a crop box on the canvas first."
 *  Muted, not a warning: nothing is wrong, a step is missing. The one
 *  definition behind `ControlRow`'s and `PanelActionBar`'s `reason` slot;
 *  give it the id the disabled control points `aria-describedby` at. */
export function ReasonNote({ id, children }: { id?: string; children: React.ReactNode }) {
  return (
    <p id={id} data-slot="reason" className="text-2xs leading-relaxed text-theme-muted-foreground">
      {children}
    </p>
  );
}

/** A completed-run summary ("✓ Applied to 4 images"). Announced politely so a
 *  screen reader hears the result of a long batch without losing its place. */
export function SuccessCallout({ children }: { children: React.ReactNode }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="rounded-md border border-success/40 bg-success/10 px-2.5 py-1.5 text-2xs text-success"
    >
      {children}
    </div>
  );
}
