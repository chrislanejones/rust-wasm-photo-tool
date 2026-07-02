// Full-screen "paused to save power" idle screen, shown after the idle timeout.
// A dimmed full-screen backdrop with a centered notice card so the editor is
// fully covered — the browser can throttle the tab. Only "Continue" (→ wake)
// dismisses it; edits are safe. Built on the shared ui/dialog primitives (one
// focus trap / animation across the app); the card content is exported so the
// Settings → Dev Tests preview (IdleScreenDialog) renders the identical card.
import { Hourglass } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

/** The idle notice card itself — must render inside a radix Dialog (uses
 *  DialogTitle/DialogDescription for the accessible name). */
export function IdleScreenCard({ onContinue }: { onContinue: () => void }) {
  return (
    <div className="max-w-xs rounded-2xl border border-border bg-card p-6 text-center shadow-panel">
      <Hourglass className="mx-auto h-8 w-8 text-text-muted" aria-hidden />
      <DialogTitle className="mt-3 text-base font-semibold leading-normal tracking-normal text-text-primary">
        Paused to save power
      </DialogTitle>
      <DialogDescription className="mt-1.5 text-sm leading-relaxed text-text-secondary">
        Background activity is throttled after a while idle. Your edits are
        safe.
      </DialogDescription>
      <Button size="large" className="mt-4 w-full" onClick={onContinue}>
        Continue with Image Horse
      </Button>
    </div>
  );
}

export function IdleScreen({
  open,
  onContinue,
}: {
  open: boolean;
  onContinue: () => void;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={() => {
        /* Not dismissable — only the Continue button (→ wake) closes it, so
           the editor stays covered while the tab is throttled. */
      }}
    >
      {/* Chrome-less content: the visible box is the card. Overlay + content
          ride at --z-idle so the idle screen covers every panel and dialog. */}
      <DialogContent
        overlayClassName="z-[var(--z-idle)] bg-black/70 backdrop-blur-sm"
        className="z-[var(--z-idle)] w-auto max-w-xs overflow-visible border-0 bg-transparent p-0 shadow-none"
      >
        <IdleScreenCard onContinue={onContinue} />
      </DialogContent>
    </Dialog>
  );
}
