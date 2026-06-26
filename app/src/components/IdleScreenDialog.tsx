// Dialog-box variant of the idle "paused to save power" screen, used by the
// Settings → Dev Tests preview. (The real in-app idle screen is the full-screen
// IdleScreen; this is the boxed-dialog version for design iteration.)
//
// Built on the shared Dialog primitives so it gets a consistent header + footer.
// Only "Continue" dismisses it — the X / Esc / click-outside shake the box to
// nudge a choice, the same way the upload + Welcome-back dialogs do.
import { useCallback } from "react";
import { motion, useAnimation } from "framer-motion";
import { PauseCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
} from "@/components/ui/dialog";

interface Props {
  open: boolean;
  onContinue: () => void;
}

export function IdleScreenDialog({ open, onContinue }: Props) {
  const controls = useAnimation();
  const triggerShake = useCallback(async () => {
    await controls.start({
      x: [0, -14, 14, -10, 10, -6, 6, -3, 3, 0],
      transition: { duration: 0.55, ease: "easeInOut" },
    });
    controls.set({ x: 0 });
  }, [controls]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && triggerShake()}>
      <DialogContent className="max-w-sm bg-black text-zinc-100">
        <motion.div animate={controls}>
          <DialogHeader>
            <DialogTitle>Idle Screen</DialogTitle>
          </DialogHeader>

          <DialogBody>
            <div className="flex flex-col items-center gap-3 py-2 text-center">
              <PauseCircle className="h-10 w-10 text-zinc-400" />
              <p className="max-w-xs text-sm text-zinc-400">
                Paused to save power. Background activity is throttled after a
                while idle — your edits are safe.
              </p>
            </div>
          </DialogBody>

          <DialogFooter>
            <button
              type="button"
              onClick={onContinue}
              className="flex-1 rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-[var(--accent-foreground)] transition hover:brightness-110"
            >
              Continue
            </button>
          </DialogFooter>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}
