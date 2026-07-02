import { Maximize2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface Props {
  onDismiss: () => void;
}

/**
 * Shown only below BP_MIN (~600px). Image Horse is a single canvas-centric
 * workspace and genuinely needs room, so rather than forking a second layout we
 * surface a dismissible nudge (not a hard block): widen the window for the full
 * workspace, or continue anyway (Esc / click-outside dismiss too). Reappears if
 * the window shrinks below BP_MIN again after being dismissed. Uses the shared
 * ui/dialog notice-card variant (`size="sm"`), stacked at --z-modal so it sits
 * above any open dialog.
 */
export function SmallWindowNotice({ onDismiss }: Props) {
  return (
    <Dialog open onOpenChange={(o) => !o && onDismiss()}>
      <DialogContent
        size="sm"
        overlayClassName="z-[var(--z-modal)] bg-black/70 backdrop-blur-sm"
        className="z-[var(--z-modal)]"
      >
        <Maximize2 className="mx-auto h-8 w-8 text-text-muted" aria-hidden />
        <DialogTitle className="mt-3 text-base font-semibold leading-normal tracking-normal text-text-primary">
          A little more room, please
        </DialogTitle>
        <DialogDescription className="mt-1.5 text-sm leading-relaxed text-text-secondary">
          Image Horse needs a wider window to edit comfortably. Widen the
          window — or unsnap it — for the full workspace.
        </DialogDescription>
        <Button size="large" className="mt-4 w-full" onClick={onDismiss}>
          Continue anyway
        </Button>
      </DialogContent>
    </Dialog>
  );
}
