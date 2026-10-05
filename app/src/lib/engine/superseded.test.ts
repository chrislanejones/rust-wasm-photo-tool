import { describe, it, expect } from "vitest";
import { dropSuperseded, installDroppedRejectionHandler, isSuperseded } from "./superseded";

describe("superseded engine requests", () => {
  it("recognizes the worker's replaced and released rejections", () => {
    expect(isSuperseded(new Error("engine document replaced"))).toBe(true);
    expect(isSuperseded(new Error("engine released"))).toBe(true);
  });
  it("does not swallow a real failure", () => {
    expect(isSuperseded(new Error("out of memory"))).toBe(false);
    expect(() => dropSuperseded(new Error("out of memory"))).toThrow("out of memory");
    expect(() => dropSuperseded(new Error("engine document replaced"))).not.toThrow();
  });
});

describe("installDroppedRejectionHandler", () => {
  it("prevents only superseded rejections", () => {
    let handler!: (e: PromiseRejectionEvent) => void;
    installDroppedRejectionHandler({
      addEventListener: ((_: string, h: (e: PromiseRejectionEvent) => void) => (handler = h)) as unknown as Window["addEventListener"],
    });
    const ev = (reason: unknown) => {
      let prevented = false;
      handler({ reason, preventDefault: () => (prevented = true) } as unknown as PromiseRejectionEvent);
      return prevented;
    };
    expect(ev(new Error("engine document replaced"))).toBe(true);
    expect(ev(new Error("something real"))).toBe(false);
  });
});
