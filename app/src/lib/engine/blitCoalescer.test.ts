import { describe, it, expect } from "vitest";
import { createBlitCoalescer, BLIT_CAN_WAIT_FOR } from "@/lib/engine/blitCoalescer";

/** A coalescer whose scheduled task runs only when the test says so. */
function harness() {
  let draws = 0;
  const tasks: (() => void)[] = [];
  const c = createBlitCoalescer(() => { draws++; }, (fn) => tasks.push(fn));
  return { c, draws: () => draws, runTasks: () => tasks.splice(0).forEach((t) => t()) };
}

describe("blitCoalescer", () => {
  it("a burst of blits draws ONCE", () => {
    // The opacity drag: 57 blits arrived while one draw was running, and every
    // one of them recomposited all layers afterward — 9.2 s after release.
    const h = harness();
    for (let i = 0; i < 57; i++) h.c.request();
    expect(h.draws()).toBe(0);
    h.runTasks();
    expect(h.draws()).toBe(1);
  });

  it("a blit after the draw schedules a new one", () => {
    const h = harness();
    h.c.request();
    h.runTasks();
    h.c.request();
    h.runTasks();
    expect(h.draws()).toBe(2);
  });

  it("the state reads a drag fires between blits do not force the draw", () => {
    const h = harness();
    h.c.request();
    for (const m of BLIT_CAN_WAIT_FOR) h.c.beforeCall(m);
    expect(h.draws()).toBe(0);
  });

  it("any other call draws first, so it never reads a stale composite", () => {
    // Magic wand / lasso / histogram read `composite_cache` without
    // recompositing; the old synchronous blit refreshed it before they ran.
    const h = harness();
    h.c.request();
    h.c.beforeCall("magic_wand_select");
    expect(h.draws()).toBe(1);
    // ...and the scheduled task finds nothing left to do.
    h.runTasks();
    expect(h.draws()).toBe(1);
  });

  it("nothing owed, nothing drawn", () => {
    const h = harness();
    h.c.beforeCall("calculate_histogram");
    h.runTasks();
    expect(h.draws()).toBe(0);
  });
});
