import { useSyncExternalStore } from "react";
import { RefreshCw } from "lucide-react";
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CONFIRM_AFFIRMATIVE } from "@/lib/styles";
import {
  acceptUpdatePrompt,
  dismissUpdatePrompt,
  isUpdatePromptOpen,
  subscribeUpdatePrompt,
} from "@/lib/pwa/updatePrompt";

/**
 * "A new version is ready" — Yes or No.
 *
 * Deliberately the same shape as the delete confirms in AppShell (`max-w-sm`
 * Dialog, header / body / two-button footer) rather than a bespoke banner: both
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
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) dismissUpdatePrompt();
      }}
    >
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Update to the latest version?</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <DialogDescription>
            A new version of Image Horse is ready. Updating reloads this tab.
            Your photos and edits are stored in this browser and stay where they
            are.
          </DialogDescription>
        </DialogBody>
        <DialogFooter>
          <DialogClose asChild>
            <Button size="large" className="flex-1">
              No
            </Button>
          </DialogClose>
          <Button
            size="large"
            onClick={acceptUpdatePrompt}
            className={`flex-1 ${CONFIRM_AFFIRMATIVE}`}
          >
            <RefreshCw className="h-4 w-4" />
            Yes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
