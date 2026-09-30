// The readout's arithmetic. The point of the number is to make a miss look
// like a miss, so the small end is tested hardest: 0.02% must not round to 0.
import { describe, it, expect } from "vitest";
import { describeCoverage, formatArea, formatPercent, toCoverage } from "./selectionCoverage";

const MP24 = 6000 * 4000;

describe("toCoverage", () => {
  it("decodes the engine's [selected, total]", () => {
    expect(toCoverage(new Uint32Array([10, 100]))).toEqual({ selected: 10, total: 100 });
  });
  it("is null with nothing selected — the readout is absent, never 0%", () => {
    expect(toCoverage(new Uint32Array([0, 100]))).toBeNull();
  });
  it("is null for an empty document or a malformed answer", () => {
    expect(toCoverage(new Uint32Array([0, 0]))).toBeNull();
    expect(toCoverage(new Uint32Array([5]))).toBeNull();
    expect(toCoverage(null)).toBeNull();
    expect(toCoverage(undefined)).toBeNull();
  });
});

describe("formatPercent", () => {
  it("one decimal from 1% up", () => {
    expect(formatPercent({ selected: 184, total: 1000 })).toBe("18.4");
    expect(formatPercent({ selected: 1, total: 100 })).toBe("1.0");
  });
  it("two decimals under 1%, so a miss reads as a miss", () => {
    expect(formatPercent({ selected: 2, total: 10_000 })).toBe("0.02");
    expect(formatPercent({ selected: 55, total: 10_000 })).toBe("0.55");
  });
  it("'<0.01' for a selection that exists but rounds away", () => {
    expect(formatPercent({ selected: 1, total: MP24 })).toBe("<0.01");
  });
  it("100 only when everything is selected, never by rounding", () => {
    expect(formatPercent({ selected: 100, total: 100 })).toBe("100");
    expect(formatPercent({ selected: MP24 - 1, total: MP24 })).toBe("99.9");
  });
});

describe("formatArea", () => {
  it("megapixels from 0.1 MP", () => {
    expect(formatArea(2_100_000)).toBe("2.1 MP");
    expect(formatArea(100_000)).toBe("0.1 MP");
  });
  it("the pixel count below that", () => {
    expect(formatArea(99_999)).toBe("99,999 px");
    expect(formatArea(12)).toBe("12 px");
  });
});

describe("describeCoverage", () => {
  it("is the whole readout", () => {
    expect(describeCoverage({ selected: 2_100_000, total: 11_413_043 })).toBe(
      "Selected 18.4% · 2.1 MP",
    );
  });
});
