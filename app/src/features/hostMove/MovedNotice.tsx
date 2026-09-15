import { useEffect } from "react";
import { toast } from "@/components/ui/sonner";
import { EDITOR_URL, isLegacyHost } from "@/lib/legacyHost";

/** Fixed so StrictMode's double effect, or a remount, shows ONE notice. */
const TOAST_ID = "legacy-host-moved";

/**
 * On the retired Netlify address only: say the editor moved, and tell anyone
 * who saved photos without signing in to download them before this address
 * starts forwarding. See `lib/legacyHost.ts` for why that library cannot
 * follow them. Renders nothing; the notice is a toast that stays until closed.
 *
 * The button opens the new address in a NEW tab so this one stays open for
 * Export all — navigating away here would take the user off the only origin
 * their library can be read from.
 */
export function MovedNotice() {
  useEffect(() => {
    if (!isLegacyHost(window.location.hostname)) return;
    toast.info("Image Horse has moved to edit.imagehorse.app", {
      id: TOAST_ID,
      duration: Infinity,
      description:
        "This address starts forwarding there on September 29. Signed in? Your gallery is already there. Not signed in? Photos saved here stay on this address, so download them first with Alt+Shift+E (Export all).",
      action: {
        label: "Open the new address",
        onClick: () => window.open(EDITOR_URL, "_blank", "noopener"),
      },
    });
  }, []);
  return null;
}
