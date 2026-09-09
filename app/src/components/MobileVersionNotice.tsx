import { Smartphone } from "lucide-react";
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
 * Heads-up shown when the mobile version (< BP_MOBILE) takes over: upload,
 * add, and view only — no editing on a phone. Same shape as the compact
 * version's notice; dismissible, and AppShell re-arms it once the window
 * grows back past the mobile floor. Replaces the old SmallWindowNotice
 * ("widen the window"), which stopped making sense once phone widths got a
 * real surface of their own instead of a cramped editor.
 */
export function MobileVersionNotice({ open, onOpenChange }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-theme-accent" />
            Mobile version
          </DialogTitle>
        </DialogHeader>
        <DialogBody>
          <DialogDescription>
            This is the Image Horse mobile version: upload images and browse
            your gallery. Editing needs more room — open the same gallery on a
            desktop or a wider window to pick up the full toolset.
          </DialogDescription>
        </DialogBody>
        <DialogFooter>
          <Button size="large" className="w-full" onClick={() => onOpenChange(false)}>
            Got it
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
