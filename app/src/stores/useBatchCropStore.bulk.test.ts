// Batch › Bulk — who is in the pass.
//
// The rule this pins: a photo nobody has touched is in the bulk, and a held
// photo is in NO list that counts work. Getting that wrong in either direction
// is a silent one — the button says "Crop 8 of 10", the pass moves 9 or 7, and
// the only symptom is a photo at the wrong size.
//
// Per ADR-071 rule 4 the assertions were each broken once on purpose before
// they were allowed to stand: `bulkPhotos` made to return every photo, and
// `heldCount` made to count the bulk. Six of the seven went red (the seventh
// pins that a hold leaves the ratio alone, which neither mutation touches).
import { describe, it, expect, beforeEach } from "vitest";
import {
  bulkPhotos,
  cropRatioOf,
  heldCount,
  isHeld,
  useBatchCropStore,
} from "./useBatchCropStore";

const PHOTOS = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }];

/** The store's own actions, the way a panel reaches them. */
const hold = (id: string) => useBatchCropStore.getState().toggleHeld(id);
const unholdAll = () => useBatchCropStore.getState().clearHeld();

describe("the bulk", () => {
  beforeEach(() => {
    useBatchCropStore.setState({ held: {} });
  });

  it("starts with the whole gallery in it", () => {
    const s = useBatchCropStore.getState();
    expect(bulkPhotos(s, PHOTOS)).toHaveLength(4);
    expect(heldCount(s, PHOTOS)).toBe(0);
    expect(isHeld(s, "a")).toBe(false);
  });

  it("holds a photo out, and puts it back", () => {
    hold("b");
    let s = useBatchCropStore.getState();
    expect(isHeld(s, "b")).toBe(true);
    expect(bulkPhotos(s, PHOTOS).map((p) => p.id)).toEqual(["a", "c", "d"]);
    expect(heldCount(s, PHOTOS)).toBe(1);

    hold("b");
    s = useBatchCropStore.getState();
    expect(bulkPhotos(s, PHOTOS).map((p) => p.id)).toEqual(["a", "b", "c", "d"]);
    expect(heldCount(s, PHOTOS)).toBe(0);
  });

  it("toggling one photo leaves the others' state alone", () => {
    hold("a");
    hold("c");
    const s = useBatchCropStore.getState();
    expect(bulkPhotos(s, PHOTOS).map((p) => p.id)).toEqual(["b", "d"]);
    expect(heldCount(s, PHOTOS)).toBe(2);
  });

  it("clears every hold at once", () => {
    hold("a");
    hold("d");
    unholdAll();
    expect(heldCount(useBatchCropStore.getState(), PHOTOS)).toBe(0);
  });

  it("an empty bulk is empty, not everyone", () => {
    // The button's disabled state depends on this: `Crop 0 of 4` must not be a
    // way to crop all four.
    for (const p of PHOTOS) hold(p.id);
    const s = useBatchCropStore.getState();
    expect(bulkPhotos(s, PHOTOS)).toEqual([]);
    expect(heldCount(s, PHOTOS)).toBe(4);
  });

  it("a hold for a photo that no longer exists is harmless", () => {
    // Photos are deleted from under a mounted panel; the key is never pruned,
    // and must not be able to hold anything else out or throw.
    hold("gone");
    const s = useBatchCropStore.getState();
    expect(bulkPhotos(s, PHOTOS)).toHaveLength(4);
    expect(heldCount(s, PHOTOS)).toBe(0);
    expect(isHeld(s, "gone")).toBe(true);
  });

  it("holding photos out does not disturb the crop settings", () => {
    // `held` is a new field on a store that already had five; a setter that
    // rebuilt the whole state would quietly reset the ratio the pass is about
    // to use.
    useBatchCropStore.setState({ ratioId: "4:5", customRatio: [3, 2] });
    hold("a");
    const s = useBatchCropStore.getState();
    expect(cropRatioOf(s)).toEqual([3, 2]);
    expect(s.ratioId).toBe("4:5");
  });
});