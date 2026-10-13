import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { withTimeout } from "./withTimeout";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("withTimeout (ADR-083: cancel, don't abandon)", () => {
  it("aborts the controller when the timer wins, then rejects", async () => {
    const ctl = new AbortController();
    const p = withTimeout(new Promise(() => {}), 100, "upload", { abort: ctl });
    const settled = expect(p).rejects.toThrow("upload did not settle within 100ms");
    await vi.advanceTimersByTimeAsync(100);
    await settled;
    expect(ctl.signal.aborted).toBe(true);
  });

  it("never aborts when the work wins, and leaves no timer armed", async () => {
    const ctl = new AbortController();
    await expect(withTimeout(Promise.resolve(7), 100, "upload", { abort: ctl })).resolves.toBe(7);
    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(1000);
    expect(ctl.signal.aborted).toBe(false);
  });

  it("without a controller it only rejects, as a Convex mutation needs", async () => {
    const p = withTimeout(new Promise(() => {}), 50, "saveEdit", { message: "custom" });
    const settled = expect(p).rejects.toThrow("custom");
    await vi.advanceTimersByTimeAsync(50);
    await settled;
  });
});
