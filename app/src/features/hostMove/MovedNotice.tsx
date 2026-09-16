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
    // Plain `toast`, not `toast.info`, and wrapped: the Toaster lays every
    // toast out as ONE row (icon · text · action), which squeezed this much
    // text to ~110px beside the button and broke the address mid-word
    // ("edit.imagehorse.ap / p") on the Netlify preview. With no icon, the
    // text takes the full first row and the button wraps below it, still
    // right-aligned by the Toaster's own `ml-auto`. sonner APPENDS these to
    // the Toaster's classNames, so only additions are safe here — nothing
    // that has to win against an existing class. `pr-5` clears the close X.
    toast("Image Horse has moved to edit.imagehorse.app", {
      id: TOAST_ID,
      duration: Infinity,
      classNames: { toast: "flex-wrap", content: "basis-full", title: "pr-5" },
      // Kept short on purpose (Chris, 2026-09-15). Only signed-out users lose
      // anything, so they are the only ones addressed.
      description:
        "Not signed in? Download your photos first with Alt+Shift+E. This address forwards there on September 29.",
      action: {
        label: "Open the new address",
        onClick: () => window.open(EDITOR_URL, "_blank", "noopener"),
      },
    });
  }, []);
  return null;
}
