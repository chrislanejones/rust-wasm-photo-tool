import { describe, expect, it } from "vitest";
import {
  BLOCK_MIN,
  BLUR_MAX,
  BLUR_MIN,
  blurPath,
  boxOnPhoto,
  lookLabel,
  safeStrength,
  DEFAULT_REDACT_LOOK,
  type RedactBox,
} from "@/lib/batchRedact";

// A nav-bar email drawn on a 1440 × 900 screenshot.
const EMAIL: RedactBox = { id: "a", x: 1100, y: 20, w: 240, h: 24, srcW: 1440, srcH: 900 };

describe("where the same place is", () => {
  it("relative (the default): the same fractions, so a 2x screenshot gets a 2x box", () => {
    expect(DEFAULT_REDACT_LOOK.placement).toBe("relative");
    const r = boxOnPhoto(EMAIL, { placement: "relative", anchor: "top-left" }, 2880, 1800)!;
    expect(r).toEqual({ x: 2200, y: 40, w: 480, h: 48 });
  });

  it("anchored top-right: same pixel size, same distance from the top-right corner", () => {
    // 100 px from the right edge on the 1440-wide shot (1440 - 1100 - 240).
    const r = boxOnPhoto(EMAIL, { placement: "anchored", anchor: "top-right" }, 1920, 1080)!;
    expect(r).toEqual({ x: 1920 - 100 - 240, y: 20, w: 240, h: 24 });
  });

  it("anchored bottom-left and center keep their own edges", () => {
    const foot: RedactBox = { id: "b", x: 10, y: 860, w: 300, h: 30, srcW: 1440, srcH: 900 };
    expect(boxOnPhoto(foot, { placement: "anchored", anchor: "bottom-left" }, 1000, 700)).toEqual({ x: 10, y: 660, w: 300, h: 30 });
    const mid: RedactBox = { id: "c", x: 620, y: 430, w: 200, h: 40, srcW: 1440, srcH: 900 };
    // Centered on the source; stays centered on the target.
    expect(boxOnPhoto(mid, { placement: "anchored", anchor: "center" }, 1000, 600)).toEqual({ x: 400, y: 280, w: 200, h: 40 });
  });

  it("is clipped to the photo, and is null when nothing of it is left", () => {
    const r = boxOnPhoto(EMAIL, { placement: "anchored", anchor: "top-left" }, 1200, 800)!;
    expect(r).toEqual({ x: 1100, y: 20, w: 100, h: 24 });
    expect(boxOnPhoto(EMAIL, { placement: "anchored", anchor: "top-left" }, 900, 800)).toBeNull();
  });
});

describe("strength floors", () => {
  it("a stored strength below the floor is raised to it, above the cap lowered", () => {
    expect(safeStrength({ block: 4, blur: 2 })).toEqual({ block: BLOCK_MIN, blur: BLUR_MIN });
    expect(safeStrength({ block: 16, blur: 99 })).toEqual({ block: 16, blur: BLUR_MAX });
  });
});

describe("the blur path", () => {
  it("starts and ends on the box edges, rows at most 0.9 radius apart, serpentine", () => {
    const box = { x: 100, y: 50, w: 200, h: 40 };
    const { radius, points } = blurPath(box);
    expect(radius).toBe(10);
    const ys = [...new Set(points.map((p) => p[1]))];
    expect(ys[0]).toBe(50);
    expect(ys.at(-1)).toBe(90);
    for (let i = 1; i < ys.length; i++) expect(ys[i]! - ys[i - 1]!).toBeLessThanOrEqual(radius * 0.9 + 1e-9);
    // Every point is on or inside the box.
    for (const [x, y] of points) {
      expect(x).toBeGreaterThanOrEqual(100);
      expect(x).toBeLessThanOrEqual(300);
      expect(y).toBeGreaterThanOrEqual(50);
      expect(y).toBeLessThanOrEqual(90);
    }
    // Row 0 left→right, row 1 right→left.
    expect(points.slice(0, 4)).toEqual([[100, 50], [300, 50], [300, ys[1]], [100, ys[1]]]);
  });
});

it("labels the apply button", () => {
  expect(lookLabel({ ...DEFAULT_REDACT_LOOK, boxes: [EMAIL] })).toBe("Pixelate 1 box");
  expect(lookLabel({ ...DEFAULT_REDACT_LOOK, style: "blur", boxes: [EMAIL, EMAIL] })).toBe("Blur 2 boxes");
});
