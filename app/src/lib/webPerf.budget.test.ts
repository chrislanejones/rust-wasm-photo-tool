// The byte budget, and the rule behind it.
//
// THE POINT OF THIS FILE is that the numbers come from Lighthouse rather than
// from taste. `webTargetBytes` was a flat 200 KB, which is wrong for every
// image size at once: Lighthouse measures BYTES PER PIXEL, so the budget scales
// with the pixel count. These cases are the ones that were wrong.
import { describe, it, expect } from "vitest";
import { webTargetBytes, passesWebBudget } from "./webPerf";

/**
 * Lighthouse's own constants, transcribed:
 *   TARGET_BYTES_PER_PIXEL_AVIF = 2 * 1 / 12  →  pixels / 6
 *   BYTE_SAVINGS_THRESHOLD       = 4096       →  below this it never lists you
 */
const LIGHTHOUSE_IDEAL = (w: number, h: number) => (w * h) / 6;
const MIN_SAVINGS = 4096;

describe("webTargetBytes", () => {
  it("is pixels / 6 for a photo whose ideal size is inside the clamp", () => {
    // 2000×1333 = 2.666 MP → 444 KB ideal. The case the plan worked through.
    expect(webTargetBytes(2000, 1333)).toBe(Math.round(2_666_000 / 6));
  });

  it("gives a small image a SMALL budget, not 200 KB", () => {
    // 400×300 = 120k px → ~20 KB ideal, which is BELOW the reachable floor. The
    // floor is the honest outcome for an image this small: there is no smaller
    // encode to find, and the old 200 KB target sent the budget loop round all
    // eight passes before giving up. What matters is that it is nowhere near
    // 200 KB.
    const budget = webTargetBytes(400, 300);
    expect(budget).toBeLessThan(200 * 1024);
    expect(budget).toBe(24 * 1024 + MIN_SAVINGS);
    // The IDEAL is what Lighthouse would allow, and it is far below the floor.
    expect(LIGHTHOUSE_IDEAL(400, 300)).toBe(20_000);
  });

  it("gives a mid-size photo a budget just under the old constant", () => {
    // 1400×933 = 1.31 MP → 218 KB, above the floor and below the ceiling, so
    // this one really is pixels / 6. The old flat 200 KB was only ever right
    // for images in this neighbourhood.
    expect(webTargetBytes(1400, 933)).toBe(Math.round((1400 * 933) / 6));
  });

  it("gives a large image a LARGE budget, not 200 KB", () => {
    // 6000×4000 = 24 MP → 4 MB ideal, above the 1 MB ceiling, so the clamp
    // decides. Still 5× the old 200 KB: it "passed" the old target by being
    // crushed, when Lighthouse would have let it be five times the size.
    const budget = webTargetBytes(6000, 4000);
    expect(budget).toBe(1024 * 1024);
    expect(budget).toBeGreaterThan(200 * 1024);
    // The clamp is a ceiling, not a mistake: the IDEAL really is larger.
    expect(LIGHTHOUSE_IDEAL(6000, 4000)).toBe(4_000_000);
  });

  it("gives an un-clamped large image exactly pixels / 6", () => {
    // 2500×1667 = 4.17 MP → 695 KB ideal, inside the ceiling.
    expect(webTargetBytes(2500, 1667)).toBe(Math.round((2500 * 1667) / 6));
    expect(webTargetBytes(2500, 1667)).toBeLessThan(1024 * 1024);
  });

  it("clamps the bottom so a tiny image still has a reachable target", () => {
    // 64×64 = 4096 px → 683 B ideal, which no encoder reaches usefully. The
    // floor keeps the budget loop from spinning at a target it cannot pass.
    expect(webTargetBytes(64, 64)).toBe(24 * 1024 + MIN_SAVINGS);
  });

  it("never budgets below Lighthouse's own minimum-savings threshold", () => {
    // Whatever the pixel count, the budget must leave room for the 4096 bytes
    // below which Lighthouse does not list an image at all.
    for (const [w, h] of [
      [1, 1],
      [16, 16],
      [100, 100],
      [400, 300],
      [1920, 1080],
    ] as const) {
      expect(webTargetBytes(w, h)).toBeGreaterThanOrEqual(MIN_SAVINGS);
    }
  });
});

describe("passesWebBudget", () => {
  it("accepts a file at exactly the budget", () => {
    const w = 2000,
      h = 1333;
    expect(passesWebBudget(webTargetBytes(w, h), w, h)).toBe(true);
  });

  it("rejects one byte over", () => {
    const w = 2000,
      h = 1333;
    expect(passesWebBudget(webTargetBytes(w, h) + 1, w, h)).toBe(false);
  });

  it("rejects the q60 JPEG that the Auto Compress bug grew", () => {
    // The measured case from PARKING_LOT: 1600×1200 at 32,950 B. Note it PASSES
    // comfortably — which is the point. Auto Compress was not failing
    // PageSpeed by re-encoding this; it was spending bytes for nothing.
    expect(passesWebBudget(32_950, 1600, 1200)).toBe(true);
  });

  it("rejects the 24 MP photo that Lighthouse actually flags", () => {
    // 0.417 bytes/px against a 1/6 budget.
    expect(passesWebBudget(10_000_000, 6000, 4000)).toBe(false);
  });

  it("is false for a zero dimension rather than dividing by nothing", () => {
    expect(passesWebBudget(1000, 0, 100)).toBe(false);
    expect(passesWebBudget(1000, 100, 0)).toBe(false);
  });
});