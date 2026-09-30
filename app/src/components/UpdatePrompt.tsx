import { useSyncExternalStore } from "react";
import { RefreshCw } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  acceptUpdatePrompt,
  dismissUpdatePrompt,
  isUpdatePromptOpen,
  subscribeUpdatePrompt,
} from "@/lib/pwa/updatePrompt";

/**
 * "A new version is ready" — Yes or No.
 *
 * Deliberately the same shape as the delete confirms in AppShell — literally:
 * both are `ConfirmDialog` — rather than a bespoke banner: both
 * are the app asking permission for something that changes what is in front of
 * you, and they should not look like two different kinds of question. The state
 * lives in lib/pwa/updatePrompt.ts, which is what the non-React triggers can
 * reach; this component only renders it.
 *
 * Dismissable on purpose, unlike MultiTabScreen: declining an update is a
 * legitimate answer, and an editing session must never be yanked onto a new
 * build. Esc and click-outside both count as No.
 */
export function UpdatePrompt() {
  const open = useSyncExternalStore(subscribeUpdatePrompt, isUpdatePromptOpen);

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) dismissUpdatePrompt();
      }}
      title="Update to the latest version?"
      cancelLabel="No"
      confirmLabel="Yes"
      confirmIcon={RefreshCw}
      tone="affirmative"
      onConfirm={acceptUpdatePrompt}
    >
      A new version of Image Horse is ready. Updating reloads this tab.
      Your photos and edits are stored in this browser and stay where they
      are.
    </ConfirmDialog>
  );
}
