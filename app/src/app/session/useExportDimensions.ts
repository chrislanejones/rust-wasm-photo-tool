// The size an export will actually produce — computed in an effect, never
// during render.
//
// ⚠️ THE OLD FIRST LINE HERE SAID "shown on the Share button". IT IS NOT SHOWN.
// Corrected 2026-08-09 after tracing every consumer: `exportDims` has exactly
// one, `<ShareButton canvasW= canvasH=>` (AppShell:2907), and ShareButton does
// not render them — it passes them to `createShare`, which writes them into the
// Convex `shares` table (schema.ts:192). So these two numbers are PERSISTED
// SHARE METADATA on a public link, not a caption.
//
// That raises the stakes rather than lowering them. A caption that is briefly
// wrong self-corrects on the next render; a wrong width stored against a share
// is wrong for the life of the link, and nothing downstream can tell. It is
// also why the two reads have to be atomic — see below.
//
// WHAT THIS FIXES. `AppShell` used to inline these two calls as JSX prop
// values on `<ShareButton>`:
//
//   canvasW={exportCanvasBackground
//     ? stamp.state.width
//     : (stamp.toolRef.current?.export_width_excluding_background() ?? …)}
//
// A JSX prop expression is evaluated every time the element is created, i.e.
// on every AppShell render. And these two are not cheap reads: each one calls
// `composite_excluding_background()`, which composites every layer into a
// full-document RGBA buffer and then runs `tight_bbox` over it — **a
// whole-image composite to return a single integer**, twice per render.
//
// The `exportCanvasBackground` default ("Include canvas") takes the other
// branch, which is why nobody saw it. With the preference on "Photo only" the
// guard opens and it is measurable: two zoom clicks with the export dialog
// CLOSED cost 24 composites / 525.7 ms of engine time on a 2.9 MP photo
// (dev build, prototype-patched call counter), and 2 long tasks / 105 ms of
// main-thread blocking on the production build. Zero on the default.
//
// WHY NOT `syncState`. That was the obvious home — it already publishes
// `width`/`height` right beside these, and both call sites already fall back
// to `stamp.state.width`. But `syncState` runs after EVERY mutation, so
// hanging two full composites off it would be far worse than the bug: every
// brush dab would pay for a number only the export dialog reads.
//
// So: an effect keyed on the document version. The composites run at most once
// per (open dialog × document change) instead of twice per render, and an
// effect can `await`, which makes these two ordinary ADR-024 Stage 3.5
// conversions instead of the un-awaitable render reads they were.
import { useEffect, useState } from "react";
import type { useCloneStamp } from "@/hooks/useCloneStamp";

interface Options {
  stamp: ReturnType<typeof useCloneStamp>;
  /** Only compute while the export surface is actually open. */
  active: boolean;
  /** `true` when the user picked "Photo only" — i.e. the padded backing canvas
   *  is cropped away and the exported size is NOT the document size. */
  excludeBackground: boolean;
}

/**
 * The width/height the export will actually produce.
 *
 * Falls back to the document size whenever the real answer is not computed
 * yet (dialog closed, engine not ready, first frame after opening) — the same
 * fallback the inline version used, so a share is never created with a blank
 * size. See the header: these numbers are stored, not displayed.
 */
export function useExportDimensions({ stamp, active, excludeBackground }: Options) {
  const [cropped, setCropped] = useState<{ w: number; h: number } | null>(null);

  const { width, height, undoCount, redoCount, layers } = stamp.state;

  useEffect(() => {
    // Nothing to compute: the default preference exports the whole document,
    // which `stamp.state` already carries for free.
    if (!active || !excludeBackground) {
      setCropped(null);
      return;
    }
    const t = stamp.toolRef.current;
    if (!t || width === 0 || height === 0) {
      setCropped(null);
      return;
    }
    // ONE composite, not two. Each of `export_width_excluding_background` and
    // `export_height_excluding_background` runs a full
    // `composite_excluding_background()` internally and keeps one integer, so
    // the pair did two whole-document composites, two bounding-box scans and
    // two crops to produce two integers. `export_dims_excluding_background`
    // does the composite once and skips the crop entirely — the crop builds the
    // pixel buffer, and nothing here wants the pixels.
    //
    // Measured on a 1385x2068 document, production build:
    //   two getters                          39.9 ms
    //   export_dims_excluding_background     17.4 ms   (2.29x)
    //
    // NOT `capture_composite_excluding_background()`, which also returns these
    // two numbers: its `rgba` field is `getter_with_clone`, so reading the
    // struct copies ~11 MB out of wasm memory to be discarded here. Measured,
    // rather than assumed: that route costs 27.2 ms against this call's 17.4 ms,
    // so it is faster than the old pair and still slower than asking for what
    // is actually wanted.
    //
    // Atomic capture, in miniature: the crop is CONTENT-dependent, so read
    // separately behind the worker the width could describe one document state
    // and the height another. These are not a caption — they are written to the
    // Convex `shares` table (see the header), so a torn pair is persisted
    // against a public link and no later render corrects it.
    //
    // ADR-024 Stage 3.5. An effect callback cannot be `async` — React would
    // read the returned Promise as the cleanup function — so this is an async
    // IIFE with an explicit cancellation flag rather than a bare `await`.
    //
    // THE FLAG IS LOAD-BEARING, not boilerplate. The deps below fire on every
    // edit that can move the tight bounding box, so behind the worker a second
    // effect can start while the first composite is still running, and the two
    // can finish in either order. Without the guard a stale pair wins whenever
    // the older composite lands last, and per the note above these numbers are
    // written to the Convex `shares` table — a wrong size is persisted against
    // a public link and no later render corrects it. Same reasoning that made
    // the pair one call; this keeps it true across time as well as within a
    // single read.
    let cancelled = false;
    void (async () => {
      const dims = await t.export_dims_excluding_background();
      // `free()` on BOTH paths — a cancelled effect still owns the boxed
      // allocation, and dropping it on the floor leaks wasm memory, which never
      // shrinks (ADR-024 a11).
      if (cancelled) {
        dims.free();
        return;
      }
      setCropped({ w: dims.width, h: dims.height });
      dims.free();
    })();
    return () => {
      cancelled = true;
    };
    // `undoCount`/`redoCount`/`layers.length` stand in for "the document
    // changed" — there is no version counter on the engine, and these move on
    // every edit that could change the tight bounding box. Deliberately NOT
    // depending on `stamp` itself: its identity changes on every render, which
    // would put the composites right back in the hot path.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, excludeBackground, width, height, undoCount, redoCount, layers.length]);

  return {
    width: excludeBackground ? (cropped?.w ?? width) : width,
    height: excludeBackground ? (cropped?.h ?? height) : height,
  };
}
