// Compare mode (11-07-2026 — it was a dialog). The top bar's "Compare with
// another photo…" is a toggle: on, the gallery opens (if it was closed) and
// lights up with the drop ring, every photo shows its checkbox, and ticking
// two compares them. Off — the button again, the X in the gallery, a click
// anywhere else, or Done / Esc on the Compare bar — ends it. The gallery's right-click "Compare with this" still starts a
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
import { isPhotoSwitching, usePhotoSwitching } from "@/hooks/usePhotoSwitching";

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
  if (open === first || open === second) {
    const other = open === first ? second : first;
    // The open photo may still be loading (or have failed to): the engine
    // could hold the previous photo's pixels, so wait the pending way.
    if (isPhotoSwitching()) cmp.setPending({ a: other, b: open, from: open });
    else cmp.start(other);
  } else {
    cmp.setPending({ a: first, b: second, from: open });
    openPhoto(second);
  }
}

/** Where a pointerdown does NOT leave compare mode: the gallery (where the
 *  picking happens), the Compare bar and the views it draws over the canvas
 *  (the Slider's handle, Side by side), and the top bar's own toggle, whose
 *  click does the leaving itself. Each carries `data-compare-keep`. Anything
 *  floating over the page — a menu, a tooltip, a dialog — is kept too. */
const COMPARE_KEEP =
  "[data-compare-keep], [role=dialog], [role=alertdialog], [role=menu], [role=listbox], [role=tooltip], [data-radix-popper-content-wrapper]";

/** While a dialog, menu or list is open, a click elsewhere is closing THAT,
 *  so it doesn't also leave compare mode — one click, one thing dismissed. */
const OPEN_LAYER = "[role=dialog], [role=alertdialog], [role=menu], [role=listbox]";

/** Does a pointerdown on `target` count as "clicking elsewhere"? */
export function leavesCompareMode(target: EventTarget | null): boolean {
  if (!(target instanceof Element) || !target.isConnected) return false;
  if (target.closest(COMPARE_KEEP)) return false;
  return target.ownerDocument.querySelector(OPEN_LAYER) === null;
}

/** Compare mode ends on a pointerdown anywhere else — the same `stop` as the
 *  top bar's button, the gallery's X and Esc. Capture phase, so a control
 *  that stops propagation still counts as somewhere. Mounted by CompareBar,
 *  which is always on the canvas, so it works with the gallery closed too. */
export function useCompareClickAway(): void {
  const picking = useScreenshotCompareStore((s) => s.picking);
  useEffect(() => {
    if (!picking) return;
    const onDown = (e: PointerEvent) => {
      if (leavesCompareMode(e.target)) useScreenshotCompareStore.getState().stop();
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [picking]);
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
