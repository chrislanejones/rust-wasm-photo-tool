import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { fadeIn, quickSpring } from "@/lib/animations";
import { TinyButton } from "@/components/ui/tiny-button";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  icon?: LucideIcon;
  /** Optional second header row (e.g. a tab switcher) inside the header block. */
  toolbar?: ReactNode;
  /** Optional centered footer strip. */
  footer?: ReactNode;
  children: ReactNode;
  /** Fill a stable 80vh height (for tabbed / dynamic content) instead of
   *  sizing to the content. */
  fill?: boolean;
}

/**
 * Shared centered modal shell at the standard editor size (≤760px wide, ≤80vh
 * tall) on the app surface. The Keyboard Shortcuts sheet, the Diagnostics
 * Window, and the Settings / Plan & Billing menu all use it so they're
 * identical in size, surface, animation, and close affordance.
 */
export function Modal({
  open,
  onClose,
  title,
  icon: Icon,
  toolbar,
  footer,
  children,
  fill = false,
}: ModalProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  // Keyboard a11y: this shared shell isn't a radix Dialog, so it owns its keys /
  // focus — Escape closes it, and focus moves into the dialog on open.
  useEffect(() => {
    if (!open) return;
    boxRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  // Portal to <body> so the modal escapes any transformed ancestor (e.g. the
  // framer-motion TopBar) — a CSS transform traps `position: fixed` to that
  // ancestor and its stacking context, which would mis-position the overlay and
  // sink it below other panels.
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          variants={fadeIn}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            ref={boxRef}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            tabIndex={-1}
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={quickSpring}
            onClick={(e) => e.stopPropagation()}
            className={`flex w-full max-w-[760px] flex-col overflow-hidden rounded-xl border border-border bg-bg-secondary text-text-primary shadow-2xl outline-none ${
              fill ? "h-[80vh]" : "max-h-[80vh]"
            }`}
          >
            <div className="border-b border-border">
              <div className="flex items-center justify-between px-4 py-2.5">
                <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-text-secondary">
                  {Icon && <Icon className="h-4 w-4" />}
                  {title}
                </div>
                <TinyButton onClick={onClose} aria-label="Close">
                  <X className="h-4 w-4" />
                </TinyButton>
              </div>
              {toolbar && <div className="px-4 pb-2">{toolbar}</div>}
            </div>

            <div className="flex-1 overflow-y-auto">{children}</div>

            {footer && (
              <div className="border-t border-border px-4 py-2.5">{footer}</div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
