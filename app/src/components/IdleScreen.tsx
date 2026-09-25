// Full-screen "paused to save power" idle screen, shown after the idle timeout.
// The editor is fully covered while the browser throttles the tab; only
// "Continue" (→ wake) dismisses it, and edits are safe. A `ParkedScreen`, the
// same card MultiTabScreen shows. `preview` is the Settings → Dev Tests
// harness, which opens it without waiting for a real timeout.
import { Hourglass } from "lucide-react";
import { ParkedScreen } from "@/components/ParkedScreen";

export function IdleScreen({
  open,
  onContinue,
  preview,
}: {
  open: boolean;
  onContinue: () => void;
  preview?: boolean;
}) {
  return (
    <ParkedScreen
      open={open}
      icon={Hourglass}
      title="Paused to save power"
      actionLabel="Continue with Image Horse"
      onAction={onContinue}
      preview={preview}
    >
      Background activity is throttled after a while idle. Your edits are
      safe.
    </ParkedScreen>
  );
}
