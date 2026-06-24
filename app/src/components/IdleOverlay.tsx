import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { LargeButton } from "@/components/ui/large-button";

/**
 * Full-screen black "paused" overlay shown after the idle timeout. Sits above
 * everything (portaled to body) so the editor underneath is fully covered — the
 * browser can then throttle the tab, and we stop idle-able JS work. Only the
 * "Continue with Image Horse" button dismisses it (via onContinue → wake()).
 *
 * Note: this saves CPU/battery; it does NOT reclaim WASM memory (only a reload
 * does). Edits are untouched.
 */
export function IdleOverlay({
  open,
  onContinue,
}: {
  open: boolean;
  onContinue: () => void;
}) {
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          className="fixed inset-0 z-[var(--z-idle)] flex flex-col items-center justify-center gap-6 bg-background"
          role="dialog"
          aria-modal="true"
        >
          <img
            src="/Image-Horse-Logo.svg"
            alt=""
            className="h-16 w-16 opacity-80"
            draggable={false}
          />
          <div className="text-center">
            <h2 className="text-lg font-semibold text-text-primary">Paused to save power</h2>
            <p className="mx-auto mt-1 max-w-xs text-sm text-text-secondary">
              Background activity is throttled after a while idle. Your edits are
              safe.
            </p>
          </div>
          <LargeButton onClick={onContinue} autoFocus>
            Continue with Image Horse
          </LargeButton>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
