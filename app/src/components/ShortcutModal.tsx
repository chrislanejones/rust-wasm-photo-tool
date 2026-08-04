import { Keyboard } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TOOL_GROUPS } from "@/features/tools/toolGroups";

interface Props {
  open: boolean;
  onClose: () => void;
}

const SHORTCUT_GROUPS = [
  {
    title: "Tool groups (bare keys)",
    // DERIVED from the five-group registry, not hand-written. This list used to
    // be its own copy of the tool table and drifted: it silently omitted Select
    // for three releases after `S` was removed. Generating it means a group
    // that gains, loses or changes a key updates here for free.
    //
    // Sub-tools are deliberately absent: 33 of them have no bare-key bindings
    // (palette and click only), so there is nothing here to list for them and
    // no way for this table to fall behind one.
    shortcuts: TOOL_GROUPS.map((g) => ({
      keys: [g.shortcutKey],
      action: g.label,
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
      // Bound in useKeyboardShortcuts as Ctrl/Cmd + Backslash. It was an
      // undocumented easter egg; listing it costs the surprise once and stops
      // it being a key combination nothing in the app admits exists.
      { keys: ["Ctrl", "\\"], action: "Shipping celebration" },
    ],
  },
];

/**
 * Rebuilt onto `ui/dialog` (Radix) in NIGHT JOB III. It was a bespoke
 * `motion.div` overlay with no `role="dialog"`, no `aria-modal`, no Escape
 * handler and no focus trap — measured, not assumed. Rather than hand-adding
 * four accessibility behaviours to a one-off overlay, this uses the primitive
 * the delete confirms, Diagnostics and the update prompt already share, so
 * there is one less bespoke overlay to drift.
 *
 * The focus trap, focus restore and `aria-modal` were missing from the shared
 * primitive and were hand-added here, because fixing them centrally is a change
 * to every dialog in the app. NIGHT JOB V made that change: they now live in
 * `ui/dialog`'s `DialogContent`, and the ~40 lines that used to sit here are
 * gone. Nothing about this modal's behaviour changed in the move.
 *
 * The old look is preserved deliberately, via the same two props
 * `SmallWindowNotice` uses: `--z-modal` (60) keeps it above dialog-level
 * surfaces (60 vs the primitive's default 50), and the backdrop keeps its
 * lighter 60% tint and blur instead of the primitive's flat 80%.
 *
 * `size="xl"` is a 760px max width — the exact width `.shortcut-modal` set by
 * hand, so the multi-column table did not have to change to fit.
 *
 * `aria-describedby={undefined}` opts out of Radix's description warning: the
 * body is a reference table, and a prose summary of it would only be read to
 * screen-reader users as noise before the table itself.
 */
export function ShortcutModal({ open, onClose }: Props) {
  const groups = SHORTCUT_GROUPS;
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        size="xl"
        aria-describedby={undefined}
        overlayClassName="z-[var(--z-modal)] bg-black/60 backdrop-blur-sm"
        className="z-[var(--z-modal)] flex max-h-[80vh] flex-col"
      >
        <DialogHeader className="px-5 py-4">
          <DialogTitle className="flex items-center gap-2.5 font-mono text-sm font-semibold text-text-primary">
            <Keyboard className="h-[18px] w-[18px] text-accent" />
            Keyboard Shortcuts
          </DialogTitle>
        </DialogHeader>

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
                          {i > 0 && <span className="shortcut-plus">+</span>}
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
      </DialogContent>
    </Dialog>
  );
}
