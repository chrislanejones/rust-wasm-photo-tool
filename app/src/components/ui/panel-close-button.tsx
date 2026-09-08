import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * The hover-reveal close in a panel's top-left corner — Tools, Gallery and
 * Review each carry one. It is the Review panel's own "Close section" button
 * (`Button size="tiny"` around an `h-4 w-4` X) lifted out and positioned, so
 * the three panels close with the same glyph their sections already do.
 *
 * Hidden at rest and shown on the panel's `group` hover — the panel's outer
 * container must carry `group`. It ALSO shows on keyboard focus: a control
 * that only exists under a mouse is unreachable from the keyboard, and
 * `focus-visible:opacity-100` is what keeps this WCAG-clean without making it
 * permanently visible.
 *
 * Icon-only, so the accessible name is an `aria-label` (#64) — never a
 * visible label, never a bare `title`.
 *
 * Closing sets the panel's `show*` flag false; the top bar's toggle for that
 * panel is what brings it back, and its `active` state already reads the same
 * flag, so the two stay in step with no extra wiring.
 */
interface PanelCloseButtonProps {
  /** Accessible name, e.g. "Close Tools". */
  label: string;
  onClose: () => void;
  className?: string;
}

export function PanelCloseButton({ label, onClose, className }: PanelCloseButtonProps) {
  return (
    <Button
      size="tiny"
      onClick={onClose}
      aria-label={label}
      className={cn(
        // ON THE CORNER, not in it: -12px on both axes centres this 24px
        // button on the panel's top-left vertex, half outside. Inside the
        // panel it sat over whatever button was first — the tool grid's first
        // tile, the Review section toggles — and a close that covers a control
        // is worse than no close. (Chris, 2026-09-08: "on the cusp of the
        // window, and not over a button".) Half-outside is why Tools and
        // Review stopped clipping at their fixed shell and moved
        // `overflow-hidden` to an inner wrapper; Gallery's card never clipped.
        // No z-index: the guardrail admits only `z-[var(--z-*)]` tokens, none
        // means "above this panel's content", and an absolute first child
        // paints above its static siblings anyway — the click test proves it.
        "absolute -left-3 -top-3 shadow-md",
        "opacity-0 transition-opacity duration-150",
        "group-hover:opacity-100 focus-visible:opacity-100",
        className,
      )}
    >
      <X className="h-4 w-4" />
    </Button>
  );
}
