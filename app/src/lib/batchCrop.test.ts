import { describe, it, expect } from "vitest";
import {
  anchoredCropRect,
  batchCropOutputSize,
  cropRgba,
  framedCropRect,
  framingFromRect,
  moveCropRect,
  resizeCropRectFromCorner,
} from "./batchCrop";

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

describe("framedCropRect / framingFromRect", () => {
  it("a centered full-size framing is the centered anchor crop", () => {
    expect(framedCropRect(400, 300, 1, 1, { cx: 0.5, cy: 0.5, scale: 1 })).toEqual(
      anchoredCropRect(400, 300, 1, 1, "center"),
    );
  });

  it("round-trips a rect through a framing", () => {
    const rect = { x: 20, y: 40, width: 150, height: 150 };
    const f = framingFromRect(400, 300, 1, 1, rect);
    expect(framedCropRect(400, 300, 1, 1, f)).toEqual(rect);
  });

  it("replays the same framing at a different resolution", () => {
    const f = framingFromRect(400, 300, 1, 1, { x: 0, y: 0, width: 150, height: 150 });
    // Same photo at 2x — the frame lands on the same part of the picture.
    expect(framedCropRect(800, 600, 1, 1, f)).toEqual({ x: 0, y: 0, width: 300, height: 300 });
  });

  it("keeps the ratio exact and the frame inside the photo", () => {
    const r = framedCropRect(1000, 600, 4, 5, { cx: 0.99, cy: 0.01, scale: 0.5 });
    expect(r.width * 5).toBe(r.height * 4);
    expect(r.x + r.width).toBeLessThanOrEqual(1000);
    expect(r.y).toBe(0);
  });

  it("survives a ratio change by keeping the center", () => {
    const f = { cx: 0.3, cy: 0.5, scale: 0.5 };
    const sq = framedCropRect(1000, 600, 1, 1, f);
    const tall = framedCropRect(1000, 600, 4, 5, f);
    expect(sq.x + sq.width / 2).toBeCloseTo(300, 0);
    expect(tall.x + tall.width / 2).toBeCloseTo(300, 0);
  });
});

describe("moveCropRect", () => {
  it("stops at the photo edges", () => {
    const r = { x: 50, y: 0, width: 300, height: 300 };
    expect(moveCropRect(400, 300, r, -500, 0).x).toBe(0);
    expect(moveCropRect(400, 300, r, 500, 99).x).toBe(100);
    expect(moveCropRect(400, 300, r, 500, 99).y).toBe(0);
  });
});

describe("resizeCropRectFromCorner", () => {
  const r = { x: 100, y: 100, width: 100, height: 100 };

  it("pins the opposite corner and locks the ratio", () => {
    const out = resizeCropRectFromCorner(400, 300, 1, 1, r, "se", 260, 230);
    expect(out).toEqual({ x: 100, y: 100, width: 160, height: 160 });
    const nw = resizeCropRectFromCorner(400, 300, 1, 1, r, "nw", 150, 170);
    // Pinned at (200, 200); pulled 50 × 30 → the larger pull wins.
    expect(nw).toEqual({ x: 150, y: 150, width: 50, height: 50 });
  });

  it("stops at the photo edge", () => {
    const out = resizeCropRectFromCorner(400, 300, 1, 1, r, "se", 900, 900);
    // 200px of room below the pinned corner caps a square at 200.
    expect(out).toEqual({ x: 100, y: 100, width: 200, height: 200 });
  });

  it("never shrinks below the minimum frame", () => {
    const out = resizeCropRectFromCorner(400, 300, 1, 1, r, "se", 100, 100);
    expect(out.width).toBe(30); // 10% of the 300px largest square
  });
});
