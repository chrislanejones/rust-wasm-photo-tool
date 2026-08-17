// Pins the v8.34 backpressure semantics now that they live in one shared
// place. Every case here is a behaviour the paint fix was measured to need;
// if one goes red, the brush lag is on its way back for every consumer at
// once — which is the trade the extraction made.
import { describe, it, expect } from "vitest";
import { createStrokeCoalescer } from "./strokeCoalescer";
import type { StrokePoint } from "./strokeCoalescer";

/** Let the coalescer's async service loop advance past an awaited send. */
const tick = () => new Promise<void>((r) => setTimeout(r, 0));

/** A send whose resolution the test controls, recording every landed call. */
function manualSend() {
  const landed: StrokePoint[] = [];
  let release: ((v: boolean | void) => void) | null = null;
  const send = (x: number, y: number) => {
    landed.push({ x, y });
    return new Promise<boolean | void>((r) => {
      release = r;
    });
  };
  return {
    landed,
    send,
    resolve: async (v: boolean | void = undefined) => {
      release!(v);
      await tick();
    },
  };
}

/** Collects rAF callbacks so the test decides when a "frame" happens. */
function manualRaf() {
  const queue: Array<() => void> = [];
  return {
    raf: (cb: () => void) => {
      queue.push(cb);
    },
    frame: () => {
      const cbs = queue.splice(0);
      cbs.forEach((cb) => cb());
    },
    queued: () => queue.length,
  };
}

describe("createStrokeCoalescer", () => {
  it("keeps at most ONE send in flight", async () => {
    const { landed, send } = manualSend();
    const s = createStrokeCoalescer(() => {}, manualRaf().raf);
    s.submit({ x: 1, y: 1 }, send);
    s.submit({ x: 2, y: 2 }, send);
    s.submit({ x: 3, y: 3 }, send);
    await tick();
    expect(landed).toEqual([{ x: 1, y: 1 }]); // the rest wait, unsent
  });

  it("newest position wins among the UNSENT moves", async () => {
    // The core of the fix: three positions arrive while the first is in
    // flight; only the LAST of them is ever sent. The middle one is the
    // obsolete cursor position the old pipeline queued 400 of.
    const m = manualSend();
    const s = createStrokeCoalescer(() => {}, manualRaf().raf);
    s.submit({ x: 1, y: 1 }, m.send);
    s.submit({ x: 2, y: 2 }, m.send);
    s.submit({ x: 3, y: 3 }, m.send);
    await m.resolve();
    expect(m.landed).toEqual([
      { x: 1, y: 1 },
      { x: 3, y: 3 },
    ]);
    await m.resolve();
    expect(m.landed.length).toBe(2); // nothing pending → loop exited
  });

  it("a SENT move is never abandoned — only unsent ones coalesce", async () => {
    // Dropping a sent call would drop paint; that fear was correct and is
    // preserved. The first submit's call always lands.
    const m = manualSend();
    const s = createStrokeCoalescer(() => {}, manualRaf().raf);
    s.submit({ x: 7, y: 7 }, m.send);
    s.submit({ x: 9, y: 9 }, m.send);
    await m.resolve();
    await m.resolve();
    expect(m.landed[0]).toEqual({ x: 7, y: 7 });
  });

  it("flushes at most once per animation frame", async () => {
    let flushes = 0;
    const raf = manualRaf();
    const s = createStrokeCoalescer(() => flushes++, raf.raf);
    // Three landed moves before any frame fires -> ONE queued flush.
    const m = manualSend();
    s.submit({ x: 1, y: 1 }, m.send);
    await m.resolve();
    s.submit({ x: 2, y: 2 }, m.send);
    await m.resolve();
    s.submit({ x: 3, y: 3 }, m.send);
    await m.resolve();
    expect(raf.queued()).toBe(1);
    raf.frame();
    expect(flushes).toBe(1);
  });

  it("a send returning false skips the flush (paint's did-anything-change contract)", async () => {
    let flushes = 0;
    const raf = manualRaf();
    const s = createStrokeCoalescer(() => flushes++, raf.raf);
    s.submit({ x: 1, y: 1 }, () => Promise.resolve(false));
    await tick();
    raf.frame();
    expect(flushes).toBe(0);
  });

  it("a send returning undefined DOES flush (fire-and-forget calls like continue_stroke)", async () => {
    let flushes = 0;
    const raf = manualRaf();
    const s = createStrokeCoalescer(() => flushes++, raf.raf);
    s.submit({ x: 1, y: 1 }, () => Promise.resolve(undefined));
    await tick();
    raf.frame();
    expect(flushes).toBe(1);
  });

  it("strokeEnd discards the unsent pending move", async () => {
    // Its segment would land after end_stroke committed the stroke, so
    // sending it would be a no-op at best and a stray dab at worst.
    const m = manualSend();
    const s = createStrokeCoalescer(() => {}, manualRaf().raf);
    s.submit({ x: 1, y: 1 }, m.send);
    s.submit({ x: 2, y: 2 }, m.send);
    s.strokeEnd();
    await m.resolve();
    expect(m.landed).toEqual([{ x: 1, y: 1 }]);
  });

  it("REGRESSION: strokeEnd resets the rAF gate so a hidden tab cannot latch it", async () => {
    // rAF never fires in a hidden tab. If a flush was queued when the stroke
    // ended there, the gate stayed latched and every later flush was silently
    // swallowed — the v8.34 stroke-end handoff exists for exactly this.
    let flushes = 0;
    const raf = manualRaf();
    const s = createStrokeCoalescer(() => flushes++, raf.raf);
    s.submit({ x: 1, y: 1 }, () => Promise.resolve(undefined));
    await tick();
    expect(raf.queued()).toBe(1); // queued, frame never fires (hidden tab)
    s.strokeEnd();
    // Next stroke: the gate must accept a new frame callback.
    s.submit({ x: 5, y: 5 }, () => Promise.resolve(undefined));
    await tick();
    expect(raf.queued()).toBe(2);
    raf.frame();
    expect(flushes).toBe(2); // the stale callback fires too; flushing twice is
    // harmless — a wedged gate that flushes NEVER was the bug
  });

  it("recovers after a rejected send (a timed-out port call must not wedge the stroke)", async () => {
    const s = createStrokeCoalescer(() => {}, manualRaf().raf);
    s.submit({ x: 1, y: 1 }, () => Promise.reject(new Error("engine call timed out")));
    await tick();
    // The loop's finally released the in-flight gate: a new submit sends.
    const m = manualSend();
    s.submit({ x: 2, y: 2 }, m.send);
    await tick();
    expect(m.landed).toEqual([{ x: 2, y: 2 }]);
  });
});
