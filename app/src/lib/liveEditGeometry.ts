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
import type { CornerRadii } from "./shapeSloppiness";

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
  // A corner-dot drag's radii, too, until the panel patch has reached a
  // reselected shape's style (see `setLiveRadii` below).
  const r = takeLiveRadii();
  if ((g || r) && dirty) dirty.current = true;
  const out = es && applyLiveGeometry(es, g);
  return out && r && out.style ? { ...out, style: { ...out.style, cornerRadii: r } } : out;
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

// ── The corner-radius dot (Night 10-22) ─────────────────────────────────────
// The same idea for Figma's corner dot. It used to write the panel's
// `cornerRadii` on every move, which re-rendered AppShell per move exactly as
// the body drag did before. Now a move writes here and only the edit box
// reads it; the panel takes the final radii once, on release, which reaches a
// reselected shape through `panelStylePatch` as a slider move would.
//
// The radii STAY here after release until that patch lands (useDrawingTools
// clears them), because the patch is a passive effect and an Enter pressed
// right after release can beat it — `takeLiveEdit` folds them into the commit.
let radii: CornerRadii | null = null;
const radiiListeners = new Set<() => void>();

export function setLiveRadii(next: CornerRadii | null): void {
  if (next === radii) return;
  radii = next;
  for (const fn of radiiListeners) fn();
}

/** The radii a dot drag has reached, still in the store. */
export const peekLiveRadii = (): CornerRadii | null => radii;

/** The radii a dot drag has reached, removed from the store. */
export function takeLiveRadii(): CornerRadii | null {
  const r = radii;
  setLiveRadii(null);
  return r;
}

function subscribeRadii(fn: () => void) {
  radiiListeners.add(fn);
  return () => {
    radiiListeners.delete(fn);
  };
}

const radiiSnapshot = () => radii;

/** The radii of a corner-dot drag in flight, or null. */
export function useLiveRadii(): CornerRadii | null {
  return useSyncExternalStore(subscribeRadii, radiiSnapshot, radiiSnapshot);
}
