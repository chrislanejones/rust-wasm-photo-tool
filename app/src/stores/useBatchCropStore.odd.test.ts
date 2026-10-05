// Batch › Bulk — the odd ones out. The gallery's ticked photos form the Odd
// group and get their own crop; everyone else gets the bulk's. Getting the split
// wrong is silent: photo 4 comes out 1:1 when you asked for 4:5.
import { describe, it, expect, beforeEach } from "vitest";
import {
  cropRatioOf,
  framingFor,
  groupOf,
  splitBulk,
  useBatchCropStore,
} from "./useBatchCropStore";

const PHOTOS = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }];
const initial = useBatchCropStore.getState();

describe("odd ones out", () => {
  beforeEach(() => useBatchCropStore.setState(initial, true));

  it("nothing ticked: every photo is in the bulk", () => {
    const g = splitBulk(new Set(), PHOTOS);
    expect(g.bulk.map((p) => p.id)).toEqual(["a", "b", "c", "d"]);
    expect(g.odd).toEqual([]);
  });

  it("ticked photos are the odd group, in gallery order", () => {
    const g = splitBulk(new Set(["d", "b"]), PHOTOS);
    expect(g.bulk.map((p) => p.id)).toEqual(["a", "c"]);
    expect(g.odd.map((p) => p.id)).toEqual(["b", "d"]);
    expect(groupOf(new Set(["b"]), "b")).toBe("odd");
    expect(groupOf(new Set(["b"]), "a")).toBe("bulk");
  });

  it("a ticked id no longer in the gallery is ignored", () => {
    const g = splitBulk(new Set(["gone"]), PHOTOS);
    expect(g.bulk).toHaveLength(4);
    expect(g.odd).toHaveLength(0);
  });

  it("each group keeps its own ratio", () => {
    const s = useBatchCropStore.getState();
    s.setRatioId("bulk", "1:1");
    s.setRatioId("odd", "16:9");
    const { looks } = useBatchCropStore.getState();
    expect(cropRatioOf(looks.bulk)).toEqual([1, 1]);
    expect(cropRatioOf(looks.odd)).toEqual([16, 9]);
  });

  it("a frame drawn on an odd photo is followed by odd photos only", () => {
    const f = { cx: 0.3, cy: 0.3, scale: 0.5 };
    useBatchCropStore.getState().setFraming("odd", "b", f);
    const s = useBatchCropStore.getState();
    expect(framingFor(s, "odd", "d")).toEqual(f);
    expect(framingFor(s, "bulk", "a")).toBeUndefined();
  });

  it("an anchor resets only its own group's hand frames", () => {
    const f = { cx: 0.5, cy: 0.5, scale: 0.8 };
    const s = useBatchCropStore.getState();
    s.setFraming("bulk", "a", f);
    s.setFraming("odd", "b", f);
    useBatchCropStore.getState().setAnchor("odd", "top-center", ["b"]);
    const after = useBatchCropStore.getState();
    expect(after.framing.a).toEqual(f);
    expect(after.framing.b).toBeUndefined();
    expect(after.looks.odd.shared).toBeNull();
    expect(after.looks.bulk.shared).toEqual(f);
  });
});
