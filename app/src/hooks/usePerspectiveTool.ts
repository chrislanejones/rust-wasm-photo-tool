import { useCallback, useEffect, useRef } from "react";
import type { ImageHorseTool } from "stamp_tool";
import { usePerspectiveStore } from "@/stores/usePerspectiveStore";
import {
  IDENTITY_QUAD,
  denormalise,
  fromFlat,
  isIdentity,
  isValidQuad,
  normalise,
  toFlat,
  type Quad,
} from "@/lib/perspective";
import type { PerspectiveTargetBox } from "@/lib/perspectiveTarget";

/**
 * The Perspective tool's state and its commit paths (v8.42, vector-wide v8.76).
 *
 * ONE QUAD, TWO KINDS OF TARGET. Which one is live is decided by whether a
 * vector object is selected, and the difference is not cosmetic:
 *
 *   • A selected OBJECT — a text annotation, a square, a circle, any shape the
 *     app draws — warps NON-DESTRUCTIVELY. The engine stores the corners on
 *     the annotation itself, normalised across its own box, and renders
 *     through them. Edit the words or restyle the square afterwards and it
 *     re-renders and re-warps together — this is what "works with vector
 *     objects, just like Photoshop" actually requires, and it is why the
 *     corners are normalised rather than baked into a raster.
 *
 *   • With nothing selected the quad warps PIXELS, which is destructive: the
 *     region is lifted, resampled and put back, as one op in the log.
 *
 * The shape half is v8.76. Before it, "Perspective, Skew and Distort only work
 * with raster" was simply true of everything except text: a square you had
 * just drawn stayed exactly as drawn while the photo under it was resampled.
 *
 * RESELECT. Picking an object out of Review → Reselect, or clicking it on the
 * overlay, loads that annotation's existing quad back into the overlay, so a
 * perspective can be adjusted rather than only re-applied from scratch. The
 * engine is the source of truth for it (`text_perspective_of` /
 * `shape_perspective_of`); this hook never keeps a private copy that could
 * drift from what was committed.
 *
 * WHY EVERY ENGINE CALL IS AWAITED. Since ADR-024 the engine lives in a worker
 * and the main thread holds an async proxy. A non-awaited call returns a
 * Promise into a `void` slot, which `tsc` cannot catch — the trap documented
 * on the a10 arc. Each call below is awaited and feature-detected the same way
 * `useTextTool` does it.
 */
interface Opts {
  toolRef: React.RefObject<ImageHorseTool | null>;
  /** Full re-sync (history labels, layer list) — once per commit, not per frame. */
  syncState: () => void;
  /** Plain composite blit — cheap, safe to call after a warp lands. */
  flushToCanvas: () => void;
  /** The selected vector object with its basis rect, or null for the pixel
   *  path. The basis is where the quad starts and what it is normalised
   *  against — see `lib/perspectiveTarget.ts` for the shape rule, which the
   *  engine mirrors. */
  target: PerspectiveTargetBox | null;
  /** Canvas dimensions in image px — the default quad is a slice of the canvas
   *  when nothing is selected. */
  imgW: number;
  imgH: number;
  /** The active layer's id. Not used for geometry: a layer switch DROPS the
   *  target, because the object it named is not on the canvas the user is now
   *  looking at, and warping it from there would be an edit to a layer they
   *  cannot see. */
  activeLayerId: number;
}

/** The starting rectangle, as a quad. Every gesture begins here. */
function rectQuad(x: number, y: number, w: number, h: number): Quad {
  return [
    { x, y },
    { x: x + w, y },
    { x: x + w, y: y + h },
    { x, y: y + h },
  ];
}

export function usePerspectiveTool({
  toolRef,
  syncState,
  flushToCanvas,
  target,
  imgW,
  imgH,
  activeLayerId,
}: Opts) {
  // The live quad lives in the store, not local state — the overlay and the
  // panel both read it and they are in different subtrees (see the note on
  // usePerspectiveStore).
  const quad = usePerspectiveStore((s) => s.quad);
  const setQuad = usePerspectiveStore((s) => s.setQuad);
  const setStatus = usePerspectiveStore((s) => s.setStatus);
  const registerApi = usePerspectiveStore((s) => s.registerApi);
  const dismissed = usePerspectiveStore((s) => s.dismissed);
  const dismiss = usePerspectiveStore((s) => s.dismiss);
  const arm = usePerspectiveStore((s) => s.arm);
  const setTarget = usePerspectiveStore((s) => s.setTarget);
  // The rectangle the quad started from. Reset returns here, and it is also
  // the box the corners are normalised against for the vector path.
  const baseRef = useRef<{ x: number; y: number; w: number; h: number } | null>(
    null,
  );

  /** The frame the quad should occupy for the current target. */
  const frame = (() => {
    if (target) return { x: target.x, y: target.y, w: target.w, h: target.h };
    if (imgW <= 0 || imgH <= 0) return null;
    // Pixel path with nothing selected: start at the middle half of the canvas
    // rather than the whole thing. A quad pinned to the canvas edges has its
    // corner handles under the window chrome, and dragging one outward
    // immediately asks the engine for a warp larger than the document.
    return {
      x: Math.round(imgW * 0.25),
      y: Math.round(imgH * 0.25),
      w: Math.round(imgW * 0.5),
      h: Math.round(imgH * 0.5),
    };
  })();

  /**
   * ⚠️ THE SEED EFFECT KEYS ON THIS STRING, NOT ON `frame`, AND THAT IS
   * LOAD-BEARING — it is the difference between the tool working and the tool
   * silently discarding every drag.
   *
   * `target` is derived from the annotation PROPS, which CanvasArea receives
   * fresh from AppShell on every render. A new array identity means a new
   * target object, which means a new `frame` object — even when every number
   * in it is unchanged. Key the seed effect on that object and it re-runs
   * constantly, and each run calls `setQuad(rectQuad(...))`, wiping the user's
   * in-progress drag back to a plain rectangle. Apply then commits the
   * IDENTITY and nothing appears to happen.
   *
   * That is exactly what shipped in the first browser run: tsc clean, 591 tests
   * green, engine verified correct through the worker by hand — and the feature
   * still did nothing, because the reset raced the drag. A primitive key makes
   * the effect fire when the target actually changes and not when React merely
   * re-rendered.
   */
  const targetKey = target ? `${target.kind}:${target.id}` : "px";
  const frameKey = frame
    ? `${targetKey}|${frame.x}|${frame.y}|${frame.w}|${frame.h}`
    : "none";
  // Read inside the effect without widening its dependency list.
  const frameRef = useRef(frame);
  frameRef.current = frame;
  const targetRef = useRef(target);
  targetRef.current = target;

  /**
   * Seed the quad whenever the TARGET changes — including on reselect.
   *
   * For a vector object the engine is asked for its stored quad first, so
   * re-selecting an already-warped item picks its corners back up instead of
   * snapping them to a fresh rectangle. Both `*_perspective_of` calls answer
   * with an empty array for an unknown id, which `fromFlat` reports as null —
   * that is deliberately distinguishable from "found it, and it is unwarped".
   */
  useEffect(() => {
    let cancelled = false;
    const frame = frameRef.current;
    const target = targetRef.current;
    // Dismissed: the user pressed Cancel or Esc and wants the canvas clear.
    // Seeding anyway is the bug that makes the box un-cancellable.
    if (!frame || dismissed) {
      setQuad(null);
      baseRef.current = null;
      return;
    }
    baseRef.current = frame;

    const seed = async () => {
      const t = toolRef.current;
      const fresh = rectQuad(frame.x, frame.y, frame.w, frame.h);
      if (!target || !t) {
        if (!cancelled) setQuad(fresh);
        return;
      }
      // ⚠️ TWO SPELLED-OUT CALLS, NOT ONE THROUGH A PICKED-OUT METHOD.
      // `const read = t.text_perspective_of ?? t.shape_perspective_of` then
      // `read.call(t, id)` reads better and is wrong twice over: the Stage-3.5
      // audit matches a call's RECEIVER, so an aliased method is invisible to
      // it and silently absent from the gate (the blind spot documented in
      // engineAsyncMigration.contract.test.ts — it caught exactly this here),
      // and rebinding `this` on a worker proxy's method is not something the
      // proxy contract promises.
      let flat: Float32Array | null = null;
      if (target.kind === "text") {
        if (typeof t.text_perspective_of === "function") {
          flat = await t.text_perspective_of(target.id);
        }
      } else if (typeof t.shape_perspective_of === "function") {
        flat = await t.shape_perspective_of(target.id);
      }
      if (cancelled) return;
      const stored = fromFlat(flat);
      // No stored quad, or a stored identity, both mean "start from the
      // rectangle" — the identity IS the rectangle, expressed normalised.
      if (!stored || isIdentity(stored)) {
        setQuad(fresh);
        return;
      }
      // ⚠️ RECOVER THE UNWARPED RECT FIRST, for TEXT. `frame` is the
      // annotation's LIVE bounds, and once a warp is applied those are the
      // bounding box of the WARPED tile — while the engine stores corners
      // normalised against the UNWARPED one (the warp is the last stage of the
      // tile pipeline, so the quad describes the input to it, not the output).
      //
      // Denormalising straight onto `frame` therefore draws the handles in the
      // wrong place, and — worse — a second Apply would re-normalise against
      // the warped box and COMPOUND the transform, so each visit would shear
      // the text further with no way back.
      //
      // No engine round trip is needed to fix it: the warped bbox IS the
      // bounding box of the stored quad, so the unwarped rect falls straight
      // out of the two. Scale `frame` up by the quad's own normalised extent
      // and shift its origin back by the quad's offset.
      //
      // A SHAPE NEEDS NONE OF THIS, and that is a property of the basis, not
      // luck: `x0,y0,x1,y1` are the shape's own geometry and the warp never
      // writes back to them, so a shape's bbox means the same thing warped or
      // not. Recovering a "pre-warp" rect from it would be undoing a transform
      // that was never applied — the handles would land off the shape.
      const base = target.kind === "shape" ? frame : unwarpedBase(frame, stored);
      // Apply normalises against THIS, so a re-applied quad replaces the stored
      // one rather than stacking on top of it.
      baseRef.current = base;
      const local = denormalise(stored, base.w, base.h);
      setQuad(local.map((p) => ({ x: base.x + p.x, y: base.y + p.y })) as Quad);
    };
    void seed();
    return () => {
      cancelled = true;
    };
    // `frameKey` is the VALUE-identity of `frame`, which is read through a ref
    // inside. Depending on `frame` itself re-runs this on every parent render
    // and wipes the drag — see the ⚠️ above. (No eslint-disable needed: the
    // rule cannot see through the ref, so it has nothing to complain about,
    // and adding a disable comment here would itself be flagged as unused.)
  }, [frameKey, targetKey, dismissed, toolRef, setQuad]);

  /**
   * Drop the target when the ACTIVE LAYER changes.
   *
   * Both annotation lists are per-layer (`get_text_annotations` and
   * `get_shape_annotations` answer for the active layer only), so an id picked
   * on layer 2 names nothing on layer 1 — or, worse, names a DIFFERENT object
   * that happens to share the number. Holding the pick across the switch would
   * leave the box floating over an object that is no longer there and commit
   * into a layer the user cannot see.
   */
  const firstLayerRef = useRef(activeLayerId);
  useEffect(() => {
    if (firstLayerRef.current === activeLayerId) return;
    firstLayerRef.current = activeLayerId;
    setTarget(null);
  }, [activeLayerId, setTarget]);

  /** True once a handle has moved off the starting rectangle. */
  const dirty = (() => {
    const base = baseRef.current;
    if (!quad || !base) return false;
    const start = rectQuad(base.x, base.y, base.w, base.h);
    return quad.some(
      (p, i) =>
        Math.abs(p.x - start[i].x) > 0.5 || Math.abs(p.y - start[i].y) > 0.5,
    );
  })();

  const valid = quad ? isValidQuad(quad) : false;

  const reset = useCallback(() => {
    const base = baseRef.current;
    if (!base) return;
    setQuad(rectQuad(base.x, base.y, base.w, base.h));
  }, [setQuad]);

  /**
   * Commit the quad.
   *
   * Returns true when the engine accepted it. A refusal is not an error path
   * to swallow: the engine rejects degenerate and self-crossing quads, and the
   * caller keeps the overlay live so the user can drag a handle back rather
   * than losing the gesture.
   */
  const apply = useCallback(async (): Promise<boolean> => {
    const t = toolRef.current;
    const base = baseRef.current;
    if (!t || !quad || !base || !isValidQuad(quad)) return false;

    const commit = async (): Promise<boolean> => {
      if (target) {
        // Normalise against the object's own box before storing — the engine
        // keeps fractions, not pixels, which is what lets the warp survive a
        // later edit that changes the object's size.
        const local = quad.map((p) => ({
          x: p.x - base.x,
          y: p.y - base.y,
        })) as Quad;
        const flat = toFlat(normalise(local, base.w, base.h));
        if (target.kind === "text") {
          if (typeof t.set_text_perspective !== "function") return false;
          return await t.set_text_perspective(target.id, flat);
        }
        if (typeof t.set_shape_perspective !== "function") return false;
        return await t.set_shape_perspective(target.id, flat);
      }
      if (typeof t.perspective_warp_region !== "function") return false;
      // The pixel path takes ABSOLUTE canvas coords — there is no tile for the
      // corners to be a fraction of.
      return await t.perspective_warp_region(
        base.x,
        base.y,
        base.w,
        base.h,
        toFlat(quad),
      );
    };
    const ok = await commit();
    if (!ok) return false;
    flushToCanvas();
    // One sync per commit: this is what puts the engine's "Perspective"
    // snapshot label into Review → History. The label comes from the engine
    // (`snap("Perspective")` / `Op::label`), not from here, so the two undo
    // engines cannot disagree about what the step is called.
    syncState();
    return true;
  }, [toolRef, quad, target, flushToCanvas, syncState]);

  /**
   * Esc CANCELS — it takes the box and its grid off the canvas entirely,
   * rather than resetting the corners.
   *
   * It used to reset, and only when the quad was already dirty, which meant a
   * freshly-placed box could not be dismissed at all: Esc did nothing, and the
   * six-handle frame stayed over the picture until the tool was switched away.
   * Reset still exists — it is a button, where an undo-shaped action belongs —
   * and Esc now does the thing every other overlay in the app makes it do.
   */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || !quad) return;
      // Same guard the crop rect's Escape uses: a field has its own idea of
      // what Escape means, and stealing it there would cancel the box while
      // someone was clearing a text input.
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      e.preventDefault();
      dismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [quad, dismiss]);

  /**
   * Re-entering the tool ARMS it.
   *
   * Cancel dismisses this visit's box, not the tool itself — leaving the flag
   * set across a tool switch would mean picking Perspective again and getting
   * a blank canvas with no explanation. The panel's "Place box" is the way
   * back WITHIN a visit; this is the way back across one.
   */
  useEffect(() => {
    arm();
    // Mount only: `arm` is a stable store action, so this runs once per visit.
  }, [arm]);

  const targetLabel = target?.label ?? null;

  // Publish the derived flags for the panel. `setStatus` no-ops when nothing
  // changed, so this is safe to run on every render including mid-drag.
  useEffect(() => {
    setStatus({ dirty, valid, targetLabel });
  }, [setStatus, dirty, valid, targetLabel]);

  // Hand the panel its three actions. Cleared on unmount so the buttons
  // disable themselves rather than calling into a stale closure over a dead
  // engine.
  useEffect(() => {
    registerApi({ apply, reset, cancel: dismiss });
    return () => registerApi(null);
  }, [registerApi, apply, reset, dismiss]);

  return {
    quad,
    setQuad,
    dirty,
    valid,
    reset,
    apply,
    cancel: dismiss,
    targetLabel,
    /** The identity, exported so callers can express "no warp" without
     *  importing the geometry module themselves. */
    IDENTITY_QUAD,
  };
}

/**
 * The UNWARPED rect a stored text quad was normalised against, recovered from
 * the annotation's current (warped) bounds and the quad itself.
 *
 * `frame` is the bounding box of the warped tile, and the quad's own normalised
 * extent is the ratio between the two — so the original rect falls straight out
 * without asking the engine anything. Extracted from the seed effect because it
 * is pure arithmetic and the effect around it is not.
 */
function unwarpedBase(
  frame: { x: number; y: number; w: number; h: number },
  stored: Quad,
): { x: number; y: number; w: number; h: number } {
  const xs = stored.map((p) => p.x);
  const ys = stored.map((p) => p.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const spanX = Math.max(...xs) - minX || 1;
  const spanY = Math.max(...ys) - minY || 1;
  const baseW = frame.w / spanX;
  const baseH = frame.h / spanY;
  return {
    x: frame.x - minX * baseW,
    y: frame.y - minY * baseH,
    w: baseW,
    h: baseH,
  };
}
