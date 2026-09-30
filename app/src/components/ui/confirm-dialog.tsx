// The small "one question, one or two buttons" dialog: a title, a sentence,
// and a footer. Built on ui/dialog (focus trap, Esc, restore) — this only fixes
// the layout, so the six dialogs that share it cannot drift:
//
//   · delete all / delete this image / delete selected — Cancel + destructive
//   · update to the latest version?                    — No + affirmative
//   · compact / mobile version notices                 — one full-width button
//
// Each of those used to spell out the same eighteen lines of Dialog markup.
import type { LucideIcon } from "lucide-react";
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CONFIRM_AFFIRMATIVE, CONFIRM_DESTRUCTIVE } from "@/lib/styles";

const TONE = {
  destructive: CONFIRM_DESTRUCTIVE,
  affirmative: CONFIRM_AFFIRMATIVE,
} as const;

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  /** Glyph beside the title, in the accent. */
  titleIcon?: LucideIcon;
  /** The sentence under the title. */
  children: React.ReactNode;
  confirmLabel: React.ReactNode;
  confirmIcon?: LucideIcon;
  onConfirm: () => void;
  /** Solid fill + white label for a real decision (lib/styles CONFIRM_*).
   *  Omit for a plain acknowledgement. */
  tone?: keyof typeof TONE;
  /** Renders a Cancel-style button (it just closes) before the confirm one.
   *  Omit for a single full-width button. */
  cancelLabel?: string;
  /** Opened from inside a modal (Settings): lift it above that modal, or it
   *  opens behind it and the button that opened it seems to do nothing. */
  overModal?: boolean;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  titleIcon: TitleIcon,
  children,
  confirmLabel,
  confirmIcon: ConfirmIcon,
  onConfirm,
  tone,
  cancelLabel,
  overModal,
}: ConfirmDialogProps) {
  const width = cancelLabel ? "flex-1" : "w-full";
  const layer = overModal ? "z-[var(--z-over-modal)]" : undefined;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={layer ? `max-w-sm ${layer}` : "max-w-sm"} overlayClassName={layer}>
        <DialogHeader>
          <DialogTitle className={TitleIcon ? "flex items-center gap-2" : undefined}>
            {TitleIcon && <TitleIcon className="h-5 w-5 text-theme-accent" />}
            {title}
          </DialogTitle>
        </DialogHeader>
        <DialogBody>
          <DialogDescription>{children}</DialogDescription>
        </DialogBody>
        <DialogFooter>
          {cancelLabel && (
            <DialogClose asChild>
              <Button size="large" className="flex-1">
                {cancelLabel}
              </Button>
            </DialogClose>
          )}
          <Button
            size="large"
            onClick={onConfirm}
            className={tone ? `${width} ${TONE[tone]}` : width}
          >
            {ConfirmIcon && <ConfirmIcon className="h-4 w-4" />}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
