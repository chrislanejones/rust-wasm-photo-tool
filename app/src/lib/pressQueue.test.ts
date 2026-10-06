import { describe, it, expect } from "vitest";
import { PressQueue, type Press } from "./pressQueue";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => (resolve = r));
  return { promise, resolve };
}

describe("PressQueue", () => {
  it("buffers the moves and the release of a press that is still waiting", async () => {
    const q = new PressQueue();
    const gate = deferred();
    let seen: Press | null = null;
    const run = q.run({ x: 1, y: 1 }, async (p) => {
      await gate.promise;
      seen = { ...p };
    });
    expect(q.move({ x: 5, y: 6 })).toBe(true);
    expect(q.release()).toBe(true);
    gate.resolve();
    await run;
    expect(seen).toEqual({ last: { x: 5, y: 6 }, released: true });
    // Settled: nothing waits, so moves belong to the live drag again.
    expect(q.move({ x: 9, y: 9 })).toBe(false);
    expect(q.release()).toBe(false);
  });

  it("handles presses in order, each after the one before has finished", async () => {
    const q = new PressQueue();
    const order: string[] = [];
    const gate = deferred();
    const a = q.run({ x: 0, y: 0 }, async () => {
      await gate.promise;
      order.push("a");
    });
    q.release();
    const b = q.run({ x: 1, y: 1 }, async () => {
      order.push("b");
    });
    await Promise.resolve();
    expect(order).toEqual([]); // b waits for a
    gate.resolve();
    await Promise.all([a, b]);
    expect(order).toEqual(["a", "b"]);
  });

  it("moves after a newer press go to the newer press, not the old one", async () => {
    const q = new PressQueue();
    const gate = deferred();
    const got: Press[] = [];
    const a = q.run({ x: 0, y: 0 }, async (p) => {
      await gate.promise;
      got.push({ ...p });
    });
    q.release();
    const b = q.run({ x: 10, y: 10 }, async (p) => {
      got.push({ ...p });
    });
    q.move({ x: 20, y: 30 });
    q.release();
    gate.resolve();
    await Promise.all([a, b]);
    expect(got).toEqual([
      { last: { x: 0, y: 0 }, released: true },
      { last: { x: 20, y: 30 }, released: true },
    ]);
  });

  it("a press that throws does not stall the next one", async () => {
    const q = new PressQueue();
    const a = q.run({ x: 0, y: 0 }, async () => {
      throw new Error("engine gone");
    });
    let ran = false;
    const b = q.run({ x: 0, y: 0 }, async () => {
      ran = true;
    });
    await expect(a).rejects.toThrow("engine gone");
    await b;
    expect(ran).toBe(true);
  });

  it("a hover after the release is not where the drag ended", async () => {
    const q = new PressQueue();
    const gate = deferred();
    let seen: Press | null = null;
    const run = q.run({ x: 0, y: 0 }, async (p) => {
      await gate.promise;
      seen = { ...p };
    });
    q.move({ x: 30, y: 40 });
    q.release();
    expect(q.move({ x: 90, y: 90 })).toBe(false); // hovering on toward the next press
    gate.resolve();
    await run;
    expect(seen).toEqual({ last: { x: 30, y: 40 }, released: true });
  });
});
