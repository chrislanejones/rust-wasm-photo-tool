// Full-screen "paused to save power" idle screen, shown after the idle timeout.
// A dimmed full-screen backdrop with a centered SmallDialog card (the same box
// as SmallWindowNotice) so the editor is fully covered — the browser can
// throttle the tab. Only "Continue" (→ wake) dismisses it; edits are safe.
import { Hourglass } from "lucide-react";
import { SmallDialog } from "@/components/SmallDialog";

export function IdleScreen({
  open,
  onContinue,
}: {
  open: boolean;
  onContinue: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[var(--z-idle)] flex items-center justify-center bg-black/70 p-6 backdrop-blur-sm">
      <SmallDialog
        icon={Hourglass}
        title="Paused to save power"
        actionLabel="Continue with Image Horse"
        onAction={onContinue}
      >
        Background activity is throttled after a while idle. Your edits are safe.
      </SmallDialog>
    </div>
  );
}
