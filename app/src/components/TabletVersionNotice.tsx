import { TabletSmartphone } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { LargeButton } from "@/components/ui/large-button";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Heads-up shown when the window is snapped/narrow (≤ ~1000px) but above the
 * too-small floor — the range where the compact "dock" layout takes over. A
 * dismissible nudge toward the split-screen / tablet version, built on the
 * shared Dialog primitives. Re-arms if the window grows wide and is snapped
 * narrow again (AppShell resets the dismissed flag).
 */
export function TabletVersionNotice({ open, onOpenChange }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TabletSmartphone className="h-5 w-5 text-theme-accent" />
            Use compact version
          </DialogTitle>
        </DialogHeader>
        <DialogBody>
          <DialogDescription>
            At this width Image Horse switches to its compact layout — tuned for
            split-screen and tablets. Widen the window any time for the full
            desktop workspace.
          </DialogDescription>
        </DialogBody>
        <DialogFooter>
          <LargeButton className="w-full" onClick={() => onOpenChange(false)}>
            Continue anyway
          </LargeButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
