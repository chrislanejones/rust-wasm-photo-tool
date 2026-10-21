import { describe, it, expect } from "vitest";
import { nextAfterDrop, nextPinNumber, parsePinLabel, pinSequence } from "./pinSteps";
import { pinLabelText } from "./pinLabel";

const pin = (number: number) => ({ kind: 5, number });

describe("pinSequence", () => {
  it("reads the active layer's pins and ignores other shapes", () => {
    expect(pinSequence([pin(1), { kind: 0, number: 0 }, pin(2), pin(3)])).toEqual({ max: 3, gaps: false });
    expect(pinSequence([])).toEqual({ max: 0, gaps: false });
  });

  it("a hole, a repeat or a sequence not starting at 1 is a gap", () => {
    expect(pinSequence([pin(1), pin(3), pin(4)]).gaps).toBe(true);
    expect(pinSequence([pin(1), pin(2), pin(2)]).gaps).toBe(true);
    expect(pinSequence([pin(2), pin(3)]).gaps).toBe(true);
    expect(pinSequence([pin(3), pin(1), pin(2)]).gaps).toBe(false); // drawn out of order is fine
  });
});

describe("nextPinNumber", () => {
  it("defaults to after the last pin", () => {
    expect(nextPinNumber(4, null)).toBe(5);
    expect(nextPinNumber(0, null)).toBe(1);
  });

  it("a requested number inserts, kept inside 1…max + 1", () => {
    expect(nextPinNumber(4, 3)).toBe(3);
    expect(nextPinNumber(4, 9)).toBe(5);
    expect(nextPinNumber(4, 0)).toBe(1);
  });
});

describe("nextAfterDrop", () => {
  it("an insert keeps inserting after itself, then falls back to the default", () => {
    expect(nextAfterDrop(3, 5, 3)).toBe(4);
    expect(nextAfterDrop(5, 5, 5)).toBeNull();
    expect(nextAfterDrop(5, 5, null)).toBeNull();
  });
});

describe("parsePinLabel", () => {
  it("reads digits and letters, the inverse of pinLabelText", () => {
    expect(parsePinLabel("3")).toBe(3);
    expect(parsePinLabel(" c ")).toBe(3);
    for (const n of [1, 26, 27, 52, 703]) expect(parsePinLabel(pinLabelText(n, 1))).toBe(n);
  });

  it("refuses what is neither", () => {
    expect(parsePinLabel("")).toBeNull();
    expect(parsePinLabel("0")).toBeNull();
    expect(parsePinLabel("3b")).toBeNull();
    expect(parsePinLabel("-2")).toBeNull();
  });
});
