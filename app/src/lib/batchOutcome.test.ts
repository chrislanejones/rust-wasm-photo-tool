import { describe, it, expect } from "vitest";
import { batchOutcome } from "./batchOutcome";

describe("batchOutcome", () => {
  it("a full pass reads as done", () => {
    expect(batchOutcome("Logo applied to", 12, 12)).toEqual({ ok: true, text: "Logo applied to 12 images" });
    expect(batchOutcome("Text applied to", 1, 1).text).toBe("Text applied to 1 image");
  });
  it("a pass with failures says how many, and is not ok", () => {
    expect(batchOutcome("Logo applied to", 10, 12)).toEqual({
      ok: false,
      text: "Logo applied to 10 of 12 — 2 couldn't be processed",
    });
  });
});
