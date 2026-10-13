import { afterEach, describe, expect, it, vi } from "vitest";
import { __resetActivityForTests, ACTIVITY_MAX_MS, beginActivity, isPageActive, trackActivity } from "./activity";

describe("page activity", () => {
  afterEach(() => {
    vi.useRealTimers();
    __resetActivityForTests();
  });

  it("is active while any token is open", () => {
    const a = beginActivity();
    const b = beginActivity();
    expect(isPageActive()).toBe(true);
    a();
    a(); // ending twice is a no-op, it must not close b
    expect(isPageActive()).toBe(true);
    b();
    expect(isPageActive()).toBe(false);
  });

  it("tracks a promise until it settles, resolved or rejected", async () => {
    let reject!: (e: unknown) => void;
    const p = trackActivity(new Promise((_, r) => (reject = r)));
    expect(isPageActive()).toBe(true);
    reject(new Error("x"));
    await p.catch(() => undefined);
    expect(isPageActive()).toBe(false);
  });

  it("expires a token that never settles", () => {
    vi.useFakeTimers();
    beginActivity();
    vi.advanceTimersByTime(ACTIVITY_MAX_MS);
    expect(isPageActive()).toBe(false);
  });
});
