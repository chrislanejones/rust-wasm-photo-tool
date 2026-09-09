// The consent sentence is the part of this feature that has to be right the
// first time, so it is the part with tests. Everything else here is arithmetic.

import { describe, it, expect } from "vitest";
import {
  ASPECT_RATIOS,
  ATTACHMENT_LONGEST_EDGE,
  MAX_ATTACHMENTS,
  consentSentence,
  downscaledSize,
  rejectReason,
} from "./aiImageDraft";

const file = (name: string, type: string, size: number) =>
  ({ name, type, size }) as File;

describe("consentSentence", () => {
  it("says photos stay in the tab when nothing is attached", () => {
    const s = consentSentence(0);
    expect(s).toMatch(/prompt is sent/i);
    expect(s).toMatch(/stay in this tab/i);
    // It must NOT hedge about images that are not there — a sentence that
    // mentions attachments when there are none trains people to skim it.
    expect(s).not.toMatch(/attach/i);
  });

  it("names the count and the resize once images are attached", () => {
    const s = consentSentence(2);
    expect(s).toContain("2 images");
    expect(s).toContain(String(ATTACHMENT_LONGEST_EDGE));
    expect(s).toMatch(/nothing else leaves this tab/i);
  });

  it("uses the singular for one", () => {
    expect(consentSentence(1)).toContain("1 image");
    expect(consentSentence(1)).not.toContain("1 images");
  });

  it("never claims more privacy than it can — always says what IS sent", () => {
    for (const n of [0, 1, 2, 3]) {
      expect(consentSentence(n)).toMatch(/sent/i);
    }
  });
});

describe("rejectReason", () => {
  it("accepts a normal image", () => {
    expect(rejectReason(file("a.png", "image/png", 1000), 0)).toBeNull();
  });

  it("refuses past the attachment cap", () => {
    expect(rejectReason(file("a.png", "image/png", 10), MAX_ATTACHMENTS)).toMatch(
      /Up to 3/,
    );
  });

  it("refuses a non-image", () => {
    expect(rejectReason(file("a.pdf", "application/pdf", 10), 0)).toMatch(/not an image/);
  });

  it("refuses an oversized file and says the limit", () => {
    const r = rejectReason(file("big.png", "image/png", 9 * 1024 * 1024), 0);
    expect(r).toMatch(/larger than 8 MB/);
  });
});

describe("downscaledSize", () => {
  it("shrinks the longest edge to the target", () => {
    expect(downscaledSize(4000, 2000)).toEqual({ width: 1024, height: 512 });
    expect(downscaledSize(2000, 4000)).toEqual({ width: 512, height: 1024 });
  });

  it("NEVER upscales — a small reference stays small", () => {
    expect(downscaledSize(300, 200)).toEqual({ width: 300, height: 200 });
  });

  it("keeps at least one pixel on a extreme ratio", () => {
    const r = downscaledSize(10000, 3);
    expect(r.width).toBe(1024);
    expect(r.height).toBeGreaterThanOrEqual(1);
  });

  it("does not divide by zero on a degenerate image", () => {
    expect(() => downscaledSize(0, 0)).not.toThrow();
  });
});

describe("ASPECT_RATIOS", () => {
  it("is provisional but well-formed — every entry has real numbers", () => {
    expect(ASPECT_RATIOS.length).toBeGreaterThan(0);
    for (const r of ASPECT_RATIOS) {
      expect(r.w).toBeGreaterThan(0);
      expect(r.h).toBeGreaterThan(0);
      expect(r.label).toBeTruthy();
    }
  });
});
