// Compare mode (11-07-2026 — it was a dialog). The top bar's "Compare with
// another photo…" is a toggle: on, the gallery opens (if it was closed) and
// lights up with the drop ring, every photo shows its checkbox, and ticking
// two compares them. Off — the button again, or Done / Esc on the Compare bar —
// ends it. The gallery's right-click "Compare with this" still starts a
// compare directly.
//
// B is always the open photo (useScreenshotCompare), so the pair decides it:
// if one of the two is open it is B and the other is A; if neither is, the
// second one ticked is opened as B and compared with the first once its
// pixels are in the engine.
//
// Imperative (getState), like activateGroup, so the top bar and the gallery
// share one path without a prop through AppShell.
import { useEffect } from "react";
import { useScreenshotCompareStore } from "@/stores/useScreenshotCompareStore";
import { useGalleryStore } from "@/stores/useGalleryStore";
import { useUIStore } from "@/stores/useUIStore";
import { usePhotoSwitching } from "@/hooks/usePhotoSwitching";

/** How many photos compare mode picks. Two, for now. */
export const COMPARE_PICKS = 2;

/** The top bar's button: compare mode on (and the gallery open), or off. */
export function toggleCompareMode(): void {
  const cmp = useScreenshotCompareStore.getState();
  if (cmp.picking || cmp.otherId !== null) {
    cmp.stop();
    return;
  }
  cmp.beginPick();
  useUIStore.getState().setShowGallery(true);
}

/** A gallery checkbox in compare mode. Unticking ends any comparison; a
 *  third tick is refused until one is unticked. `openPhoto` is the gallery's
 *  own photo switch. */
export function toggleComparePick(id: string, openPhoto: (id: string) => void): void {
  const cmp = useScreenshotCompareStore.getState();
  if (cmp.picks.includes(id)) {
    cmp.setPicks(cmp.picks.filter((p) => p !== id));
    return;
  }
  if (cmp.picks.length >= COMPARE_PICKS) return;
  const picks = [...cmp.picks, id];
  cmp.setPicks(picks);
  if (picks.length < COMPARE_PICKS) return;

  const [first, second] = picks as [string, string];
  const open = useGalleryStore.getState().activePhotoId;
  if (open === first) cmp.start(second);
  else if (open === second) cmp.start(first);
  else {
    cmp.setPending({ a: first, b: second, from: open });
    openPhoto(second);
  }
}

/** Starts a pending pair once B is open and its pixels are in the engine.
 *  If B fails to open, or another photo is opened first, the pair is dropped
 *  and B unticked, so the gallery goes back to "1 of 2" and the stale pair
 *  can't start later when B is opened for some other reason.
 *  Mounted by CompareBar, which is always on the canvas. */
export function usePendingComparePick(): void {
  const pending = useScreenshotCompareStore((s) => s.pending);
  const activeId = useGalleryStore((s) => s.activePhotoId);
  const switchError = useUIStore((s) => s.photoSwitchError);
  const switching = usePhotoSwitching();
  useEffect(() => {
    if (!pending) return;
    const cmp = useScreenshotCompareStore.getState();
    const drop = () => cmp.setPicks(cmp.picks.filter((p) => p !== pending.b));
    if (activeId === pending.b) {
      if (switchError) drop();
      else if (!switching) cmp.start(pending.a);
    } else if (activeId !== pending.from) {
      // Superseded: a different photo was opened before B.
      drop();
    }
  }, [pending, activeId, switching, switchError]);
}
