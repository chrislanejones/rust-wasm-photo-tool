import { describe, expect, it } from "vitest";
import {
  changesCount,
  focusOn,
  markStyle,
  paintMask,
  regionLabel,
  regionQuads,
  sizesDifferLine,
  toleranceFor,
  unpackDiff,
} from "./screenshotDiff";

describe("unpackDiff", () => {
  it("reads the size, the regions and the mask words", () => {
    const d = unpackDiff([4, 2, 2, 10, 20, 30, 40, 99, 1, 2, 3, 4, 5, 0b1001, 7]);
    expect(d.w).toBe(4);
    expect(d.h).toBe(2);
    expect(d.regions).toEqual([
      { x: 10, y: 20, w: 30, h: 40, px: 99 },
      { x: 1, y: 2, w: 3, h: 4, px: 5 },
    ]);
    expect(Array.from(d.mask)).toEqual([0b1001, 7]);
  });

  it("an empty answer is no changes", () => {
    expect(unpackDiff([0, 0, 0])).toMatchObject({ w: 0, h: 0, regions: [] });
  });
});

describe("paintMask", () => {
  it("tints exactly the set bits, low bit first, row-major", () => {
    const diff = unpackDiff([3, 2, 0, 0b100010]); // pixels 1 and 5
    const img = { data: new Uint8ClampedArray(3 * 2 * 4).fill(9) } as ImageData;
    paintMask(diff, img, [1, 2, 3, 4]);
    const set = [];
    for (let p = 0; p < 6; p++) if (img.data[p * 4 + 3]) set.push(p);
    expect(set).toEqual([1, 5]);
    expect(Array.from(img.data.slice(4, 8))).toEqual([1, 2, 3, 4]);
    expect(img.data[0]).toBe(0);
  });

  it("handles the top bit of a word", () => {
    const diff = unpackDiff([32, 1, 0, 0x80000001]);
    const img = { data: new Uint8ClampedArray(32 * 4) } as ImageData;
    paintMask(diff, img, [255, 0, 0, 255]);
    expect(img.data[3]).toBe(255);
    expect(img.data[31 * 4 + 3]).toBe(255);
    expect(img.data[15 * 4 + 3]).toBe(0);
  });
});

describe("toleranceFor", () => {
  it("the default sensitivity is the tolerance the fixtures were tuned at", () => {
    expect(toleranceFor(50)).toBe(28);
  });
  it("higher sensitivity finds smaller differences", () => {
    expect(toleranceFor(100)).toBeLessThan(toleranceFor(50));
    expect(toleranceFor(0)).toBeGreaterThan(toleranceFor(50));
    expect(toleranceFor(-5)).toBe(toleranceFor(0));
  });
});

describe("words", () => {
  it("counts changes in plain English", () => {
    expect(changesCount(0)).toBe("No changes");
    expect(changesCount(1)).toBe("1 change");
    expect(changesCount(7)).toBe("7 changes");
  });
  it("a row reads as one sentence", () => {
    expect(regionLabel(2, 7, { x: 512, y: 300, w: 240, h: 80, px: 1 })).toBe("Change 3 of 7, 240 by 80 at 512, 300");
  });
  it("says when sizes differ, and what is compared", () => {
    expect(sizesDifferLine({ w: 1440, h: 900 }, { w: 1440, h: 900 })).toBeNull();
    expect(sizesDifferLine({ w: 1600, h: 900 }, { w: 1440, h: 1000 })).toBe("Sizes differ: comparing the 1440×900 they share");
  });
});

describe("regionQuads", () => {
  it("flattens to x, y, w, h", () => {
    expect(Array.from(regionQuads([{ x: 1, y: 2, w: 3, h: 4, px: 9 }, { x: 5, y: 6, w: 7, h: 8, px: 9 }]))).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });
});

describe("markStyle", () => {
  it("grows with the photo, never below readable", () => {
    expect(markStyle(400, 300)).toEqual({ stroke: 2, pad: 3, pin: 22 });
    const big = markStyle(4000, 3000);
    expect(big.stroke).toBe(10);
    expect(big.pin).toBe(100);
  });
});

describe("focusOn", () => {
  it("centers the change: a change at the middle needs no pan", () => {
    const v = focusOn({ x: 450, y: 250, w: 100, h: 100 }, 1000, 600, 500, 300)!;
    expect(v.zoom).toBe(3);
    expect([v.pan.x + 0, v.pan.y + 0]).toEqual([0, 0]); // + 0: -0 is no pan too
  });
  it("pans the other way from where the change sits, scaled by zoom", () => {
    const v = focusOn({ x: 0, y: 0, w: 100, h: 100 }, 1000, 600, 500, 300)!;
    // Center (50, 50) doc px = (25, 25) css; canvas center (250, 150).
    expect(v.pan).toEqual({ x: 225 * v.zoom, y: 125 * v.zoom });
  });
  it("zoom stays between 1x and 8x", () => {
    expect(focusOn({ x: 0, y: 0, w: 1, h: 1 }, 1000, 600, 500, 300)!.zoom).toBe(8);
    expect(focusOn({ x: 0, y: 0, w: 1000, h: 600 }, 1000, 600, 500, 300)!.zoom).toBe(1);
    expect(focusOn({ x: 0, y: 0, w: 0, h: 5 }, 1000, 600, 500, 300)).toBeNull();
  });
});
