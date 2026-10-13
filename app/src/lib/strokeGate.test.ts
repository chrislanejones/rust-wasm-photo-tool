// The stroke gate — autosave must not contend with a live stroke (v8.33).
//
// The property under test is SCHEDULING, so the tests are about time: the
// gate must hold autosave while ink flows, release it the moment the pointer
// comes up, and never hold it forever — the failure costs are asymmetric
// (starved autosave is user data with no backup; a late capture is a hiccup).
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  strokeDown,
  strokeUp,
  strokeActive,
  whenStrokeIdle,
  whenStrokeQuiet,
  resetStrokeGate,
} from "./strokeGate";

beforeEach(() => resetStrokeGate());
afterEach(() => vi.useRealTimers());

describe("the gate itself", () => {
  it("opens on down, closes on up", () => {
    expect(strokeActive()).toBe(false);
    strokeDown();
    expect(strokeActive()).toBe(true);
    strokeUp();
    expect(strokeActive()).toBe(false);
  });

  it("tolerates stray ups — every button click on the page fires one", () => {
    // The close half listens on WINDOW pointerup, so ups without a matching
    // down are the common case, not an error. A negative depth would wedge
    // the gate: the NEXT real down would net to zero and autosave would fire
    // mid-stroke — the exact bug this module fixes, reintroduced by its own
    // bookkeeping.
    strokeUp();
    strokeUp();
    strokeDown();
    expect(strokeActive(), "a stray up must not pre-cancel a real stroke").toBe(true);
    strokeUp();
    expect(strokeActive()).toBe(false);
  });
});

describe("whenStrokeIdle", () => {
  it("resolves immediately when no stroke is in flight", async () => {
    let resolved = false;
    await whenStrokeIdle().then(() => (resolved = true));
    expect(resolved).toBe(true);
  });

  it("actually WAITS while a stroke is active — the non-vacuous half", async () => {
    // A gate that resolves early is indistinguishable from no gate at all in
    // every green run; this pins the waiting itself.
    strokeDown();
    let resolved = false;
    const p = whenStrokeIdle().then(() => (resolved = true));
    await Promise.resolve();
    await Promise.resolve();
    expect(resolved, "resolved while the pointer was still down").toBe(false);
    strokeUp();
    await p;
    expect(resolved).toBe(true);
  });

  it("releases every waiter on the up, not just the first", async () => {
    strokeDown();
    const flags = [false, false, false];
    const ps = flags.map((_, i) => whenStrokeIdle().then(() => (flags[i] = true)));
    strokeUp();
    await Promise.all(ps);
    expect(flags).toEqual([true, true, true]);
  });

  it("never waits forever — the maxWait bound", async () => {
    vi.useFakeTimers();
    strokeDown(); // and the up never comes
    let resolved = false;
    const p = whenStrokeIdle(1000).then(() => (resolved = true));
    await vi.advanceTimersByTimeAsync(999);
    expect(resolved).toBe(false);
    await vi.advanceTimersByTimeAsync(2);
    await p;
    expect(resolved, "a stuck stroke must delay a save, never starve it").toBe(true);
  });

  it("failsafe: a stroke held past 15s is presumed abandoned", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-13T12:00:00Z"));
    strokeDown(); // missed pointerup
    vi.setSystemTime(new Date("2026-08-13T12:00:16Z"));
    expect(strokeActive(), "a dead stroke must not hold the gate").toBe(false);
  });
});

// ── The wiring, pinned ──────────────────────────────────────────────────────
//
// The module being right is worth nothing if nobody calls it. Three greps,
// same style as `captureMarshal`'s wiring guard: the canvas opens the gate,
// the window closes it, and the autosave debounce awaits it.
describe("the gate is actually wired", () => {
  it("CanvasArea opens on the canvas and closes on window pointerup; autosave waits", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const { fileURLToPath } = await import("node:url");
    const APP = fileURLToPath(new URL("../../", import.meta.url));
    const canvasArea = readFileSync(join(APP, "src/features/canvas/CanvasArea.tsx"), "utf8");
    expect(canvasArea).toMatch(/strokeDown\(\)/);
    expect(canvasArea).toMatch(/addEventListener\("pointerup", strokeUp\)/);
    const session = readFileSync(join(APP, "src/app/session/useImageSession.ts"), "utf8");
    expect(session).toMatch(/whenStrokeQuiet\(AUTOSAVE_QUIET_MS\)\.then\(\(\) => flushRef\.current\(\)\)/);
  });
});

// whenStrokeQuiet (10-07): "idle right now" was not enough. The autosave fired
// `delay` after a stroke ended — where the next stroke begins — and its
// `capture_state()` held the worker for over a second while that stroke's
// `paint_move` calls queued behind it. Quiet = no stroke has ENDED for
// `quietMs`, so a burst of strokes defers the save until the burst is over.
describe("whenStrokeQuiet", () => {
  it("resolves at once when no stroke has ever happened", async () => {
    vi.useFakeTimers();
    let done = false;
    void whenStrokeQuiet(2500).then(() => (done = true));
    await vi.advanceTimersByTimeAsync(0);
    expect(done).toBe(true);
  });

  it("waits out the quiet window after the last stroke end", async () => {
    vi.useFakeTimers();
    strokeDown();
    strokeUp();
    let done = false;
    void whenStrokeQuiet(2500).then(() => (done = true));
    await vi.advanceTimersByTimeAsync(2400);
    expect(done, "2.4 s of quiet is not 2.5 s").toBe(false);
    await vi.advanceTimersByTimeAsync(200);
    expect(done).toBe(true);
  });

  it("a stroke inside the window pushes the save out — a burst defers it", async () => {
    vi.useFakeTimers();
    strokeDown();
    strokeUp();
    let done = false;
    void whenStrokeQuiet(2500).then(() => (done = true));
    await vi.advanceTimersByTimeAsync(2000);
    strokeDown(); // the next stroke begins 2 s later, inside the window
    await vi.advanceTimersByTimeAsync(1000);
    expect(done, "must hold while the new stroke is live").toBe(false);
    strokeUp(); // ends at t=3.0 s → quiet until t=5.5 s
    await vi.advanceTimersByTimeAsync(2400);
    expect(done, "the window restarts from the NEW stroke's end").toBe(false);
    await vi.advanceTimersByTimeAsync(200);
    expect(done).toBe(true);
  });

  it("a button click (stray up) does not restart the window", async () => {
    vi.useFakeTimers();
    strokeDown();
    strokeUp();
    await vi.advanceTimersByTimeAsync(2000);
    strokeUp(); // window pointerup for a button, no stroke open
    let done = false;
    void whenStrokeQuiet(2500).then(() => (done = true));
    await vi.advanceTimersByTimeAsync(600);
    expect(done, "only a real stroke end moves the clock").toBe(true);
  });

  it("never waits past maxWaitMs — autosave is user data with no backup", async () => {
    vi.useFakeTimers();
    let done = false;
    void whenStrokeQuiet(2500, 5000).then(() => (done = true));
    // Strokes end every second, forever: the window never clears on its own.
    for (let i = 0; i < 6; i++) {
      strokeDown();
      strokeUp();
      await vi.advanceTimersByTimeAsync(1000);
    }
    expect(done, "the deadline must release it").toBe(true);
  });
});
