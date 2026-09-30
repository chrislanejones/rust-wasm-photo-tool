// The frame every MULTI-PANE dialog shares — the New dialog (New Canvas,
// Create AI Image) and the Download dialog (Selected Image, All Images).
//
// Two pieces, one look:
//   • `PaneSwap` — the slot the panes swap in. Owns the AnimatePresence and
//     the directional `panelSwap` variant, so stepping into a pane slides it
//     in from the right and Back slides the previous one in from the left, in
//     every one of these dialogs alike.
//   • `PaneHeader` — the top of a sub-pane: a Back chevron, the pane's title,
//     and an optional right-hand slot. Back lives HERE, top-left, in every
//     sub-pane, so the bottom row is left to the pane's own action (the
//     PanelActionBar the tool panels use for Apply Crop).
import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft } from "lucide-react";
import { panelSwap } from "@/lib/animations";
import { cn } from "@/lib/utils";

/** +1 stepping into a pane, −1 stepping back out of one. */
export type PaneDirection = 1 | -1;

interface PaneSwapProps {
  /** Unique per pane — a change of key IS the swap. */
  paneKey: string;
  direction: PaneDirection;
  className?: string;
  children: React.ReactNode;
}

export function PaneSwap({ paneKey, direction, className, children }: PaneSwapProps) {
  return (
    <AnimatePresence mode="wait" initial={false} custom={direction}>
      <motion.div
        key={paneKey}
        custom={direction}
        variants={panelSwap}
        initial="hidden"
        animate="visible"
        exit="exit"
        className={className}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

interface PaneHeaderProps {
  title: React.ReactNode;
  /** Omit on a pane with nowhere to go back to (a one-pane dialog). */
  onBack?: () => void;
  /** Right-hand slot — a lightbulb, a count. */
  aside?: React.ReactNode;
  className?: string;
}

export function PaneHeader({ title, onBack, aside, className }: PaneHeaderProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 border-b border-border pb-3",
        className,
      )}
    >
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          aria-label="Back"
          title="Back"
          className="group -ml-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-bg-elevated text-text-secondary transition hover:border-border-active hover:text-text-primary"
        >
          <ChevronLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
        </button>
      )}
      <h3 className="min-w-0 flex-1 truncate text-sm font-semibold tracking-wide text-text-primary">
        {title}
      </h3>
      {aside}
    </div>
  );
}
