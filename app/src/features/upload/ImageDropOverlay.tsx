import { AnimatePresence, motion } from "framer-motion";
import { ImageDown } from "lucide-react";

/**
 * Full-window drop affordance shown while an image is dragged anywhere over the
 * app — an ambient animated gradient border (à la the "Claude in Chrome" glow)
 * around the whole viewport, plus a centered prompt. Purely visual and
 * non-interactive (`pointer-events: none`) so it never swallows the drop; the
 * actual drop is handled by window-level listeners in AppShell.
 */
export function ImageDropOverlay({ show }: { show: boolean }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="image-drop-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          aria-hidden
        >
          {/* Spinning gradient border ring (hollow center via mask). */}
          <div className="image-drop-ring" />
          <motion.div
            className="image-drop-card"
            initial={{ scale: 0.92, y: 10 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.96, y: 6 }}
            transition={{ type: "spring", stiffness: 340, damping: 26 }}
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
