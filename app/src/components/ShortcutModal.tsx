import { motion, AnimatePresence } from "framer-motion";
import { X, Keyboard } from "lucide-react";
import { fadeIn, quickSpring } from "@/lib/animations";

interface Props {
  open: boolean;
  onClose: () => void;
}

const SHORTCUT_GROUPS = [
  {
    title: "Tools (bare keys)",
    shortcuts: [
      { keys: ["1"], action: "Resize / Compress" },
      { keys: ["2"], action: "Crop" },
      { keys: ["3"], action: "Paint Brush" },
      { keys: ["4"], action: "Text" },
      { keys: ["5"], action: "Arrows" },
      { keys: ["6"], action: "AI" },
      { keys: ["7"], action: "Shapes" },
      { keys: ["8"], action: "Effects (Blur/Bright/Contrast)" },
      { keys: ["9"], action: "Clone Stamp" },
      { keys: ["0"], action: "Emoji" },
    ],
  },
  {
    title: "Navigation",
    shortcuts: [
      { keys: ["Space"], action: "Hold to Pan (drag image)" },
      { keys: ["PgUp"], action: "Previous Photo" },
      { keys: ["PgDn"], action: "Next Photo" },
    ],
  },
  {
    title: "Panels",
    shortcuts: [
      { keys: ["Alt", "U"], action: "Toggle Upload" },
      { keys: ["Alt", "S"], action: "Toggle Tools" },
      { keys: ["Alt", "G"], action: "Toggle Gallery" },
      { keys: ["Alt", "H"], action: "Toggle History" },
      { keys: ["Alt", "/"], action: "Toggle Inline Hints" },
      { keys: ["Alt", "?"], action: "Toggle This Modal" },
    ],
  },
  {
    title: "Edit",
    shortcuts: [
      { keys: ["Ctrl", "Z"], action: "Undo" },
      { keys: ["Ctrl", "Shift", "Z"], action: "Redo" },
      { keys: ["Ctrl", "Shift", "C"], action: "Copy to Clipboard" },
      { keys: ["Alt", "D"], action: "Delete All Images" },
    ],
  },
  {
    title: "Transform",
    shortcuts: [
      { keys: ["Alt", "F"], action: "Flip Horizontal" },
      { keys: ["Alt", "V"], action: "Flip Vertical" },
      { keys: ["Alt", "R"], action: "Rotate 90° CW" },
    ],
  },
  {
    title: "Clone Stamp",
    shortcuts: [
      { keys: ["Alt", "Click"], action: "Set Source Point" },
      { keys: ["Alt", "["], action: "Decrease Brush Size" },
      { keys: ["Alt", "]"], action: "Increase Brush Size" },
    ],
  },
  {
    title: "View",
    shortcuts: [
      { keys: ["Alt", "Scroll"], action: "Zoom In / Out" },
      { keys: ["Alt", "="], action: "Zoom In" },
      { keys: ["Alt", "-"], action: "Zoom Out" },
      { keys: ["Alt", "0"], action: "Reset Zoom (100%)" },
    ],
  },
  {
    title: "Export",
    shortcuts: [{ keys: ["Alt", "E"], action: "Export Image" }],
  },
];

export function ShortcutModal({ open, onClose }: Props) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          variants={fadeIn}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={quickSpring}
            className="shortcut-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="shortcut-modal-header">
              <div className="shortcut-modal-title">
                <Keyboard className="shortcut-modal-icon" />
                Keyboard Shortcuts
              </div>
              <button className="shortcut-modal-close" onClick={onClose}>
                <X className="shortcut-modal-close-icon" />
              </button>
            </div>

            <div className="shortcut-modal-body">
              {SHORTCUT_GROUPS.map((group) => (
                <div key={group.title} className="shortcut-group">
                  <h3 className="shortcut-group-title">{group.title}</h3>
                  <div className="shortcut-list">
                    {group.shortcuts.map((s) => (
                      <div key={s.action} className="shortcut-row">
                        <span className="shortcut-action">{s.action}</span>
                        <span className="shortcut-keys">
                          {s.keys.map((k, i) => (
                            <span key={i}>
                              {i > 0 && (
                                <span className="shortcut-plus">+</span>
                              )}
                              <kbd className="shortcut-kbd">{k}</kbd>
                            </span>
                          ))}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="shortcut-modal-footer">
              Press <kbd className="shortcut-kbd">Alt</kbd>
              <span className="shortcut-plus">+</span>
              <kbd className="shortcut-kbd">?</kbd> to toggle this modal
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
