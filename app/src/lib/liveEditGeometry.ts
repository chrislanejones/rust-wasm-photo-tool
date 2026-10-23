// The shape edit box's geometry WHILE a handle is being dragged.
//
// WHY THIS EXISTS. A drag used to push every pointermove into
// useDrawingTools' `setEditState`, which lives in AppShell — so each move
// re-rendered the whole editor (about 990 fibers, two commits) in a task
// after the event. Measured 10-21 at 100 annotations: 14 ms from the handler
// to the overlay's DOM write unthrottled, 81 ms at 4× CPU, out of a 21 ms
// event → DOM total. See docs/benchmarks/README.md, "Where the drag's 21 ms
// goes".
//
// Now a drag writes here instead. Only the two components that draw the box
// subscribe (ShapeEditOverlay and ShapeActionsOverlay), and a store update
// from an event listener is a sync-lane render, so the DOM is written inside
// the event's own task. React state catches up once, on release: the overlay
// calls `onDrawEditChange` with the last geometry and clears this store in the
// same pointerup, so both land in one commit and nothing jumps back.
//
// The engine is untouched during a drag, as before; it recomposes on commit.
// One edit box exists at a time, so a module-level store is enough.
import { useMemo, useSyncExternalStore } from "react";
import { withEditGeometry, type DrawEditState, type Point } from "./drawEditState";
import type { ShapeName } from "./types";

export interface LiveGeometry {
  start: Point;
  end: Point;
  /** Only the rotate handle sets it; undefined keeps the edit's own. */
  rotation?: number;
  /** Only the oval handle sets it (a circle stretched into an oval). */
  shape?: ShapeName;
}

let current: LiveGeometry | null = null;
const listeners = new Set<() => void>();

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

const snapshot = () => current;

export function setLiveGeometry(next: LiveGeometry | null): void {
  if (next === current) return;
  current = next;
  for (const fn of listeners) fn();
}

/** One drag step — the same arguments as the overlay's `onDrawEditChange`. */
export function moveLiveGeometry(start: Point, end: Point, rotation?: number, shape?: ShapeName): void {
  setLiveGeometry({ start, end, rotation, shape });
}

/** The in-flight drag geometry, removed from the store. */
export function takeLiveGeometry(): LiveGeometry | null {
  const g = current;
  setLiveGeometry(null);
  return g;
}

/** A handle drag is in flight — the box has changed even though React's
 *  edit state has not caught up yet. */
export const liveDragActive = () => current !== null;

/** `es` with the in-flight drag taken out of the store and applied. Commit
 *  and cancel read the box through this, so Enter mid-drag commits what is
 *  on screen and no drag outlives its box. A taken drag marks `dirty`, as
 *  the moves it stands for would have. */
export function takeLiveEdit(
  es: DrawEditState | null,
  dirty?: { current: boolean },
): DrawEditState | null {
  const g = takeLiveGeometry();
  if (g && dirty) dirty.current = true;
  return es && applyLiveGeometry(es, g);
}

/** `es` with the in-flight drag applied, or `es` itself when nothing is
 *  being dragged. */
export function applyLiveGeometry(es: DrawEditState, g: LiveGeometry | null): DrawEditState {
  return g ? withEditGeometry(es, g.start, g.end, g.rotation, g.shape) : es;
}

/** What the edit box shows: React's edit state plus any drag in progress. */
export function useLiveEditState(es: DrawEditState): DrawEditState {
  const g = useSyncExternalStore(subscribe, snapshot, snapshot);
  return useMemo(() => applyLiveGeometry(es, g), [es, g]);
}

// ── A multi-select group drag (Night 10-22) ─────────────────────────────────
// The same idea for several objects at once: while the group is dragged only
// its overlay follows, as one translate in IMAGE px, and the engine moves the
// objects once, on release (`move_annotations`). Only the selection overlay
// subscribes.
let groupOffset: Point | null = null;
const groupListeners = new Set<() => void>();

export function setLiveGroupOffset(next: Point | null): void {
  if (next === groupOffset) return;
  groupOffset = next;
  for (const fn of groupListeners) fn();
}

function subscribeGroup(fn: () => void) {
  groupListeners.add(fn);
  return () => {
    groupListeners.delete(fn);
  };
}

const groupSnapshot = () => groupOffset;

/** The group drag in flight, or null. */
export function useLiveGroupOffset(): Point | null {
  return useSyncExternalStore(subscribeGroup, groupSnapshot, groupSnapshot);
}
