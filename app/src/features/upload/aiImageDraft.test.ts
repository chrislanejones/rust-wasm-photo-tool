// The consent sentence is the part of this feature that has to be right the
// first time, so it is the part with tests. Everything else here is arithmetic.

import { describe, it, expect } from "vitest";
import {
  ASPECT_RATIOS,
  ATTACHMENT_LONGEST_EDGE,
  DEFAULT_IMAGE_MODEL_ID,
  IMAGE_MODELS,
  MAX_ATTACHMENTS,
  attachmentsSent,
  consentSentence,
  downscaledSize,
  modelById,
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

describe("IMAGE_MODELS", () => {
  it("offers a real choice, every entry well-formed", () => {
    expect(IMAGE_MODELS.length).toBeGreaterThan(1);
    for (const m of IMAGE_MODELS) {
      // A Replicate slug is `owner/name` — the stable half of a reference.
      // A bare name or a pinned `...:hash` here is the bug this catches.
      expect(m.id).toMatch(/^[^/:\s]+\/[^/:\s]+$/);
      expect(m.label).toBeTruthy();
      expect(m.blurb).toBeTruthy();
      expect(typeof m.supportsReferences).toBe("boolean");
    }
  });

  it("never ships a version hash — the server pins those", () => {
    for (const m of IMAGE_MODELS) expect(m.id).not.toContain(":");
  });

  it("has no duplicate ids or labels", () => {
    expect(new Set(IMAGE_MODELS.map((m) => m.id)).size).toBe(IMAGE_MODELS.length);
    expect(new Set(IMAGE_MODELS.map((m) => m.label)).size).toBe(IMAGE_MODELS.length);
  });

  it("defaults to a model that is actually in the list", () => {
    expect(IMAGE_MODELS.some((m) => m.id === DEFAULT_IMAGE_MODEL_ID)).toBe(true);
  });

  it("keeps at least one model that can read a reference image", () => {
    // The dialog offers attachments at all only because one of these can use
    // them. If this ever goes to zero, the whole reference-image section is
    // dead UI and should go with it.
    expect(IMAGE_MODELS.some((m) => m.supportsReferences)).toBe(true);
  });
});

describe("modelById", () => {
  it("finds a listed model", () => {
    expect(modelById(IMAGE_MODELS[2].id).label).toBe(IMAGE_MODELS[2].label);
  });

  it("falls back rather than throwing on a stale id", () => {
    // A persisted preference that names a model since removed must reopen the
    // dialog, not break it.
    expect(modelById("someone/deleted-this").id).toBe(DEFAULT_IMAGE_MODEL_ID);
  });
});

describe("attachmentsSent", () => {
  const withRefs = IMAGE_MODELS.find((m) => m.supportsReferences)!;
  const withoutRefs = IMAGE_MODELS.find((m) => !m.supportsReferences)!;

  it("counts attachments for a model that reads them", () => {
    expect(attachmentsSent(withRefs.id, 2)).toBe(2);
  });

  it("counts ZERO for a model that ignores them, however many are attached", () => {
    expect(attachmentsSent(withoutRefs.id, 3)).toBe(0);
  });

  it("makes the consent sentence stop claiming a send that will not happen", () => {
    // The whole point of the indirection: three files attached, a model that
    // cannot read them, and the sentence must not say three images are sent.
    const s = consentSentence(attachmentsSent(withoutRefs.id, 3));
    expect(s).not.toMatch(/attach/i);
    expect(s).toMatch(/stay in this tab/i);
  });

  it("still names them for a model that can", () => {
    const s = consentSentence(attachmentsSent(withRefs.id, 3));
    expect(s).toContain("3 images");
  });
});
