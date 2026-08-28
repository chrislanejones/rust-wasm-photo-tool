// "Use Image Horse here?" — shown in a tab that another tab has taken over.
//
// Same shape as IdleScreen on purpose: a chrome-less Dialog whose visible box is
// a card, riding at --z-idle so it covers every panel. The two screens mean the
// same thing to the user — this tab is parked, press the button to resume — so
// they should not look like two different features.
//
// Not dismissable. Esc and click-outside do nothing: while this is up the tab
// must not be edited, because both tabs write the same IndexedDB databases and
// the loser's work would be silently overwritten. The button is the only exit,
// which is exactly how Google Messages handles the same situation.
import { AppWindow } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

function MultiTabCard({ onUseHere }: { onUseHere: () => void }) {
  return (
    <div className="max-w-xs rounded-2xl border border-border bg-card p-6 text-center shadow-panel">
      <AppWindow className="mx-auto h-8 w-8 text-text-muted" aria-hidden />
      <DialogTitle className="mt-3 text-base font-semibold leading-normal tracking-normal text-text-primary">
        Use Image Horse here?
      </DialogTitle>
      <DialogDescription className="mt-1.5 text-sm leading-relaxed text-text-secondary">
        Image Horse is open in another tab. Only one can edit at a time, so two
        tabs can&rsquo;t overwrite each other&rsquo;s work. Your edits are safe.
      </DialogDescription>
      <Button size="large" className="mt-4 w-full" onClick={onUseHere}>
        Use here
      </Button>
    </div>
  );
}

export function MultiTabScreen({
  open,
  onUseHere,
}: {
  open: boolean;
  onUseHere: () => void;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={() => {
        /* Not dismissable — "Use here" is the only way out, so a parked tab
           cannot be edited into conflict with the active one. */
      }}
    >
      <DialogContent
        overlayClassName="z-[var(--z-idle)] bg-black/70 backdrop-blur-sm"
        className="z-[var(--z-idle)] w-auto max-w-xs overflow-visible border-0 bg-transparent p-0 shadow-none"
      >
        <MultiTabCard onUseHere={onUseHere} />
      </DialogContent>
    </Dialog>
  );
}
