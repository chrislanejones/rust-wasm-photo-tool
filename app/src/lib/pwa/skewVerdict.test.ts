import { describe, expect, it } from "vitest";
import { evaluateBuildSkew } from "./skewVerdict";

// The skew guard's decision table (Night B brief, Task B). The dangerous
// misfire is a FALSE POSITIVE: an "Update available" banner on an offline
// boot (manifest unreachable) or a misbuilt bundle (empty hash) would train
// users to ignore the banner — so every degenerate input must be "unknown".

describe("evaluateBuildSkew", () => {
  it("matching hashes → match", () => {
    expect(evaluateBuildSkew("mdb3x1-a1b2c3", "mdb3x1-a1b2c3")).toBe("match");
  });

  it("differing hashes → skew (stale cache serving an old build)", () => {
    expect(evaluateBuildSkew("mdb3x1-a1b2c3", "mdb9z9-d4e5f6")).toBe("skew");
  });

  it("hash comparison is exact — a prefix is still skew", () => {
    expect(evaluateBuildSkew("mdb3x1", "mdb3x1-a1b2c3")).toBe("skew");
  });

  it("missing manifest hash (offline / fetch failed) → unknown, not skew", () => {
    expect(evaluateBuildSkew("mdb3x1-a1b2c3", null)).toBe("unknown");
    expect(evaluateBuildSkew("mdb3x1-a1b2c3", undefined)).toBe("unknown");
    expect(evaluateBuildSkew("mdb3x1-a1b2c3", "")).toBe("unknown");
  });

  it("missing embedded hash (misconfigured build) → unknown, not skew", () => {
    expect(evaluateBuildSkew(null, "mdb3x1-a1b2c3")).toBe("unknown");
    expect(evaluateBuildSkew(undefined, "mdb3x1-a1b2c3")).toBe("unknown");
    expect(evaluateBuildSkew("", "mdb3x1-a1b2c3")).toBe("unknown");
  });

  it("both missing → unknown", () => {
    expect(evaluateBuildSkew("", "")).toBe("unknown");
    expect(evaluateBuildSkew(null, undefined)).toBe("unknown");
  });

  it("whitespace-only hashes are treated as missing → unknown", () => {
    expect(evaluateBuildSkew("  ", "mdb3x1")).toBe("unknown");
    expect(evaluateBuildSkew("mdb3x1", "\n\t")).toBe("unknown");
  });

  it("surrounding whitespace does not defeat a genuine match", () => {
    expect(evaluateBuildSkew(" mdb3x1-a1b2c3 ", "mdb3x1-a1b2c3")).toBe("match");
  });
});
