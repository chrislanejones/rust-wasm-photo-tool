import { Maximize2 } from "lucide-react";
import { SmallDialog } from "@/components/SmallDialog";

interface Props {
  onDismiss: () => void;
}

/**
 * Shown only below BP_MIN (~600px). Image Horse is a single canvas-centric
 * workspace and genuinely needs room, so rather than forking a second layout we
 * surface a dismissible nudge (not a hard block): widen the window for the full
 * workspace, or continue anyway. Reappears if the window shrinks below BP_MIN
 * again after being dismissed.
 */
export function SmallWindowNotice({ onDismiss }: Props) {
  return (
    <div className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center bg-black/70 p-6 backdrop-blur-sm">
      <SmallDialog
        icon={Maximize2}
        title="A little more room, please"
        actionLabel="Continue anyway"
        onAction={onDismiss}
      >
        Image Horse needs a wider window to edit comfortably. Widen the window —
        or unsnap it — for the full workspace.
      </SmallDialog>
    </div>
  );
}
