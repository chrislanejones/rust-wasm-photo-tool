// The update-available UI. Was a sonner toast ("Update available" + a Reload
// action); it is a Dialog now (Chris, 2026-07-28): "Update to the latest
// version?" — Yes or No, on the same `ui/dialog` primitive the delete confirms
// use, so a decision about the app looks like every other decision the app asks
// for. `updateToast.ts` is gone; this file replaces it one-for-one.
//
// Fired by two independent triggers that share this single prompt:
//   1. swBoot.ts — a new service worker is installed and WAITING (the normal
//      prompt-update flow; Yes posts SKIP_WAITING then reloads).
//   2. skew.ts — the network's version.json disagrees with the hash baked into
//      this running bundle (Yes is a plain location.reload()).
//
// Module-level state + subscribe, deliberately NOT a store and NOT a window
// CustomEvent: the triggers are plain modules that run outside React (new
// CustomEvents are forbidden in this repo), and keeping the prompt's state here
// keeps the whole PWA surface inside lib/pwa exactly as the toast did. React
// reads it through useSyncExternalStore in components/UpdatePrompt.tsx.
//
// NOTE ON REACH: both triggers sit behind `__IH_SW_MODE__`, which ships "off"
// by default, so in a default production build neither can fire and this prompt
// cannot appear. That is pre-existing (the toast had the same reach) and is not
// changed here — arming it is a service-worker rollout decision under ADR-019,
// not a UI change. Logged in PARKING_LOT.

type Listener = () => void;

/** The trigger's own "do the update" callback, or null when nothing is
 *  pending. Holding the callback rather than a flag is what lets one prompt
 *  serve two triggers whose reload paths differ. */
let pending: (() => void) | null = null;

const listeners = new Set<Listener>();

function emit(): void {
  for (const listener of listeners) listener();
}

export function subscribeUpdatePrompt(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Snapshot for useSyncExternalStore — a boolean, so the snapshot is stable
 *  between emits and can't drive a render loop. */
export function isUpdatePromptOpen(): boolean {
  return pending !== null;
}

/** Raise the prompt. One at a time: a second trigger while a prompt is already
 *  up is dropped rather than stacking two dialogs over the canvas. */
export function showUpdatePrompt(onUpdate: () => void): void {
  if (pending) return;
  pending = onUpdate;
  emit();
}

/** "No" — also the Esc / click-outside path. Clears the latch so a later
 *  trigger (the next `updatefound`, or the hourly poll) can offer again: the
 *  prompt must stay ignorable without becoming un-ignorable. */
export function dismissUpdatePrompt(): void {
  if (!pending) return;
  pending = null;
  emit();
}

/** "Yes" — clear the latch first, then hand back to whichever trigger raised
 *  it. Clearing first means the dialog is already closing while the reload is
 *  being arranged, and a callback that throws can't leave a stuck prompt. */
export function acceptUpdatePrompt(): void {
  const run = pending;
  pending = null;
  emit();
  run?.();
}
