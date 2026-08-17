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

/**
 * The Perspective tool's state and its two commit paths (v8.42).
 *
 * ONE QUAD, TWO TARGETS. Which one is live is decided by whether a text
 * annotation is selected, and the difference is not cosmetic:
 *
 *   • A selected annotation warps NON-DESTRUCTIVELY. The engine stores the
 *     corners on the annotation itself, normalised across its tile, and
 *     re-renders through them. Edit the words afterwards and the text re-wraps
 *     and re-warps together — this is what "works with vector items like text,
 *     just like Photoshop" actually requires, and it is why the corners are
 *     normalised rather than baked into a raster.
 *
 *   • With nothing selected the quad warps PIXELS, which is destructive: the
 *     region is lifted, resampled and put back, as one op in the log.
 *
 * RESELECT. Picking a text object out of Review → Reselect while this tool is
 * active loads that annotation's existing quad back into the overlay, so a
 * perspective can be adjusted rather than only re-applied from scratch. The
 * engine is the source of truth for it (`text_perspective_of`); this hook
 * never keeps a private copy that could drift from what was committed.
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
  /** Currently selected text annotation, or null for the pixel path. */
  selectedTextId: number | null;
  /** Canvas dimensions in image px — the default quad is the whole canvas when
   *  nothing is selected. */
  imgW: number;
  imgH: number;
  /** Bounds of the selected annotation in image px, when there is one. The
   *  quad starts as this rectangle so the first drag has something aligned to
   *  pull on. */
  targetBounds: { x: number; y: number; w: number; h: number } | null;
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
  selectedTextId,
  imgW,
  imgH,
  targetBounds,
}: Opts) {
  // The live quad lives in the store, not local state — the overlay and the
  // panel both read it and they are in different subtrees (see the note on
  // usePerspectiveStore).
  const quad = usePerspectiveStore((s) => s.quad);
  const setQuad = usePerspectiveStore((s) => s.setQuad);
  const setStatus = usePerspectiveStore((s) => s.setStatus);
  const registerApi = usePerspectiveStore((s) => s.registerApi);
  // The rectangle the quad started from. Reset returns here, and it is also
  // the box the corners are normalised against for the vector path.
  const baseRef = useRef<{ x: number; y: number; w: number; h: number } | null>(
    null,
  );

  /** The frame the quad should occupy for the current target. */
  const frame = (() => {
    if (targetBounds && selectedTextId !== null) return targetBounds;
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
   * `targetBounds` is derived from the `annotations` PROP, which CanvasArea
   * receives fresh from AppShell on every render. A new array identity means a
   * new `targetBounds` object, which means a new `frame` object — even when
   * every number in it is unchanged. Key the seed effect on that object and it
   * re-runs constantly, and each run calls `setQuad(rectQuad(...))`, wiping the
   * user's in-progress drag back to a plain rectangle. Apply then commits the
   * IDENTITY and nothing appears to happen.
   *
   * That is exactly what shipped in the first browser run: tsc clean, 591 tests
   * green, engine verified correct through the worker by hand — and the feature
   * still did nothing, because the reset raced the drag. A primitive key makes
   * the effect fire when the target actually changes and not when React merely
   * re-rendered.
   */
  const frameKey = frame
    ? `${selectedTextId ?? "px"}|${frame.x}|${frame.y}|${frame.w}|${frame.h}`
    : "none";
  // Read inside the effect without widening its dependency list.
  const frameRef = useRef(frame);
  frameRef.current = frame;

  /**
   * Seed the quad whenever the TARGET changes — including on reselect.
   *
   * For a text annotation the engine is asked for its stored quad first, so
   * re-selecting an already-warped item picks its corners back up instead of
   * snapping them to a fresh rectangle. `text_perspective_of` answers with an
   * empty array for an unknown id, which `fromFlat` reports as null — that is
   * deliberately distinguishable from "found it, and it is unwarped".
   */
  useEffect(() => {
    let cancelled = false;
    const frame = frameRef.current;
    if (!frame) {
      setQuad(null);
      baseRef.current = null;
      return;
    }
    baseRef.current = frame;

    const seed = async () => {
      const t = toolRef.current;
      const fresh = rectQuad(frame.x, frame.y, frame.w, frame.h);
      if (
        selectedTextId === null ||
        !t ||
        typeof t.text_perspective_of !== "function"
      ) {
        if (!cancelled) setQuad(fresh);
        return;
      }
      const flat = await t.text_perspective_of(selectedTextId);
      if (cancelled) return;
      const stored = fromFlat(flat);
      // No stored quad, or a stored identity, both mean "start from the
      // rectangle" — the identity IS the rectangle, expressed normalised.
      if (!stored || isIdentity(stored)) {
        setQuad(fresh);
        return;
      }
      // ⚠️ RECOVER THE UNWARPED RECT FIRST. `frame` is the annotation's LIVE
      // bounds, and once a warp is applied those are the bounding box of the
      // WARPED tile — while the engine stores corners normalised against the
      // UNWARPED one (the warp is the last stage of the tile pipeline, so the
      // quad describes the input to it, not the output).
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
      const xs = stored.map((p) => p.x);
      const ys = stored.map((p) => p.y);
      const minX = Math.min(...xs);
      const minY = Math.min(...ys);
      const spanX = Math.max(...xs) - minX || 1;
      const spanY = Math.max(...ys) - minY || 1;
      const baseW = frame.w / spanX;
      const baseH = frame.h / spanY;
      const base = {
        x: frame.x - minX * baseW,
        y: frame.y - minY * baseH,
        w: baseW,
        h: baseH,
      };
      // Apply normalises against THIS, so a re-applied quad replaces the stored
      // one rather than stacking on top of it.
      baseRef.current = base;
      const local = denormalise(stored, base.w, base.h);
      setQuad(
        local.map((p) => ({ x: base.x + p.x, y: base.y + p.y })) as Quad,
      );
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
  }, [frameKey, selectedTextId, toolRef, setQuad]);

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
      if (selectedTextId !== null) {
        if (typeof t.set_text_perspective !== "function") return false;
        // Normalise against the annotation's own box before storing — the
        // engine keeps fractions, not pixels, which is what lets the warp
        // survive a later edit that changes the tile's size.
        const local = quad.map((p) => ({
          x: p.x - base.x,
          y: p.y - base.y,
        })) as Quad;
        return await t.set_text_perspective(
          selectedTextId,
          toFlat(normalise(local, base.w, base.h)),
        );
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
  }, [toolRef, quad, selectedTextId, flushToCanvas, syncState]);

  /** Esc resets the quad — the panel documents this in its lightbulb. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && dirty) {
        e.preventDefault();
        reset();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dirty, reset]);

  const targetLabel = selectedTextId !== null ? "Text" : null;

  // Publish the derived flags for the panel. `setStatus` no-ops when nothing
  // changed, so this is safe to run on every render including mid-drag.
  useEffect(() => {
    setStatus({ dirty, valid, targetLabel });
  }, [setStatus, dirty, valid, targetLabel]);

  // Hand the panel its two actions. Cleared on unmount so the buttons disable
  // themselves rather than calling into a stale closure over a dead engine.
  useEffect(() => {
    registerApi({ apply, reset });
    return () => registerApi(null);
  }, [registerApi, apply, reset]);

  return {
    quad,
    setQuad,
    dirty,
    valid,
    reset,
    apply,
    targetLabel,
    /** The identity, exported so callers can express "no warp" without
     *  importing the geometry module themselves. */
    IDENTITY_QUAD,
  };
}
