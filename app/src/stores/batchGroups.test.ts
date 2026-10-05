// Batch — Main and Exceptions. The gallery's ticked photos are the Exceptions;
// every Batch tool runs on one group, and Crop keeps a crop per group. Getting
// the split wrong is silent: photo 4 comes out 1:1 when you asked for 4:5.
import { describe, it, expect, beforeEach } from "vitest";
import { cropRatioOf, framingFor, useBatchCropStore } from "./useBatchCropStore";
import { groupOf, splitGroups } from "./useBatchGroupStore";

const PHOTOS = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }];
const initial = useBatchCropStore.getState();

describe("Main and Exceptions", () => {
  beforeEach(() => useBatchCropStore.setState(initial, true));

  it("nothing ticked: every photo is Main", () => {
    const g = splitGroups(new Set(), PHOTOS);
    expect(g.main.map((p) => p.id)).toEqual(["a", "b", "c", "d"]);
    expect(g.exceptions).toEqual([]);
  });

  it("ticked photos are the Exceptions, in gallery order", () => {
    const g = splitGroups(new Set(["d", "b"]), PHOTOS);
    expect(g.main.map((p) => p.id)).toEqual(["a", "c"]);
    expect(g.exceptions.map((p) => p.id)).toEqual(["b", "d"]);
    expect(groupOf(new Set(["b"]), "b")).toBe("exceptions");
    expect(groupOf(new Set(["b"]), "a")).toBe("main");
  });

  it("a ticked id no longer in the gallery is ignored", () => {
    const g = splitGroups(new Set(["gone"]), PHOTOS);
    expect(g.main).toHaveLength(4);
    expect(g.exceptions).toHaveLength(0);
  });

  it("each group keeps its own crop ratio", () => {
    const s = useBatchCropStore.getState();
    s.setRatioId("main", "1:1");
    s.setRatioId("exceptions", "16:9");
    const { looks } = useBatchCropStore.getState();
    expect(cropRatioOf(looks.main)).toEqual([1, 1]);
    expect(cropRatioOf(looks.exceptions)).toEqual([16, 9]);
  });

  it("a frame drawn on an exception is followed by exceptions only", () => {
    const f = { cx: 0.3, cy: 0.3, scale: 0.5 };
    useBatchCropStore.getState().setFraming("exceptions", "b", f);
    const s = useBatchCropStore.getState();
    expect(framingFor(s, "exceptions", "d")).toEqual(f);
    expect(framingFor(s, "main", "a")).toBeUndefined();
  });

  it("an anchor resets only its own group's hand frames", () => {
    const f = { cx: 0.5, cy: 0.5, scale: 0.8 };
    const s = useBatchCropStore.getState();
    s.setFraming("main", "a", f);
    s.setFraming("exceptions", "b", f);
    useBatchCropStore.getState().setAnchor("exceptions", "top-center", ["b"]);
    const after = useBatchCropStore.getState();
    expect(after.framing.a).toEqual(f);
    expect(after.framing.b).toBeUndefined();
    expect(after.looks.exceptions.shared).toBeNull();
    expect(after.looks.main.shared).toEqual(f);
  });
});
