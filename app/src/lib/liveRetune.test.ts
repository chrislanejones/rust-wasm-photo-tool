// The live Tolerance scheduler, against a fake engine whose runs resolve when
// the test says so. What it must guarantee: ticks inside the debounce window
// never reach the engine, at most one run is in flight, a tick during a run
// waits for it, and only the newest answer is shown.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createLiveRetune } from "./liveRetune";

/** A fake engine: every call is recorded and stays pending until released. */
function fakeEngine() {
  const calls: number[] = [];
  const pending: Array<() => void> = [];
  const run = (v: number) =>
    new Promise<string>((resolve) => {
      calls.push(v);
      pending.push(() => resolve(`mask@${v}`));
    });
  const release = async () => {
    pending.shift()?.();
    await flush();
  };
  return { calls, run, release, inFlight: () => pending.length };
}

const flush = () => new Promise<void>((r) => queueMicrotask(r)).then(() => Promise.resolve());

async function settle(ms: number) {
  await vi.advanceTimersByTimeAsync(ms);
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

function setup() {
  const engine = fakeEngine();
  const shown: string[] = [];
  const idle = vi.fn();
  const live = createLiveRetune<number, string>({
    delayMs: 70,
    run: engine.run,
    onResult: (r) => shown.push(r),
    onIdle: idle,
  });
  return { engine, shown, idle, live };
}

describe("debounce", () => {
  it("a burst of ticks inside the window makes ONE run, with the last value", async () => {
    const { engine, live } = setup();
    for (const v of [10, 11, 12, 13]) {
      live.schedule(v);
      await settle(20);
    }
    expect(engine.calls).toEqual([]);
    await settle(70);
    expect(engine.calls).toEqual([13]);
  });

  it("nothing runs before the quiet time has passed", async () => {
    const { engine, live } = setup();
    live.schedule(5);
    await settle(69);
    expect(engine.calls).toEqual([]);
    await settle(1);
    expect(engine.calls).toEqual([5]);
  });
});

describe("one run in flight", () => {
  it("a tick during a run waits for it, then runs — never two at once", async () => {
    const { engine, live } = setup();
    live.schedule(1);
    await settle(70);
    expect(engine.inFlight()).toBe(1);

    live.schedule(2);
    await settle(70);
    expect(engine.calls).toEqual([1]); // still waiting on run 1
    expect(engine.inFlight()).toBe(1);

    await engine.release();
    expect(engine.calls).toEqual([1, 2]);
  });

  it("ticks that arrive during a run collapse to the newest — the rest never run", async () => {
    const { engine, live } = setup();
    live.schedule(1);
    await settle(70);
    for (const v of [2, 3, 4]) {
      live.schedule(v);
      await settle(80); // each one clears the debounce
    }
    await engine.release();
    expect(engine.calls).toEqual([1, 4]);
  });
});

describe("only the newest answer is shown", () => {
  it("a run overtaken by a newer tick is not shown; the newer one is", async () => {
    const { engine, shown, live } = setup();
    live.schedule(1);
    await settle(70);
    live.schedule(2);
    await settle(70);
    await engine.release(); // run 1 returns — stale
    expect(shown).toEqual([]);
    await engine.release(); // run 2 returns
    expect(shown).toEqual(["mask@2"]);
  });

  it("a single settled tick is shown", async () => {
    const { engine, shown, live } = setup();
    live.schedule(7);
    await settle(70);
    await engine.release();
    expect(shown).toEqual(["mask@7"]);
  });
});

describe("cancel — a new click", () => {
  it("drops a pending tick before it runs", async () => {
    const { engine, live } = setup();
    live.schedule(1);
    await settle(30);
    live.cancel();
    await settle(100);
    expect(engine.calls).toEqual([]);
  });

  it("ignores the answer of the run in flight", async () => {
    const { engine, shown, live } = setup();
    live.schedule(1);
    await settle(70);
    live.cancel();
    await engine.release();
    expect(shown).toEqual([]);
  });

  it("the slider works again after a cancel", async () => {
    const { engine, shown, live } = setup();
    live.schedule(1);
    live.cancel();
    live.schedule(9);
    await settle(70);
    await engine.release();
    expect(shown).toEqual(["mask@9"]);
  });
});

describe("idle", () => {
  it("fires once the last run returns with nothing pending", async () => {
    const { engine, idle, live } = setup();
    live.schedule(1);
    await settle(70);
    live.schedule(2);
    await settle(70);
    await engine.release();
    expect(idle).not.toHaveBeenCalled(); // run 2 started from the queue
    await engine.release();
    expect(idle).toHaveBeenCalledTimes(1);
  });

  it("a failed run is not shown, and the scheduler keeps working", async () => {
    const shown: string[] = [];
    let fail = true;
    const live = createLiveRetune<number, string>({
      delayMs: 10,
      run: async (v) => {
        if (fail) throw new Error("engine said no");
        return `ok@${v}`;
      },
      onResult: (r) => shown.push(r),
    });
    live.schedule(1);
    await settle(10);
    fail = false;
    live.schedule(2);
    await settle(10);
    expect(shown).toEqual(["ok@2"]);
  });
});

describe("a delay function is read per tick", () => {
  it("lets a slow document wait for the drag to pause", async () => {
    const engine = fakeEngine();
    let big = false;
    const live = createLiveRetune<number, string>({
      delayMs: () => (big ? 300 : 70),
      run: engine.run,
      onResult: () => {},
    });
    live.schedule(1);
    await settle(70);
    expect(engine.calls).toEqual([1]);
    await engine.release();

    big = true;
    for (const v of [2, 3, 4]) {
      live.schedule(v);
      await settle(100); // a drag: never 300 ms of quiet
    }
    expect(engine.calls).toEqual([1]);
    await settle(300); // the pause
    expect(engine.calls).toEqual([1, 4]);
  });
});
