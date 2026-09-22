// One toast when settings sync stops working. Renders nothing.
//
// ONE PER EPISODE, not one per failure. A failed push retries on a backoff,
// and every local change while offline flips the status to "syncing"
// and back to "error" — so a toast per transition would re-open itself for as
// long as the connection was down, which is the behavior that got the
// undo-depth toast replaced with a status-bar readout. This one speaks once,
// stays quiet through every retry, and is allowed to speak again only after a
// real "synced" has ended the episode.
//
// The fixed id means Sonner replaces the toast rather than stacking a second,
// and lets a recovery take it down instead of leaving a stale warning on screen
// over a sync that is working again.
//
// Deliberately NOT a toast for success, for "connecting", or for the signed-out
// state: a sync that works is silent. Settings → Sync has the detail.
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useSyncStatus } from "./status";

const TOAST_ID = "settings-sync-error";

export function SyncErrorToast() {
  const { state, willRetry } = useSyncStatus();
  const toldRef = useRef(false);

  useEffect(() => {
    if (state === "error") {
      if (toldRef.current) return;
      toldRef.current = true;
      toast.error("Settings sync isn't working", {
        id: TOAST_ID,
        // "It will keep trying" only when something will: a change the server
        // refused outright is not retried on a timer (useCloudSync).
        description: willRetry
          ? "Your settings are saved on this device. It will keep trying."
          : "Your settings are saved on this device. Settings › Sync says what went wrong.",
      });
      return;
    }
    if (state === "synced" && toldRef.current) {
      toldRef.current = false;
      toast.dismiss(TOAST_ID);
    }
  }, [state, willRetry]);

  return null;
}
