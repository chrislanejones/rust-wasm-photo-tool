import { describe, expect, it } from "vitest";
import { effectiveFormat, labelFormats } from "./useDownloadFormat";

/* The Download dialog must not offer one format and write another.
 *
 * It did: the button said "Download AVIF" on browsers that silently encode
 * PNG instead, because the Compress panel's support note never reached this
 * second picker. Both rules below are what keep the two honest.
 */
describe("effectiveFormat", () => {
  it("falls AVIF back to PNG when the browser cannot encode it", () => {
    expect(effectiveFormat("avif", false)).toBe("png");
  });

  it("leaves AVIF alone when it CAN be encoded", () => {
    expect(effectiveFormat("avif", true)).toBe("avif");
  });

  it("leaves AVIF alone while the probe is still unanswered", () => {
    // undefined is not false. Answering "png" early would relabel the button
    // on every browser for the first frame, including the ones that are fine.
    expect(effectiveFormat("avif", undefined)).toBe("avif");
  });

  it("never rewrites a format that was not AVIF", () => {
    for (const f of ["png", "jpeg", "webp"] as const) {
      expect(effectiveFormat(f, false)).toBe(f);
    }
  });
});

describe("labelFormats", () => {
  const hintFor = (avif: boolean | undefined) =>
    labelFormats(avif).find((o) => o.value === "avif")!.hint;

  it("warns on AVIF only when the browser cannot encode it", () => {
    expect(hintFor(false)).toBe("Not supported here · saves as PNG");
    expect(hintFor(true)).toBe("Smallest · modern");
    expect(hintFor(undefined)).toBe("Smallest · modern");
  });

  it("keeps ORA in the list — the dialog's one non-raster choice", () => {
    expect(labelFormats(true).map((o) => o.value)).toContain("ora");
  });

  it("touches no other row's hint", () => {
    const off = labelFormats(false);
    const on = labelFormats(true);
    for (const v of ["png", "jpeg", "webp", "ora"] as const) {
      expect(off.find((o) => o.value === v)).toEqual(on.find((o) => o.value === v));
    }
  });
});
