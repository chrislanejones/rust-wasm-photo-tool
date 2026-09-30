// "Use Image Horse here?" — shown in a tab that another tab has taken over.
// A `ParkedScreen`, the same card as IdleScreen on purpose: both mean "this tab
// is parked, press the button to resume". "Use here" is the only way out, which
// is exactly how Google Messages handles the same situation.
import { AppWindow } from "lucide-react";
import { ParkedScreen } from "@/components/ParkedScreen";

export function MultiTabScreen({
  open,
  onUseHere,
}: {
  open: boolean;
  onUseHere: () => void;
}) {
  return (
    <ParkedScreen
      open={open}
      icon={AppWindow}
      title="Use Image Horse here?"
      actionLabel="Use here"
      onAction={onUseHere}
    >
      Image Horse is open in another tab. Only one can edit at a time, so two
      tabs can&rsquo;t overwrite each other&rsquo;s work. Your edits are safe.
    </ParkedScreen>
  );
}
