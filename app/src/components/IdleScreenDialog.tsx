// Dialog-box variant of the idle "paused to save power" screen, used by the
// Settings → Dev Tests preview. The real in-app idle screen is the full-screen
// IdleScreen; this boxes the very same card (IdleScreenCard) so it can be
// previewed inline. In `dismissible` mode the X / Esc / click-outside close it
// and it stacks above the Settings modal; otherwise a close attempt shakes the
// box.
import { useCallback } from "react";
import { motion, useAnimation } from "framer-motion";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { IdleScreenCard } from "@/components/IdleScreen";

interface Props {
  open: boolean;
  onContinue: () => void;
  /** Dev-Tests preview mode: X / Esc / click-outside dismiss the box (instead of
   *  shaking), and it stacks above the Settings modal so it's actually visible. */
  dismissible?: boolean;
}

export function IdleScreenDialog({ open, onContinue, dismissible = false }: Props) {
  const controls = useAnimation();
  const triggerShake = useCallback(async () => {
    await controls.start({
      x: [0, -14, 14, -10, 10, -6, 6, -3, 3, 0],
      transition: { duration: 0.55, ease: "easeInOut" },
    });
    controls.set({ x: 0 });
  }, [controls]);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (o) return;
        if (dismissible) onContinue();
        else triggerShake();
      }}
    >
      {/* Transparent, chrome-less content — the visible box is the card, so no
          DialogHeader/DialogFooter (no header, no footer). The card supplies
          the accessible DialogTitle. */}
      <DialogContent
        className={cn(
          "w-auto max-w-xs overflow-visible border-0 bg-transparent p-0 shadow-none",
          dismissible && "z-[var(--z-devpreview)]",
        )}
      >
        <motion.div animate={controls}>
          <IdleScreenCard onContinue={onContinue} />
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}
