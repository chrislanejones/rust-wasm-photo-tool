// Page activity — the ONE "is anything loading right now" flag.
//
// The status bar's hourglass + mini progress bar reads this. Every loader that
// wants to be seen there opens a token with `beginActivity()` and closes it
// when it settles; the bar shows while any token is open. Sources wired in:
//
//   · every `fetch` on the page (`installActivityFetchTracker`, from main.tsx)
//   · every engine document load / archive save (engineLoadQueue)
//   · every `useAsyncTask` run — AI, export, ZIP, import, batch …
//   · the gallery while a tile in view is still decoding
//
// Rules, so a loader cannot get it wrong:
//   • Ending a token twice is a no-op — a counter would drift.
//   • Every token expires on its own after ACTIVITY_MAX_MS. A load that never
//     settles (a stream, a hung request) must not leave the hourglass flipping
//     for the rest of the session.
import { useEffect, useSyncExternalStore } from "react";

/** A token older than this closes itself. */
export const ACTIVITY_MAX_MS = 60_000;

const open = new Set<number>();
let nextId = 1;
const listeners = new Set<() => void>();

function emit(): void {
  for (const l of listeners) l();
}

/** Mark something as loading. Call the returned function when it settles. */
export function beginActivity(): () => void {
  const id = nextId++;
  const wasIdle = open.size === 0;
  open.add(id);
  if (wasIdle) emit();
  const timer = setTimeout(end, ACTIVITY_MAX_MS);
  function end(): void {
    clearTimeout(timer);
    if (!open.delete(id)) return;
    if (open.size === 0) emit();
  }
  return end;
}

/** Hold the activity flag open for as long as `promise` is pending. */
export function trackActivity<T>(promise: Promise<T>): Promise<T> {
  const end = beginActivity();
  promise.then(end, end);
  return promise;
}

export function isPageActive(): boolean {
  return open.size > 0;
}

function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** True while anything on the page is loading. */
export function usePageActivity(): boolean {
  return useSyncExternalStore(subscribe, isPageActive, isPageActive);
}

/** Hold the flag open while `active` is true (for loaders that are state, not
 *  a promise — the gallery's busy flag, a photo switch). */
export function useActivityWhile(active: boolean): void {
  useEffect(() => (active ? beginActivity() : undefined), [active]);
}

let fetchInstalled = false;

/** Wrap `window.fetch` so every request opens a token until its headers land
 *  (the body may stream on; whoever reads it can track that themselves). */
export function installActivityFetchTracker(): void {
  if (fetchInstalled || typeof window === "undefined" || typeof window.fetch !== "function") return;
  fetchInstalled = true;
  const original = window.fetch.bind(window);
  window.fetch = (...args: Parameters<typeof fetch>) => trackActivity(original(...args));
}

/** Test seam. */
export function __resetActivityForTests(): void {
  open.clear();
  emit();
}
