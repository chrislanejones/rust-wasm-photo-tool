// The frame every MULTI-PANE dialog shares — the New dialog (New Canvas,
// Create AI Image) and the Download dialog (Selected Image, All Images).
//
// Two pieces, one look:
//   • `PaneSwap` — the slot the panes swap in. Owns the AnimatePresence and
//     the directional `panelSwap` variant, so stepping into a pane slides it
//     in from the right and Back slides the previous one in from the left, in
//     every one of these dialogs alike.
//   • `PaneHeader` — the top of a sub-pane, one 3-column row (Chris,
//     10-05-2026): [<] Back on the left, the title CENTERED, [X] close on the
//     right. Back is the same 24×24 `tiny` button as the close, so the two
//     ends match. The side columns are equal (`1fr auto 1fr`), so the title is
//     centered on the dialog even when the right side also holds a lightbulb.
//     Back lives HERE, in every sub-pane, so the bottom row is left to the
//     pane's own action (the PanelActionBar the tool panels use for Apply Crop).
import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, X } from "lucide-react";
import { DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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
  /** Right-hand slot, before the close — a lightbulb, a count. */
  aside?: React.ReactNode;
  /** Draw the dialog's [X] close at the right end. Only inside a Dialog: the
   *  same panes also render on the full-page start screen, which has nothing
   *  to close (and Radix's Close needs a Dialog around it). */
  closable?: boolean;
  className?: string;
}

export function PaneHeader({ title, onBack, aside, closable = false, className }: PaneHeaderProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-[1fr_auto_1fr] items-center gap-2 border-b border-border pb-3",
        className,
      )}
    >
      <div className="flex justify-start">
        {onBack && (
          <Button
            size="tiny"
            onClick={onBack}
            aria-label="Back"
            title="Back"
            className="group shrink-0"
          >
            <ChevronLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
          </Button>
        )}
      </div>
      <h3 className="min-w-0 truncate text-center text-sm font-semibold tracking-wide text-text-primary">
        {title}
      </h3>
      <div className="flex items-center justify-end gap-2">
        {aside}
        {closable && (
          <DialogClose asChild>
            <Button size="tiny" className="shrink-0" aria-label="Close" data-slot="dialog-close">
              <X className="h-4 w-4" />
            </Button>
          </DialogClose>
        )}
      </div>
    </div>
  );
}
