import { useRef } from "react";
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
 * What the primitive actually provided, measured rather than assumed: Escape,
 * scroll lock and `aria-labelledby` came free. The focus trap, focus restore
 * and `aria-modal` did NOT — see the three prop comments below. Each gap was
 * reproduced against the untouched Diagnostics Window as well, so they are
 * primitive-wide and pre-existing; they are fixed here at the call site rather
 * than centrally because that is a change to every dialog in the app.
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
  const contentRef = useRef<HTMLDivElement>(null);
  // Where focus was when the modal opened, so it can be put back on close.
  const restoreRef = useRef<HTMLElement | null>(null);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        ref={contentRef}
        size="xl"
        aria-describedby={undefined}
        // Radix signals modality by aria-hiding the dialog's siblings rather
        // than by setting this attribute. Measured here: `#root` does NOT get
        // aria-hidden — verified against the Diagnostics Window too, which uses
        // the same primitive and is equally exposed, so this is primitive-wide
        // and pre-existing rather than anything this rebuild introduced. Until
        // that is fixed centrally (PARKING_LOT), state modality explicitly so a
        // screen reader treats the app behind as inert.
        aria-modal="true"
        // The shared primitive prevents open-autofocus to avoid ringing the
        // first button, and its comment says focus "moves into the dialog
        // container instead". Measured in a browser: it does not — focus stays
        // on whatever opened the dialog, which is OUTSIDE Radix's focus scope,
        // so the trap never engages and Tab walks the page behind. With the
        // modal open, Tab went Tools → Gallery, both behind the backdrop.
        //
        // Overriding it here does what that comment describes: suppress the
        // default (no accent ring on the close button) and put focus on the
        // container, which has tabindex="-1" already. That is what arms the
        // trap, the Escape handler's focus context, and focus restore on close.
        //
        // This is a PRIMITIVE-WIDE bug — every ui/dialog consumer has it. Fixed
        // only here on purpose; see docs/PARKING_LOT.md.
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          // Capture BEFORE moving focus — this is still whatever opened us.
          restoreRef.current = document.activeElement as HTMLElement | null;
          contentRef.current?.focus();
        }}
        // Radix's modal content restores focus to `DialogTrigger`. This dialog
        // has no trigger — it opens from the Alt+/ shortcut through the UI
        // store — so Radix's restore resolves to null and focus falls to
        // <body>. Measured: closing with focus on the container happened to
        // restore, but Tab to the close button first and Escape dropped focus
        // to BODY and left it there (still there after 2.1s, and the origin
        // button was verifiably still mounted). Restore it explicitly so it
        // does not depend on where focus sat inside the dialog.
        onCloseAutoFocus={(e) => {
          e.preventDefault();
          restoreRef.current?.focus();
          restoreRef.current = null;
        }}
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
