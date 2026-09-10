// "reinit before init" — the worker's own error string, reproduced.
//
// ⚠️ THIS IS INVISIBLE TO `createLiveEngine.test.ts` BY CONSTRUCTION. Its fake
// answers `init` and `reinit` identically and always `ok: true`, so it models a
// worker that is ready the instant it exists. The real worker is not: its
// `init` case does `await import("stamp_tool")` and then `await mod.default()`
// — TWO awaits — and a `reinit` arriving in that window hits `if (!mod)` and is
// refused. A fake that cannot refuse cannot reproduce a refusal.
//
// The race is two document loads overlapping. `port.ts` does:
//
//     let port = livePort;
//     if (port) { await port.reinit(w, h); }
//     else { port = new EngineWorkerClient(); livePort = port; await port.init(w, h); }
//
// `livePort` is assigned BEFORE the init await, so the second call sees a
// truthy port and takes the reinit branch against a worker that is still
// starting. `EngineWorkerClient.init` has the same shape internally
// (`this.worker = w` precedes its own await), so both layers are exposed.

import { describe, it, expect, vi, afterEach } from "vitest";
import { createLiveEngine, disposeLivePort } from "./port";
import type { ImageHorseTool } from "stamp_tool";

/** A worker that starts SLOWLY, the way the real one does. */
function racingWorkerClass() {
  const instances: RacingWorker[] = [];
  class RacingWorker {
    terminated = false;
    sent: { kind?: string; id?: number }[] = [];
    onmessage: ((e: { data: unknown }) => void) | null = null;
    onerror: (() => void) | null = null;
    onmessageerror: (() => void) | null = null;
    /** false until `init` has "loaded the module" — the worker's `mod`. */
    private ready = false;
    private listeners: ((e: { data: unknown }) => void)[] = [];
    constructor() {
      instances.push(this);
    }
    addEventListener(_t: string, fn: (e: { data: unknown }) => void) {
      this.listeners.push(fn);
    }
    removeEventListener(_t: string, fn: (e: { data: unknown }) => void) {
      this.listeners = this.listeners.filter((l) => l !== fn);
    }
    private emit(data: unknown) {
      for (const l of [...this.listeners]) l({ data });
      this.onmessage?.({ data });
    }
    postMessage(msg: { kind?: string; id?: number }) {
      this.sent.push(msg);
      if (msg?.kind === "init") {
        // Two microtask hops, standing in for the module import and
        // `mod.default()`. The window between them is the bug.
        queueMicrotask(() =>
          queueMicrotask(() => {
            this.ready = true;
            this.emit({ id: 0, ok: true, value: { ready: true, surface: ["load_image"] } });
          }),
        );
        return;
      }
      if (msg?.kind === "reinit") {
        queueMicrotask(() => {
          // EXACTLY the worker's `case "reinit": if (!mod)` branch.
          if (!this.ready) {
            this.emit({ id: 0, ok: false, error: "reinit before init" });
            return;
          }
          this.emit({ id: 0, ok: true, value: { ready: true, surface: ["load_image"] } });
        });
        return;
      }
      if (msg?.kind === "call" && typeof msg.id === "number") {
        queueMicrotask(() => this.emit({ id: msg.id, ok: true, value: null }));
      }
    }
    terminate() {
      this.terminated = true;
    }
  }
  return { RacingWorker, instances };
}

function fakeToolClass() {
  class FakeTool {
    constructor(
      public width: number,
      public height: number,
    ) {}
    load_image() {}
  }
  return FakeTool as unknown as new (w: number, h: number) => ImageHorseTool;
}

function setFlagOn() {
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => (k === "ih_engine_worker" ? "1" : null),
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  disposeLivePort();
});

describe("two overlapping document loads", () => {
  it("does not reinit a worker that has not finished starting", async () => {
    setFlagOn();
    const { RacingWorker, instances } = racingWorkerClass();
    vi.stubGlobal("Worker", RacingWorker);
    const Tool = fakeToolClass();

    // Both loads start before either finishes — a photo switch landing on top
    // of a boot restore, which is the shape the a12.5 note measured.
    const results = await Promise.allSettled([
      createLiveEngine({ Tool, width: 8, height: 8 }),
      createLiveEngine({ Tool, width: 16, height: 16 }),
    ]);

    const rejected = results.filter((r) => r.status === "rejected");
    const reasons = rejected.map((r) => String((r as PromiseRejectedResult).reason));
    expect(
      reasons.filter((m) => m.includes("reinit before init")),
      `a load was refused by a worker that was still starting: ${reasons.join(" | ")}`,
    ).toEqual([]);

    // And exactly one worker, because reuse is the point of a12.5.
    expect(instances.length).toBe(1);
  });

  it("still reuses the worker once it IS started (no regression to rebuild)", async () => {
    setFlagOn();
    const { RacingWorker, instances } = racingWorkerClass();
    vi.stubGlobal("Worker", RacingWorker);
    const Tool = fakeToolClass();

    await createLiveEngine({ Tool, width: 8, height: 8 });
    await createLiveEngine({ Tool, width: 16, height: 16 });

    expect(instances.length).toBe(1);
    expect(instances[0].sent.filter((m) => m.kind === "reinit").length).toBe(1);
  });
});
