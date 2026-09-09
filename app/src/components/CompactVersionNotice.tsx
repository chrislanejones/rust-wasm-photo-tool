import { PanelLeft } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Heads-up shown when the window is snapped/narrow (≤ ~1000px) but above the
 * mobile floor — the range where the compact "dock" layout takes over. This is
 * the COMPACT version: full editing, laid out for a window snapped to half the
 * screen (Win+←/→ / split-screen) — the left icon rail + sliding panel. It was
 * once called the "tablet version", but its real audience is snapped desktop
 * windows. A dismissible nudge built on the shared Dialog primitives; re-arms
 * if the window grows wide and is snapped narrow again (AppShell resets the
 * dismissed flag).
 */
export function CompactVersionNotice({ open, onOpenChange }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PanelLeft className="h-5 w-5 text-theme-accent" />
            Compact version
          </DialogTitle>
        </DialogHeader>
        <DialogBody>
          <DialogDescription>
            At this width Image Horse switches to its compact version — the full
            editor, laid out for a window snapped to half the screen (Win+←/→)
            or split-screen. Widen the window any time for the full desktop
            workspace.
          </DialogDescription>
        </DialogBody>
        <DialogFooter>
          <Button size="large" className="w-full" onClick={() => onOpenChange(false)}>
            Continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
