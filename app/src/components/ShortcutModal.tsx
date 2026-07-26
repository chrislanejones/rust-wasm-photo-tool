import { motion, AnimatePresence } from "framer-motion";
import { X, Keyboard } from "lucide-react";
import { fadeIn, quickSpring } from "@/lib/animations";
import { TOOLS } from "@/features/tools/toolConfig";

interface Props {
  open: boolean;
  onClose: () => void;
}

const SHORTCUT_GROUPS = [
  {
    title: "Tools (bare keys)",
    // DERIVED from toolConfig.ts, not hand-written. This list used to be its
    // own copy of the tool table and drifted: it silently omitted Select for
    // three releases after `S` was removed. Generating it means a tool that
    // gains, loses or changes a key updates here for free, and a keyless tool
    // simply doesn't appear. Rail order is TOOLS order, which is also the
    // order the keys are assigned in.
    shortcuts: TOOLS.filter((t) => t.shortcutKey).map((t) => ({
      keys: [t.shortcutKey!],
      action: t.tooltipTitle ?? t.label,
    })),
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
      { keys: ["Alt", ","], action: "Command Palette" },
      { keys: ["Alt", "N"], action: "Toggle New" },
      { keys: ["Alt", "T"], action: "Toggle Tools" },
      { keys: ["Alt", "G"], action: "Toggle Gallery" },
      { keys: ["Alt", "R"], action: "Toggle Review" },
      { keys: ["Alt", "/"], action: "Toggle This Modal" },
    ],
  },
  {
    title: "Edit",
    shortcuts: [
      { keys: ["Ctrl", "Z"], action: "Undo" },
      { keys: ["Ctrl", "Shift", "Z"], action: "Redo" },
      { keys: ["Ctrl", "C"], action: "Copy Selection / Canvas" },
      { keys: ["Ctrl", "Shift", "C"], action: "Copy to Clipboard" },
      { keys: ["Alt", "D"], action: "Delete All Images" },
    ],
  },
  {
    title: "Transform",
    shortcuts: [
      { keys: ["Alt", "F"], action: "Flip Horizontal" },
      { keys: ["Alt", "V"], action: "Flip Vertical" },
      { keys: ["Alt", "S"], action: "Open Settings" },
    ],
  },
  {
    title: "Stamps (Clone)",
    shortcuts: [
      { keys: ["Alt", "Click"], action: "Set Source Point" },
      { keys: ["Ctrl", "["], action: "Decrease Brush Size" },
      { keys: ["Ctrl", "]"], action: "Increase Brush Size" },
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
    shortcuts: [
      { keys: ["Alt", "E"], action: "Export current image" },
      { keys: ["Alt", "Shift", "E"], action: "Export all images (ZIP)" },
    ],
  },
  {
    // Always shown — the Diagnostics Window is open to everyone.
    title: "Dev Tools",
    shortcuts: [
      { keys: ["Alt", "Delete"], action: "Toggle Diagnostics Window" },
    ],
  },
];

export function ShortcutModal({ open, onClose }: Props) {
  const groups = SHORTCUT_GROUPS;
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          variants={fadeIn}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center bg-black/60 backdrop-blur-sm"
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
              {groups.map((group) => (
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
              <kbd className="shortcut-kbd">/</kbd> to toggle this modal
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
