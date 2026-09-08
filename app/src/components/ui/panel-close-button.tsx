import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PANEL_CLOSE_REVEAL_MS, hoverReveal } from "@/lib/animations";
import { cn } from "@/lib/utils";

/**
 * The hover-reveal close on a panel's top-left corner — Tools, Gallery and
 * Review each carry one. It is the Layers list's own X (`Button size="xs"`,
 * 20px), so the panels close with the control their rows already use.
 *
 * ON THE CORNER, not in it: -10px on both axes centres the 20px button on the
 * panel's top-left vertex, half outside. Inside the panel it sat over whatever
 * control was first. 20px rather than the 24px `tiny` on purpose: a panel
 * whose edge is 12px from the screen's put a 24px button at 0–24, touching the
 * viewport edge; 20px spans 2–22. (Chris, 2026-09-08.)
 *
 * REVEAL is `hoverReveal` in lib/animations.ts — hidden 0 → shown 1 — driven by
 * this component's OWN state, read off its parent's pointerenter/pointerleave.
 * Not the panel's `whileHover`: framer propagates a hover label to every
 * descendant with variants, and the tool rail's icons (`hoverPop`) would have
 * grown in unison whenever the panel was hovered. Keyboard focus reveals it
 * too — a control that only exists under a mouse is unreachable otherwise.
 * While hidden it is `pointer-events: none`, so an invisible button is not a
 * phantom click target on the corner.
 *
 * RETIRES after PANEL_CLOSE_REVEAL_MS (40 s) in the panel: one you have
 * settled into stops offering to close. Leaving and coming back restarts the
 * clock, and so does reopening the panel (mount is panel-open).
 *
 * Icon-only, so the accessible name is an `aria-label` (#64). Closing sets the
 * panel's `show*` flag false; the top bar's toggle brings it back and already
 * reads the same flag, so the two stay in step with no extra wiring.
 *
 * Half-outside is why Tools and Review no longer clip at their fixed shell;
 * each moved `overflow-hidden` to an inner wrapper. No z-index: the guardrail
 * admits only `z-[var(--z-*)]` tokens and an absolute first child paints above
 * its static siblings anyway — the click test proves it, not a number.
 */
interface PanelCloseButtonProps {
  /** Accessible name, e.g. "Close Tools". */
  label: string;
  onClose: () => void;
  className?: string;
}

export function PanelCloseButton({ label, onClose, className }: PanelCloseButtonProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [retired, setRetired] = useState(false);

  // The panel is the hover surface; listen to it rather than ask it to tell us.
  // The 40 s clock is measured from the LAST pointerenter (or from mount, for a
  // panel that opens under a still cursor): entering un-retires and restarts
  // it, leaving cancels it, firing retires it. So "clicks away and comes back"
  // gets a fresh 40 s (Chris, 2026-09-08), and so does reopening the panel.
  const timer = useRef<number | null>(null);
  useEffect(() => {
    const host = wrapRef.current?.parentElement;
    if (!host) return;
    const arm = () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setRetired(true), PANEL_CLOSE_REVEAL_MS);
    };
    const on = () => {
      setRetired(false);
      setHovered(true);
      arm();
    };
    const off = () => {
      setHovered(false);
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = null;
    };
    host.addEventListener("pointerenter", on);
    host.addEventListener("pointerleave", off);
    arm();
    return () => {
      host.removeEventListener("pointerenter", on);
      host.removeEventListener("pointerleave", off);
      if (timer.current !== null) window.clearTimeout(timer.current);
    };
  }, []);

  // Retired suppresses the HOVER reveal only. It does not unmount — that would
  // tear down the very listeners that un-retire it on the next entry — and
  // keyboard focus still reveals it, because retirement is a pointer-idleness
  // idea and a control that only exists under a mouse is unreachable otherwise.
  const shown = focused || (hovered && !retired);

  return (
    <motion.div
      ref={wrapRef}
      variants={hoverReveal}
      initial="hidden"
      animate={shown ? "shown" : "hidden"}
      style={{ pointerEvents: shown ? "auto" : "none" }}
      className={cn("absolute -left-2.5 -top-2.5", className)}
    >
      <Button
        size="xs"
        onClick={onClose}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        aria-label={label}
        className="shadow-md"
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </motion.div>
  );
}
