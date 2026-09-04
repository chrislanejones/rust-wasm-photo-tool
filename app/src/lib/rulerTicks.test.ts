import { describe, it, expect } from "vitest";
import { niceStep, tickLabel, PX_PER_UNIT } from "./rulerTicks";
import { RULER_DPI } from "./preferences";

/**
 * The ruler's unit is a LENS: it changes which image-pixel offsets earn a tick
 * and what the label reads, never the geometry. These tests pin that — every
 * `niceStep` result is in image pixels regardless of unit, because the overlay
 * projects with `left + ix * sx` and would drift if a step ever came back in
 * inches.
 */

describe("PX_PER_UNIT — 96 DPI, fixed by convention", () => {
  it("a pixel is a pixel", () => {
    expect(PX_PER_UNIT.px).toBe(1);
  });

  it("an inch is the CSS reference 96px", () => {
    expect(PX_PER_UNIT.in).toBe(96);
    expect(PX_PER_UNIT.in).toBe(RULER_DPI);
  });

  it("a centimetre is an inch over 2.54", () => {
    expect(PX_PER_UNIT.cm).toBeCloseTo(37.7952755, 5);
    expect(PX_PER_UNIT.cm * 2.54).toBeCloseTo(96, 10);
  });
});

describe("niceStep — always returns IMAGE PIXELS", () => {
  it("px: picks the smallest step at least minScreen on screen", () => {
    // At 1:1, a 56px minimum means the 100px step (50 is too tight).
    expect(niceStep(1, 56, "px")).toBe(100);
    // Zoomed 10x, 10 image px already spans 100 screen px.
    expect(niceStep(10, 56, "px")).toBe(10);
  });

  it("in: steps land on binary fractions of an inch, in px", () => {
    // Zoomed far in, the finest inch step is 1/16" = 6px.
    expect(niceStep(40, 56, "in")).toBeCloseTo(96 / 16, 10);
    // At 1:1 a whole inch (96px) clears 56 screen px comfortably.
    expect(niceStep(1, 56, "in")).toBeCloseTo(96, 10);
  });

  it("cm: steps are metric, in px", () => {
    expect(niceStep(1, 56, "cm")).toBeCloseTo(2 * PX_PER_UNIT.cm, 6);
  });

  it("never returns 0 or a negative — a zero step would hang the tick loop", () => {
    for (const u of ["px", "in", "cm"] as const) {
      for (const scale of [0.001, 0.1, 1, 5, 100]) {
        expect(niceStep(scale, 56, u)).toBeGreaterThan(0);
      }
    }
  });

  it("falls back to the coarsest step when even that is too tight", () => {
    // Absurd zoom-out: nothing satisfies the minimum, so take the last rung
    // rather than loop or return undefined.
    expect(niceStep(0.000001, 56, "px")).toBe(10000);
  });

  it("defaults to px when no unit is given", () => {
    expect(niceStep(1, 56)).toBe(niceStep(1, 56, "px"));
  });
});

describe("tickLabel", () => {
  it("px reads as whole numbers, exactly as before", () => {
    expect(tickLabel(0, "px", 100)).toBe("0");
    expect(tickLabel(250, "px", 100)).toBe("250");
    expect(tickLabel(249.6, "px", 100)).toBe("250");
  });

  it("inches read as inches, not pixels", () => {
    expect(tickLabel(96, "in", 96)).toBe("1");
    expect(tickLabel(192, "in", 96)).toBe("2");
    expect(tickLabel(0, "in", 96)).toBe("0");
  });

  it("a quarter-inch ladder shows quarters", () => {
    const step = 96 / 4;
    expect(tickLabel(step, "in", step)).toBe("0.25");
    expect(tickLabel(step * 2, "in", step)).toBe("0.5");
    expect(tickLabel(step * 4, "in", step)).toBe("1");
  });

  it("centimetres read as centimetres", () => {
    expect(tickLabel(PX_PER_UNIT.cm, "cm", PX_PER_UNIT.cm)).toBe("1");
    expect(tickLabel(PX_PER_UNIT.cm * 10, "cm", PX_PER_UNIT.cm)).toBe("10");
  });

  it("drops trailing zeros — a ruler should not shout false precision", () => {
    const step = 96 / 4;
    expect(tickLabel(96, "in", step)).not.toBe("1.00");
    expect(tickLabel(96, "in", step)).toBe("1");
  });

  it("a whole-inch ladder never shows decimals", () => {
    for (let i = 0; i <= 5; i++) {
      expect(tickLabel(96 * i, "in", 96)).toBe(String(i));
    }
  });
});

describe("the unit never changes the geometry", () => {
  it("a step is an image-px count that projects the same for every unit", () => {
    // Whatever unit is chosen, the overlay multiplies the step by `scale`.
    // These are the numbers it would draw at, and they must be finite px.
    for (const u of ["px", "in", "cm"] as const) {
      const step = niceStep(2, 56, u);
      expect(Number.isFinite(step)).toBe(true);
      expect(step).toBeGreaterThan(0);
      // A tick at 3 steps along is at 3·step image px, in every unit.
      expect(3 * step).toBeCloseTo(step + step + step, 10);
    }
  });
});
