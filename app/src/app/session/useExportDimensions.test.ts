// @vitest-environment jsdom
// ===== FILE: app/src/app/session/useExportDimensions.test.ts =====
// #67 — the cancellation flag in `useExportDimensions` is load-bearing, and
// this pins it.
//
// The hook's effect deps fire on every edit that can move the tight bounding
// box, so behind the engine worker a second composite can start while the
// first is still running and the two can finish in EITHER ORDER. Without the
// `cancelled` guard the stale pair wins whenever the older composite lands
// last — and these numbers are not a caption. They are written into the Convex
// `shares` table against a public link (see the hook's header), so a torn or
// stale size is persisted and no later render corrects it.
//
// The test therefore does the one thing that distinguishes a real guard from a
// decorative one: it resolves the composites OUT OF ORDER and asserts the
// first-started, last-landing result loses.
//
// Mounted through a real react-dom root with `act`, matching
// `useKeyboardShortcuts.test.ts` — this repo has no @testing-library, and this
// file deliberately does not add one.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { useExportDimensions } from "./useExportDimensions";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** A composite the test can settle by hand, so ordering is explicit rather
 *  than a race the test hopes to win. */
function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

interface Dims {
  width: number;
  height: number;
  free: () => void;
}

function makeDims(w: number, h: number, onFree: () => void): Dims {
  return { width: w, height: h, free: onFree };
}

/** Minimal stand-in for the slice of `useCloneStamp` the hook reads. */
function makeStamp(pending: Array<Promise<Dims>>) {
  let call = 0;
  return {
    state: {
      width: 1000,
      height: 800,
      undoCount: 0,
      redoCount: 0,
      layers: [{ id: 1 }],
    },
    toolRef: {
      current: {
        export_dims_excluding_background: () => pending[call++],
      },
    },
  } as unknown as Parameters<typeof useExportDimensions>[0]["stamp"];
}

describe("useExportDimensions — cancellation flag (#67)", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
  });

  it("a stale composite that lands LAST does not overwrite the newer one", async () => {
    const first = deferred<Dims>();
    const second = deferred<Dims>();
    const freed: number[] = [];
    const stamp = makeStamp([first.promise, second.promise]);

    let seen: { width: number; height: number } | null = null;
    function Probe({ undoCount }: { undoCount: number }) {
      // Mutating the shared state object is what the real hook sees: its deps
      // read `stamp.state.undoCount`, and an edit bumps it.
      (stamp as unknown as { state: { undoCount: number } }).state.undoCount = undoCount;
      seen = useExportDimensions({ stamp, active: true, excludeBackground: true });
      return null;
    }

    // First effect starts — its composite is now in flight.
    await act(async () => {
      root.render(React.createElement(Probe, { undoCount: 0 }));
    });

    // An edit lands. Deps change, the effect re-runs, a SECOND composite
    // starts, and the first effect's cleanup sets its `cancelled` flag.
    await act(async () => {
      root.render(React.createElement(Probe, { undoCount: 1 }));
    });

    // The NEWER composite finishes first...
    await act(async () => {
      second.resolve(makeDims(640, 480, () => freed.push(480)));
      await second.promise;
    });
    expect(seen).toEqual({ width: 640, height: 480 });

    // ...and the STALE one lands afterwards. This is the whole test: without
    // the flag, 1920x1080 wins here and is what gets persisted.
    await act(async () => {
      first.resolve(makeDims(1920, 1080, () => freed.push(1080)));
      await first.promise;
    });

    expect(seen, "the stale composite must not overwrite the newer result").toEqual({
      width: 640,
      height: 480,
    });

    // And the cancelled path must still free its boxed allocation — wasm
    // memory never shrinks, so dropping it on the floor leaks (ADR-024 a11).
    expect(freed, "both dims objects freed, cancelled path included").toContain(1080);
  });

  it("falls back to the document size until a composite lands", async () => {
    const pending = deferred<Dims>();
    const stamp = makeStamp([pending.promise]);
    let seen: { width: number; height: number } | null = null;
    function Probe() {
      seen = useExportDimensions({ stamp, active: true, excludeBackground: true });
      return null;
    }
    await act(async () => {
      root.render(React.createElement(Probe));
    });
    // Never blank, never zero — a share is never created with a missing size.
    expect(seen).toEqual({ width: 1000, height: 800 });
  });
});
