// THE MODE RING — the gold ring (`.image-drop-ring`, styles.css) that
// says "a mode is on here". One look for one meaning (Chris, 11-25-2026):
//   • a file dragged over the app — where it will land;
//   • Compare — round the gallery while you pick the two photos;
//   • Alt over a Fill Color row — the swatches are opacity steps;
//   • Corner Radius — Alt shows the corners, or one corner is being edited.
// Decoration only (aria-hidden): what the mode IS is said in words beside it.
// Its parent must be `position: relative`.
//
// STILL, NOT TURNING (Chris, 11-25-2026). It used to spin. Now that several
// modes share it, the gold ring itself is the signal: "I clicked it, and
// there's the gold round it". The file-drag overlay's ring is still too.
import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

interface ModeRingProps {
  /** Where the ring sits round its parent: `inset` px outward, its corner
   *  radius, and its thickness (4 px round a big surface, 2 px round a row). */
  inset?: number;
  radius?: number | "inherit";
  thickness?: number;
  className?: string;
}

export function ModeRing({ inset = 0, radius = 10, thickness = 4, className }: ModeRingProps) {
  const style: CSSProperties = { inset: -inset, borderRadius: radius, padding: thickness };
  return (
    <div
      aria-hidden
      data-mode-ring=""
      className={cn("image-drop-ring pointer-events-none z-10", className)}
      style={style}
    />
  );
}
