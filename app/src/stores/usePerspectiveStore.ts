import { create } from "zustand";
import type { Quad } from "@/lib/perspective";

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
  /** The live quad in IMAGE pixel coords, or null before there is an image. */
  quad: Quad | null;
  /** Which text annotation the quad is warping, or null for the destructive
   *  pixel path. Set by clicking an annotation on the overlay while the tool is
   *  active — the same pick Review → Reselect makes, reachable from the canvas.
   *
   *  Changing it RESEEDS the quad from the engine, which is what makes an
   *  already-warped item re-selectable rather than only re-appliable. */
  targetId: number | null;
  setTargetId: (id: number | null) => void;
  /** True once a handle has moved off the starting rectangle. */
  dirty: boolean;
  /** True when the quad is convex and non-degenerate — Apply is gated on it. */
  valid: boolean;
  /** What the commit will transform: "Text" for the non-destructive path, null
   *  for the destructive pixel one. */
  targetLabel: string | null;

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
  } | null;
  registerApi: (api: PerspectiveState["api"]) => void;
}

export const usePerspectiveStore = create<PerspectiveState>((set) => ({
  quad: null,
  targetId: null,
  dirty: false,
  valid: false,
  targetLabel: null,
  api: null,
  setQuad: (q) => set({ quad: q }),
  setTargetId: (id) => set({ targetId: id }),
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
