import { describe, it, expect } from "vitest";
import { anchoredCropRect, batchCropOutputSize, cropRgba } from "./batchCrop";

describe("anchoredCropRect", () => {
  it("trims a landscape photo to a centered square", () => {
    expect(anchoredCropRect(400, 300, 1, 1, "center")).toEqual({
      x: 50,
      y: 0,
      width: 300,
      height: 300,
    });
  });

  it("keeps the anchored side", () => {
    expect(anchoredCropRect(400, 300, 1, 1, "middle-left").x).toBe(0);
    expect(anchoredCropRect(400, 300, 1, 1, "bottom-right").x).toBe(100);
    // Portrait photo, square crop: the anchor's row decides what's kept.
    expect(anchoredCropRect(300, 500, 1, 1, "top-center").y).toBe(0);
    expect(anchoredCropRect(300, 500, 1, 1, "bottom-center").y).toBe(200);
    expect(anchoredCropRect(300, 500, 1, 1, "center").y).toBe(100);
  });

  it("fits 4:5 inside both landscape and portrait photos", () => {
    expect(anchoredCropRect(1000, 600, 4, 5, "center")).toEqual({
      x: 260,
      y: 0,
      width: 480,
      height: 600,
    });
    expect(anchoredCropRect(800, 2000, 4, 5, "center")).toEqual({
      x: 0,
      y: 500,
      width: 800,
      height: 1000,
    });
  });

  it("is a no-op on a photo already at the ratio", () => {
    expect(anchoredCropRect(1600, 900, 16, 9, "top-left")).toEqual({
      x: 0,
      y: 0,
      width: 1600,
      height: 900,
    });
  });
});

describe("batchCropOutputSize", () => {
  it("gives every photo the same size when a width is set", () => {
    const a = batchCropOutputSize({ width: 480, height: 600 }, [4, 5], 1080);
    const b = batchCropOutputSize({ width: 799, height: 1001 }, [4, 5], 1080);
    expect(a).toEqual({ width: 1080, height: 1350 });
    expect(b).toEqual(a);
  });

  it("keeps the crop's own size when no width is set", () => {
    expect(batchCropOutputSize({ width: 480, height: 600 }, [4, 5], null)).toEqual({
      width: 480,
      height: 600,
    });
  });
});

describe("cropRgba", () => {
  it("copies exactly the rect's pixels", () => {
    // 3×2 image, each pixel's R channel = its index.
    const src = new Uint8Array(3 * 2 * 4);
    for (let i = 0; i < 6; i++) src[i * 4] = i;
    const out = cropRgba(src, 3, { x: 1, y: 0, width: 2, height: 2 });
    expect(out.length).toBe(2 * 2 * 4);
    expect([out[0], out[4], out[8], out[12]]).toEqual([1, 2, 4, 5]);
  });
});
