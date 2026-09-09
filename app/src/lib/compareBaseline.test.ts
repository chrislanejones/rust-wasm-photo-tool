import { describe, it, expect } from "vitest";
import { compareBaselineKey } from "./compareBaseline";

describe("compareBaselineKey", () => {
  it("prefers the immutable upload key", () => {
    expect(compareBaselineKey({ uploadKey: "u1", originalKey: "o1" })).toBe("u1");
  });

  it("falls back to originalKey for photos that predate uploadKey", () => {
    expect(compareBaselineKey({ originalKey: "o1" })).toBe("o1");
  });

  it("is null when the photo has neither", () => {
    expect(compareBaselineKey({})).toBeNull();
    expect(compareBaselineKey(null)).toBeNull();
    expect(compareBaselineKey(undefined)).toBeNull();
  });

  // THE ONE THAT MATTERS. Auto Compress repoints `originalKey` at the
  // compressed file and deletes the blob it replaced. If the baseline followed
  // `originalKey`, A/B compare after a compress would show the compressed image
  // against itself — which is exactly the "compare stopped working" report.
  it("does not move when Auto Compress repoints originalKey", () => {
    const before = { uploadKey: "upload-1", originalKey: "orig-1" };
    const afterAutoCompress = { ...before, originalKey: "orig-2-compressed" };
    expect(compareBaselineKey(afterAutoCompress)).toBe(compareBaselineKey(before));
    expect(compareBaselineKey(afterAutoCompress)).toBe("upload-1");
  });

  it("DOES move for a legacy photo with no uploadKey — stated, not hidden", () => {
    const before = { originalKey: "orig-1" };
    const afterAutoCompress = { originalKey: "orig-2-compressed" };
    expect(compareBaselineKey(afterAutoCompress)).not.toBe(compareBaselineKey(before));
  });
});
