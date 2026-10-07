import { describe, it, expect } from "vitest";
import { documentSizeForPhoto, mappedExtent, keptOriginalMessage } from "./resizeTarget";

describe("documentSizeForPhoto", () => {
  it("lands the photo on the typed size through a 10 px artboard border", () => {
    // The reported bug: 256×256 photo, 276 document, typed 128 → got 118.
    const photo = { x: 10, y: 10, width: 256, height: 256 };
    const d = documentSizeForPhoto({ w: 276, h: 276 }, photo, { w: 128, h: 128 });
    expect(mappedExtent(10, 256, 276, d.w)).toBe(128);
    expect(mappedExtent(10, 256, 276, d.h)).toBe(128);
  });

  it("is exact across a sweep of sizes, borders and aspect ratios", () => {
    for (const [pw, ph, pad] of [[4000, 3000, 10], [1620, 2048, 10], [1023, 767, 25], [300, 200, 0]] as const) {
      const doc = { w: pw + 2 * pad, h: ph + 2 * pad };
      const photo = { x: pad, y: pad, width: pw, height: ph };
      for (const want of [1, 2, 37, 128, 640, 1280, 1919, pw, pw * 2]) {
        const wh = Math.max(1, Math.round((want * ph) / pw));
        const d = documentSizeForPhoto(doc, photo, { w: want, h: wh });
        expect(mappedExtent(pad, pw, doc.w, d.w), `w ${pw}+${pad} → ${want}`).toBe(want);
        expect(mappedExtent(pad, ph, doc.h, d.h), `h ${ph}+${pad} → ${wh}`).toBe(wh);
      }
    }
  });

  it("passes the typed size straight through when there is no border", () => {
    expect(documentSizeForPhoto({ w: 800, h: 600 }, { x: 0, y: 0, width: 800, height: 600 }, { w: 400, h: 300 })).toEqual({ w: 400, h: 300 });
    expect(documentSizeForPhoto({ w: 800, h: 600 }, null, { w: 400, h: 300 })).toEqual({ w: 400, h: 300 });
  });
});

describe("keptOriginalMessage", () => {
  it("names both sizes", () => {
    expect(keptOriginalMessage(90 * 1024, 40 * 1024)).toBe("Not applied: the new file would be 90 KB, bigger than the 40 KB it is now.");
  });
});
