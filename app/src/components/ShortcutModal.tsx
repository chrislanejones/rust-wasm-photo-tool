// ===== FILE: app/src/components/ShortcutModal.tsx =====
import { motion, AnimatePresence } from "framer-motion";
import { X, Keyboard } from "lucide-react";
import { fadeIn, quickSpring } from "@/lib/animations";

interface Props {
  open: boolean;
  onClose: () => void;
}

const SHORTCUT_GROUPS = [
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
      { keys: ["Alt", "D"], action: "Delete All Images" },
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
    shortcuts: [{ keys: ["Alt", "Scroll"], action: "Zoom In / Out" }],
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
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-5 pb-3">
              <h2 className="flex items-center gap-2 text-base font-semibold">
                <Keyboard className="h-5 w-5" />
                Keyboard Shortcuts
              </h2>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-bg-elevated text-text-muted hover:text-text-primary transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Body */}
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

            {/* Footer hint */}
            <div className="px-6 py-3 border-t border-border text-[10px] text-text-muted text-center">
              <kbd>Alt</kbd>+<kbd>/</kbd> toggles inline hints on bars
              &nbsp;·&nbsp;
              <kbd>Alt</kbd>+<kbd>?</kbd> toggles this modal
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
