import { toast } from "sonner";

// The update-available UI, per the run brief: the smallest possible surface
// on the EXISTING toast primitive (ui/sonner.tsx themes it globally) — no new
// components. Fired by two independent triggers that share this single toast:
//   1. swBoot.ts — a new service worker is installed and WAITING (the normal
//      prompt-update flow; Reload messages SKIP_WAITING then reloads).
//   2. skew.ts — the network's version.json disagrees with the hash baked
//      into this running bundle (stale cache serving an old build; Reload is
//      a plain location.reload()).

let visible = false;

export function showUpdateToast(onReload: () => void): void {
  // One prompt at a time; `id` also dedupes at the sonner level. Dismissing
  // clears the latch so a later trigger (e.g. the next updatefound) can
  // re-prompt — the prompt must stay ignorable, not become un-ignorable.
  if (visible) return;
  visible = true;
  toast("Update available", {
    id: "ih-sw-update",
    description: "A new version of Image Horse is ready.",
    duration: Infinity,
    onDismiss: () => {
      visible = false;
    },
    action: {
      label: "Reload",
      onClick: () => onReload(),
    },
  });
}
