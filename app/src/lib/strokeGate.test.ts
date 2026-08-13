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
    expect(session).toMatch(/whenStrokeIdle\(\)\.then\(\(\) => flushRef\.current\(\)\)/);
  });
});
