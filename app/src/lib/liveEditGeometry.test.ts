import { afterEach, describe, it, expect } from "vitest";
import type { DrawEditState } from "./drawEditState";
import {
  applyLiveGeometry,
  liveDragActive,
  moveLiveGeometry,
  setLiveGeometry,
  takeLiveEdit,
  takeLiveGeometry,
} from "./liveEditGeometry";

const base: DrawEditState = {
  kind: "shape",
  start: { x: 0, y: 0 },
  end: { x: 10, y: 10 },
  rotation: 30,
  drawnShape: "rect",
};

afterEach(() => setLiveGeometry(null));

describe("live edit geometry", () => {
  it("a move step keeps the edit's rotation and type unless the handle sets them", () => {
    moveLiveGeometry({ x: 5, y: 5 }, { x: 15, y: 15 });
    const shown = applyLiveGeometry(base, takeLiveGeometry());
    expect(shown.start).toEqual({ x: 5, y: 5 });
    expect(shown.end).toEqual({ x: 15, y: 15 });
    expect(shown.rotation).toBe(30);
    expect(shown.drawnShape).toBe("rect");
  });

  it("nothing in flight shows the edit itself", () => {
    expect(applyLiveGeometry(base, null)).toBe(base);
    expect(liveDragActive()).toBe(false);
  });

  it("a commit mid-drag takes the drag, empties the store and marks the edit dirty", () => {
    moveLiveGeometry({ x: 1, y: 1 }, { x: 2, y: 2 }, 45);
    expect(liveDragActive()).toBe(true);
    const dirty = { current: false };
    const es = takeLiveEdit(base, dirty);
    expect(es?.start).toEqual({ x: 1, y: 1 });
    expect(es?.rotation).toBe(45);
    expect(dirty.current).toBe(true);
    expect(liveDragActive()).toBe(false);
  });

  it("no drag leaves the edit and the dirty flag alone", () => {
    const dirty = { current: false };
    expect(takeLiveEdit(base, dirty)).toBe(base);
    expect(dirty.current).toBe(false);
    expect(takeLiveEdit(null)).toBeNull();
  });
});
