// ===== FILE: app/src/hooks/useEngineCore.test.ts =====
// Covers `readUiSnapshot`'s liveness guard — ADR-024 Stage 3.5, a13.
//
// a13 made `syncState` async, which is what Stage 4 needs and what the other
// ~89 converted sites already did. The difference here is that `syncState` runs
// after essentially every mutation (74 call sites) and its whole job is to
// overwrite React's mirror of the document. Once the capture is awaited there
// is a window between issuing it and applying it, and `reset()` — the photo
// switch — lands in that window.
//
// What makes the window dangerous rather than merely theoretical: `reset()`
// nulls `toolRef.current` but NOTHING in this codebase calls `tool.free()`. The
// outgoing engine is still a live wasm object, so its capture resolves normally
// with the OLD photo's width, history and layer list, and lands on top of the
// `INITIAL_STATE` reset just wrote. No throw, no console, self-corrects on the
// next edit. The guard is the only thing standing between that and a
// months-long intermittent, so it gets tested rather than trusted.
//
// The load-bearing case is `checks liveness AFTER the await, not before` —
// every other test here passes with the guard moved above the await.
import { describe, it, expect, vi } from "vitest";
import { readUiSnapshot } from "./useEngineCore";
import type { UiStateCapture } from "stamp_tool";

/** A capture shaped like the engine's, with a spy on `free`. */
function capture(over: Partial<UiStateCapture> = {}) {
  const free = vi.fn();
  const ui = {
    free,
    has_source: true,
    undo_count: 3,
    redo_count: 1,
    history_labels: "stroke:Brush|crop:Crop",
    zoom: 1,
    width: 1395,
    height: 2078,
    layers_json: '[{"id":1,"name":"Background"}]',
    active_layer_id: 1,
    export_quality: 75,
    ...over,
  } as unknown as UiStateCapture;
  return { ui, free };
}

/** An engine whose capture resolves on a later microtask, like the worker. */
function asyncEngine(ui: UiStateCapture) {
  return { capture_ui_state: () => Promise.resolve(ui) };
}

describe("readUiSnapshot", () => {
  it("copies all ten fields out when the document is still live", async () => {
    const { ui } = capture();
    const snap = await readUiSnapshot(asyncEngine(ui), () => true);

    expect(snap).toEqual({
      has_source: true,
      undo_count: 3,
      redo_count: 1,
      history_labels: "stroke:Brush|crop:Crop",
      zoom: 1,
      width: 1395,
      height: 2078,
      layers_json: '[{"id":1,"name":"Background"}]',
      active_layer_id: 1,
      export_quality: 75,
    });
  });

  it("returns null when the document was replaced mid-flight", async () => {
    const { ui } = capture();
    const snap = await readUiSnapshot(asyncEngine(ui), () => false);

    // Not an empty object, not a partial — null, so the caller's `if (!snap)`
    // short-circuits before `setState`. An empty object here would sail through
    // a truthiness check and blank the mirror instead of leaving it alone,
    // which is the `Array.from(Promise)` shape this repo has been bitten by.
    expect(snap).toBeNull();
  });

  it("checks liveness AFTER the await, not before", async () => {
    // THE TEST THAT MATTERS. Every other case here passes with the guard hoisted
    // above `await t.capture_ui_state()`, because they decide liveness once and
    // never change it. This one flips exactly like a real photo switch: live at
    // the moment the capture is issued, replaced by the time it resolves.
    //
    // Guard after the await  -> null (correct: the snapshot describes a photo
    //                           the user has already navigated away from).
    // Guard before the await -> the stale snapshot, applied over INITIAL_STATE.
    let live = true;
    const { ui } = capture({ width: 640, height: 480 } as Partial<UiStateCapture>);
    const engine = {
      capture_ui_state: () =>
        Promise.resolve(ui).then((c) => {
          live = false; // reset() runs while the capture is in flight
          return c;
        }),
    };

    const snap = await readUiSnapshot(engine, () => live);

    expect(snap, "a capture that outlived its document must be discarded").toBeNull();
  });

  it("frees the capture on the live path", async () => {
    const { ui, free } = capture();
    await readUiSnapshot(asyncEngine(ui), () => true);
    expect(free).toHaveBeenCalledTimes(1);
  });

  it("frees the capture on the stale path too", async () => {
    // The path a13 added. It runs exactly when the app is busy switching photos,
    // so a leak here would be per-photo-switch and invisible — wasm memory never
    // shrinks (a11), so it would only ever show up as a tab that grows.
    const { ui, free } = capture();
    await readUiSnapshot(asyncEngine(ui), () => false);
    expect(free).toHaveBeenCalledTimes(1);
  });

  it("frees the capture even if reading a field throws", async () => {
    // `finally`, not two call sites. A detached wasm object throws on property
    // access, and the version of this that frees at each `return` leaks here.
    const free = vi.fn();
    const ui = {
      free,
      get has_source(): boolean {
        throw new Error("null pointer passed to rust");
      },
    } as unknown as UiStateCapture;

    await expect(readUiSnapshot(asyncEngine(ui), () => true)).rejects.toThrow(
      "null pointer passed to rust",
    );
    expect(free).toHaveBeenCalledTimes(1);
  });

  it("still works when the engine is synchronous (the port today)", async () => {
    // `attachLivePort` is an identity function until Stage 3, so `capture_ui_state`
    // returns the capture directly rather than a promise. `await` on a non-thenable
    // is legal and defers by one microtask — the guard must behave the same.
    const { ui, free } = capture();
    const snap = await readUiSnapshot({ capture_ui_state: () => ui }, () => true);

    expect(snap?.width).toBe(1395);
    expect(free).toHaveBeenCalledTimes(1);
  });
});
