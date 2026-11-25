import { AnimatePresence, motion } from "framer-motion";
import { ImageDown } from "lucide-react";
import { fadeIn, springSoft } from "@/lib/animations";
import { ModeRing } from "@/components/ui/mode-ring";

/**
 * Full-window drop affordance shown while an image is dragged anywhere over the
 * app — the still gold mode ring (components/ui/mode-ring.tsx) round the
 * whole viewport, plus a centered prompt. Purely visual and
 * non-interactive (`pointer-events: none`) so it never swallows the drop; the
 * actual drop is handled by window-level listeners in AppShell.
 */
export function ImageDropOverlay({ show }: { show: boolean }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="image-drop-overlay"
          variants={fadeIn}
          initial="hidden"
          animate="visible"
          exit="exit"
          aria-hidden
        >
          {/* The mode ring: a file drag is a mode, marked like the others. */}
          <ModeRing radius={0} />
          <motion.div
            className="image-drop-card"
            initial={{ scale: 0.92, y: 10 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.96, y: 6 }}
            transition={springSoft}
          >
            <ImageDown className="image-drop-icon" />
            <div className="image-drop-title">Drop image to import</div>
            <div className="image-drop-sub">
              Add it as a new layer, onto your image, or to the gallery
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
