// The export dimensions shown on the Share button — computed in an effect,
// never during render.
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
 * fallback the inline version used, so the button never renders a blank size.
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
    setCropped({
      w: t.export_width_excluding_background(),
      h: t.export_height_excluding_background(),
    });
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
