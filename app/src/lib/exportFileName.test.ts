import { describe, it, expect } from "vitest";
import { defaultExportStem, sanitizeExportStem } from "./exportFileName";

describe("defaultExportStem", () => {
  it("appends -revised to the gallery name without its extension", () => {
    expect(defaultExportStem("beach.jpg")).toBe("beach-revised");
    expect(defaultExportStem("beach")).toBe("beach-revised");
  });

  it("falls back to image when there is no name", () => {
    expect(defaultExportStem(undefined)).toBe("image-revised");
    expect(defaultExportStem("")).toBe("image-revised");
  });
});

describe("sanitizeExportStem", () => {
  it.each([
    ["bobbob", "bobbob"],
    ["  bobbob  ", "bobbob"],
    ["bobbob.jpeg", "bobbob"],
    ["bobbob.PNG", "bobbob"],
    ["holiday.v2", "holiday.v2"],
    ["a/b\\c:d*e?f\"g<h>i|j", "abcdefghij"],
    ["..hidden", "hidden"],
    ["trailing. ", "trailing"],
  ])("%j → %j", (input, want) => {
    expect(sanitizeExportStem(input)).toBe(want);
  });

  it.each(["", "   ", ".jpg", "///", "..."])("returns null for unusable %j", (input) => {
    expect(sanitizeExportStem(input)).toBeNull();
  });

  it("caps very long names", () => {
    expect(sanitizeExportStem("x".repeat(500))).toHaveLength(200);
  });
});
