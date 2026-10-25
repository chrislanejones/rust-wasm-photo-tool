import { beforeEach, describe, expect, it } from "vitest";
import { useViewStore } from "./useViewStore";

describe("useViewStore", () => {
  beforeEach(() => useViewStore.getState().resetPan());

  it("starts home and takes a pan", () => {
    expect(useViewStore.getState().pan).toEqual({ x: 0, y: 0 });
    useViewStore.getState().setPan({ x: -120, y: 48 });
    expect(useViewStore.getState().pan).toEqual({ x: -120, y: 48 });
  });

  it("resetPan puts it back at (0, 0)", () => {
    useViewStore.getState().setPan({ x: 300, y: -7 });
    useViewStore.getState().resetPan();
    expect(useViewStore.getState().pan).toEqual({ x: 0, y: 0 });
  });

  it("resetPan at home changes nothing, so no subscriber re-renders", () => {
    const before = useViewStore.getState();
    let calls = 0;
    const off = useViewStore.subscribe(() => calls++);
    useViewStore.getState().resetPan();
    off();
    expect(calls).toBe(0);
    expect(useViewStore.getState()).toBe(before);
  });
});
