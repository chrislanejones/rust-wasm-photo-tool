import { create } from "zustand";
import type { Quad } from "@/lib/perspective";
import type { PerspectiveTarget } from "@/lib/perspectiveTarget";

// The Perspective tool's live quad, plus the commit actions the panel needs.
//
// WHY A STORE AND NOT PROPS, when every other tool panel is prop-driven from
// AppShell. Three components need the same gesture state — the overlay
// (features/canvas), the panel (features/tools/settings) and the hook that
// talks to the engine — and they sit in three different subtrees whose only
// common ancestor is AppShell. Prop-drilling it would mean adding state and
// six props to the file CLAUDE.md says not to add anything to, for a tool that
// is brand new and therefore has no legacy prop chain to match.
//
// This is also the direction the refactor is already going (Stage 1: orphan
// useState → stores). The existing panels stay prop-driven because moving them
// is its own migration session; this one starts where the others are heading.
//
// NOT PERSISTED, and deliberately not a `persist` store at all: an in-progress
// quad is transient gesture state, so there is no IndexedDB schema change here
// and the `dexie-migration` gate is not triggered. What DOES survive a reload
// is the committed result — carried by the annotation and the op log, in the
// engine, which is the only place that can honestly own it.

interface PerspectiveState {
  /** The live quad in IMAGE pixel coords, or null before there is an image
   *  — and also after a Cancel, which is what takes the box off the canvas. */
  quad: Quad | null;
  /** Which VECTOR OBJECT the quad is warping — a text annotation or a shape —
   *  or null for the destructive pixel path. Set by clicking the object on the
   *  overlay while the tool is active, the same pick Review → Reselect makes,
   *  reachable from the canvas.
   *
   *  A (kind, id) pair rather than a bare id because text and shapes are two
   *  independent id spaces in the engine — see `lib/perspectiveTarget.ts`.
   *
   *  Changing it RESEEDS the quad from the engine, which is what makes an
   *  already-warped object re-selectable rather than only re-appliable. */
  target: PerspectiveTarget | null;
  setTarget: (t: PerspectiveTarget | null) => void;
  /** True once a handle has moved off the starting rectangle. */
  dirty: boolean;
  /** True when the quad is convex and non-degenerate — Apply is gated on it. */
  valid: boolean;
  /** What the commit will transform: "Text", "Square", "Circle" … for the
   *  non-destructive path, null for the destructive pixel one. */
  targetLabel: string | null;

  /**
   * Set by Cancel (and Esc): the tool is active but the user has dismissed the
   * box, so NOTHING is drawn over the canvas until they ask for it back.
   *
   * WHY A FLAG AND NOT JUST `quad = null`. The hook re-seeds the quad whenever
   * its target or frame changes, and that effect runs on the very next render
   * — so clearing the quad alone puts the box straight back, which is exactly
   * the "I can't get rid of it" the flag exists to fix. The seed effect reads
   * this and stays out of the way; `arm()` is the one way back, and it is
   * wired to the panel's button, to picking a new object, and to re-entering
   * the tool.
   */
  dismissed: boolean;
  /** Dismiss the box (Cancel / Esc) — drops the quad AND the target. */
  dismiss: () => void;
  /** Put the box back, from the panel or from re-entering the tool. */
  arm: () => void;

  setQuad: (q: Quad | null) => void;
  /** Published by `usePerspectiveTool` on every change, read by the panel. */
  setStatus: (s: {
    dirty: boolean;
    valid: boolean;
    targetLabel: string | null;
  }) => void;

  /** Registered by `usePerspectiveTool` when it mounts, cleared on unmount.
   *
   *  Null is a real state, not a bug: the tool's hook only lives while the
   *  canvas is mounted, so the panel must render its buttons disabled rather
   *  than calling into nothing. */
  api: {
    apply: () => Promise<boolean>;
    reset: () => void;
    cancel: () => void;
  } | null;
  registerApi: (api: PerspectiveState["api"]) => void;
}

export const usePerspectiveStore = create<PerspectiveState>((set) => ({
  quad: null,
  target: null,
  dirty: false,
  valid: false,
  targetLabel: null,
  dismissed: false,
  api: null,
  setQuad: (q) => set({ quad: q }),
  // Picking an object is also an un-dismiss: the user asking to warp THAT is
  // asking for the box back, and leaving `dismissed` set would swallow the pick.
  setTarget: (t) => set({ target: t, dismissed: false }),
  dismiss: () => set({ quad: null, target: null, dirty: false, dismissed: true }),
  arm: () => set({ dismissed: false }),
  setStatus: (s) =>
    set((prev) =>
      // Guarded so the hook can publish unconditionally on every render
      // without re-rendering the panel on every pointermove of a drag. The
      // quad changes constantly during a gesture; these three flags do not.
      prev.dirty === s.dirty &&
      prev.valid === s.valid &&
      prev.targetLabel === s.targetLabel
        ? prev
        : { ...prev, ...s },
    ),
  registerApi: (api) => set({ api }),
}));
