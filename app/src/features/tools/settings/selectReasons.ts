// Why a Select setting is disabled in a mode, or `null` when the mode uses it.
//
// Shown under the disabled control rather than hiding the control: a slider
// that vanishes and reappears as you switch modes makes the panel jump, and a
// disabled one with no reason just looks broken. Its own module so the panel
// file exports only components (react-refresh) and the tests can import it.
import type { SelectionKind } from "@/stores/useToolStore";
import { isMarqueeKind } from "@/stores/useToolStore";

export function toleranceReason(kind: SelectionKind): string | null {
  if (kind === "lasso") return "The lasso follows edges, not colors.";
  if (isMarqueeKind(kind)) return "A marquee sweeps a shape, not a color.";
  return null;
}

export function edgeSensitivityReason(kind: SelectionKind): string | null {
  return kind === "edge" ? null : "Only Edge-aware stops at edges.";
}
