// ADR-024 Stage 4, step a11.1 — make canvas mount/unmount observable.
//
// WHAT REMOUNTS, MEASURED. Not "an ordinary tool switch" — that was checked in
// the browser against the v7.90 production build and the element survives
// compress → brush → crop → magic-wand → compress intact. The canvas is
// re-created when crossing the **Batch** boundary (`activeTool === "emoji"`),
// because `AppShell` renders `<CanvasArea>` at TWO tree positions — one per
// branch of that ternary (:3155 and :3244) — so React unmounts one and mounts
// the other. Measured: entering Batch, leaving it, and entering again produced
// three distinct elements.
//
// TWO COMMENTS IN THE CODEBASE DESCRIBE THIS WRONGLY, and both were believed
// long enough to shape a plan:
//
//   CanvasArea.tsx:544  says the re-blit effect fires when "the canvas element
//                       re-mounts (ref changes)". `canvasRef` is a `useRef`
//                       created once in AppShell:253 — a ref OBJECT's identity
//                       never changes, so that dependency is inert.
//   AppShell.tsx:3108   says CanvasArea is "rendered ONCE (a stable React
//                       subtree)". It is rendered twice.
//
// The recovery works anyway, by a different route: CanvasArea itself unmounts
// and remounts, so its effects run fresh and `flushToCanvas()` fires on mount.
// Nothing anywhere depends on ref identity. That matters for what comes next —
// this is not replacing a fragile dependency, it is adding an observation point
// that does not currently exist.
//
// WHY IT NEEDS TO EXIST. Under `transferControlToOffscreen()` a remount is no
// longer self-healing: the worker holds the OffscreenCanvas of an element React
// has discarded, keeps drawing into it, and nothing throws. The element on
// screen is a fresh one nobody is drawing to, so the user sees blank — silently,
// from an ordinary action, and possibly fixed by the next remount, which is the
// profile that let the batch-export bug survive two months.
//
// a11.2 turns this generation into a protocol field so the worker can REFUSE a
// draw aimed at a dead element instead of performing it into the void. This
// step only makes the fact observable; it changes no behaviour.
//
// WHY A SEPARATE MODULE. vitest runs in the `node` environment here, so a React
// component test is not available. The bookkeeping is pure — "an element
// arrived" / "an element left" — so it lives outside React and is tested
// directly. `useCanvasIdentity` below is a thin binding.
import { useCallback, useRef } from "react";
import type { Ref, MutableRefObject } from "react";

/** Write a value through either style of React ref. `forwardRef` permits both,
 *  and `CanvasArea` currently assumes the object form (it casts at :460). */
export function assignRef<T>(ref: Ref<T> | undefined, value: T | null): void {
  if (typeof ref === "function") ref(value);
  else if (ref) (ref as MutableRefObject<T | null>).current = value;
}

export interface CanvasIdentityEvents<T> {
  /** A new element is live. `generation` is its id: 1 for the first, and one
   *  higher for every element after it. */
  onMount?: (el: T, generation: number) => void;
  /** The element of `generation` is gone. Anything holding a handle to it —
   *  a worker's OffscreenCanvas, most of all — is now pointing at nothing. */
  onUnmount?: (generation: number) => void;
}

export interface CanvasIdentity<T> {
  /** Give this to `ref={...}`. */
  attach: (el: T | null) => void;
  /** Monotonic. **0 means nothing has ever mounted**, so a draw tagged 0 is
   *  always stale — there is no valid element it could refer to. */
  generation: () => number;
  current: () => T | null;
}

/**
 * Track which canvas element is live, and how many have been before it.
 *
 * `sink` is the ref the rest of the app already reads through
 * (`canvasRef.current`); it stays populated exactly as it is today, so this is
 * additive. Everything else here is new information nobody had.
 *
 * **Re-attaching the SAME element does not advance the generation.** React
 * invokes a callback ref again whenever the callback's identity changes, and a
 * component this size re-renders constantly — counting those as remounts would
 * make the generation meaningless within a frame or two, and would make a11.2
 * reject every draw. Identity is the element, not the number of calls.
 */
export function createCanvasIdentity<T>(
  sink: { current: T | null },
  events: CanvasIdentityEvents<T> = {},
): CanvasIdentity<T> {
  let generation = 0;
  let live: T | null = null;

  return {
    attach(el: T | null) {
      if (el === live) return; // same element (or null twice) — nothing happened
      if (live !== null) {
        const dead = generation;
        live = null;
        sink.current = null;
        events.onUnmount?.(dead);
      }
      if (el !== null) {
        generation += 1;
        live = el;
        sink.current = el;
        events.onMount?.(el, generation);
      }
    },
    generation: () => generation,
    current: () => live,
  };
}

/**
 * React binding for `createCanvasIdentity`.
 *
 * The returned `attach` is stable for the life of the component, which is what
 * keeps React from re-invoking it on ordinary re-renders — and therefore what
 * keeps this from changing WHEN the canvas remounts. Changing remount timing
 * would be a live-render change wearing plumbing's clothes, and is the declared
 * stop condition for this step.
 */
export function useCanvasIdentity<T>(
  forwarded: Ref<T> | undefined,
  events: CanvasIdentityEvents<T> = {},
): CanvasIdentity<T> {
  // Both read through refs so callers may pass inline closures, and so the
  // parent may swap ref style, without rebuilding the identity or
  // destabilising `attach`. Declared BEFORE the identity: the sink closes over
  // them, and building the identity first put `forwardedRef` in its own
  // temporal dead zone.
  const forwardedRef = useRef(forwarded);
  forwardedRef.current = forwarded;
  const eventsRef = useRef(events);
  eventsRef.current = events;

  const identityRef = useRef<CanvasIdentity<T> | null>(null);
  if (identityRef.current === null) {
    // Write-only: the app keeps reading the parent's ref directly, so this
    // exists purely to forward. Reads return the live element for symmetry.
    let mirrored: T | null = null;
    const sink = {
      get current(): T | null {
        return mirrored;
      },
      set current(v: T | null) {
        mirrored = v;
        assignRef(forwardedRef.current, v);
      },
    };
    identityRef.current = createCanvasIdentity<T>(sink, {
      onMount: (el, gen) => eventsRef.current.onMount?.(el, gen),
      onUnmount: (gen) => eventsRef.current.onUnmount?.(gen),
    });
  }

  const identity = identityRef.current;
  const attach = useCallback((el: T | null) => identity.attach(el), [identity]);

  return { attach, generation: identity.generation, current: identity.current };
}
