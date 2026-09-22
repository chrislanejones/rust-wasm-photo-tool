// "This tab is parked — press the button to resume." The shape behind both
// IdleScreen (paused to save power) and MultiTabScreen (another tab took over):
// a chrome-less Dialog whose visible box is a notice card, riding at --z-idle
// so it covers every panel and dialog.
//
// The two screens mean the same thing to the user, so they are the same
// component — they used to be two byte-identical cards, plus a third wrapper
// (IdleScreenDialog) that boxed the idle card again for the Dev Tests preview.
//
// Not dismissable in the app. Esc and click-outside do nothing; the button is
// the only exit. For the idle screen that keeps the editor covered while the
// browser throttles the tab; for the multi-tab screen it stops a parked tab
// being edited into conflict with the live one (both write the same IndexedDB
// databases, and the loser's work would be silently overwritten).
import type { LucideIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ParkedScreenProps {
  open: boolean;
  icon: LucideIcon;
  title: string;
  /** The sentence under the title. */
  children: React.ReactNode;
  actionLabel: string;
  onAction: () => void;
  /** Settings → Dev Tests preview: X / Esc / click-outside close it (as the
   *  action), and it stacks above the Settings modal instead of at --z-idle. */
  preview?: boolean;
}

export function ParkedScreen({
  open,
  icon: Icon,
  title,
  children,
  actionLabel,
  onAction,
  preview = false,
}: ParkedScreenProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o && preview) onAction();
      }}
    >
      <DialogContent
        overlayClassName={preview ? undefined : "z-[var(--z-idle)]"}
        className={cn(
          "w-auto max-w-xs overflow-visible border-0 bg-transparent p-0 shadow-none",
          preview ? "z-[var(--z-devpreview)]" : "z-[var(--z-idle)]",
        )}
      >
        <div className="max-w-xs rounded-2xl border border-border bg-card p-6 text-center shadow-panel">
          <Icon className="mx-auto h-8 w-8 text-text-muted" aria-hidden />
          <DialogTitle className="mt-3 text-base font-semibold leading-normal tracking-normal text-text-primary">
            {title}
          </DialogTitle>
          <DialogDescription className="mt-1.5 text-sm leading-relaxed text-text-secondary">
            {children}
          </DialogDescription>
          <Button size="large" className="mt-4 w-full" onClick={onAction}>
            {actionLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
