import { Smartphone } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Heads-up shown when the mobile version (< BP_MOBILE) takes over: upload,
 * view and download — no editing on a phone. The copy names downloading
 * because the viewer really does it (MobileShell's Download button saves the
 * stored bytes); it said "browse your gallery" while that button did not
 * exist yet. Same shape as the compact
 * version's notice; dismissible, and AppShell re-arms it once the window
 * grows back past the mobile floor. Replaces the old SmallWindowNotice
 * ("widen the window"), which stopped making sense once phone widths got a
 * real surface of their own instead of a cramped editor.
 */
export function MobileVersionNotice({ open, onOpenChange }: Props) {
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Mobile version"
      titleIcon={Smartphone}
      confirmLabel="Got it"
      onConfirm={() => onOpenChange(false)}
    >
      The mobile version uploads and downloads images. For the full
      photo editing suite, open Image Horse on a desktop or a wider
      window.
    </ConfirmDialog>
  );
}
