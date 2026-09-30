import { describe, it, expect } from "vitest";
import {
  findRootSvgTag,
  prepareSvgSource,
  rebaseOnOriginalCrop,
  recordCrop,
  resolveDocFrame,
  writeCroppedSvg,
  type SvgSource,
} from "./svgPassthrough";

const ICON = `<?xml version="1.0"?>
<!-- a comment with <svg> in it -->
<!DOCTYPE svg [ <!ENTITY x "y"> ]>
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100" viewBox="0 0 20 10" data-note="a>b"><rect width="20" height="10"/></svg>`;

function src(text = ICON, w = 2000, h = 1000): SvgSource {
  const s = prepareSvgSource(text, w, h);
  if (!s) throw new Error("expected an SVG source");
  return s;
}

describe("findRootSvgTag", () => {
  it("skips the prolog and reads quoted attributes containing >", () => {
    const root = findRootSvgTag(ICON)!;
    expect(root.attrs.get("viewBox")).toBe("0 0 20 10");
    expect(root.attrs.get("data-note")).toBe("a>b");
    expect(ICON.slice(root.end)).toMatch(/^<rect/);
  });

  it("refuses a document whose root is not an svg", () => {
    expect(findRootSvgTag("<html><svg/></html>")).toBeNull();
  });
});

describe("prepareSvgSource", () => {
  it("derives a viewBox from a unitless size", () => {
    const s = prepareSvgSource('<svg width="40" height="20"></svg>', 400, 200)!;
    expect(s.imageFrame).toEqual({ x: 0, y: 0, w: 40, h: 20 });
  });

  it("has nothing to map onto without a viewBox or an absolute size", () => {
    expect(prepareSvgSource('<svg width="100%"></svg>', 100, 100)).toBeNull();
  });

  it("accounts for letterboxing when the viewport and viewBox disagree", () => {
    // Square viewBox drawn into a 2:1 viewport: meet, centered → the raster
    // covers twice the viewBox's width, centered on it.
    const s = prepareSvgSource('<svg viewBox="0 0 10 10"></svg>', 200, 100)!;
    expect(s.imageFrame).toEqual({ x: -5, y: 0, w: 20, h: 10 });
  });
});

describe("crop frames", () => {
  it("passes an uncropped SVG through byte-for-byte", () => {
    const s = src();
    const f = resolveDocFrame(s, 0, 2000, 1000)!;
    expect(writeCroppedSvg(s, f)).toBe(ICON);
  });

  it("crops the viewBox and scales width/height with it", () => {
    let s = src();
    s = recordCrop(
      s,
      { undoCount: 0, w: 2000, h: 1000 },
      { x: 1000, y: 0, w: 1000, h: 500 },
      { undoCount: 1, w: 1000, h: 500 },
    );
    const out = writeCroppedSvg(s, resolveDocFrame(s, 1, 1000, 500)!)!;
    expect(out).toContain('viewBox="10 0 10 5"');
    expect(out).toContain('width="100"');
    expect(out).toContain('height="50"');
    // Only the root tag changed.
    expect(out).toContain('data-note="a>b"><rect width="20" height="10"/></svg>');
    expect(out.startsWith('<?xml version="1.0"?>')).toBe(true);
  });

  it("stacks crops and survives a uniform resize between them", () => {
    let s = src();
    s = recordCrop(s, { undoCount: 0, w: 2000, h: 1000 }, { x: 0, y: 0, w: 1000, h: 1000 }, { undoCount: 1, w: 1000, h: 1000 });
    // Resized 1000² → 500² (undo 2), then cropped to the bottom-right quarter.
    s = recordCrop(s, { undoCount: 2, w: 500, h: 500 }, { x: 250, y: 250, w: 250, h: 250 }, { undoCount: 3, w: 250, h: 250 });
    expect(resolveDocFrame(s, 3, 250, 250)).toEqual({ x: 5, y: 5, w: 5, h: 5 });
    // Undo back past the second crop: the first one's frame again.
    expect(resolveDocFrame(s, 2, 500, 500)).toEqual({ x: 0, y: 0, w: 10, h: 10 });
  });

  it("ignores a crop that was undone and replaced by another edit", () => {
    let s = src();
    s = recordCrop(s, { undoCount: 0, w: 2000, h: 1000 }, { x: 0, y: 0, w: 500, h: 500 }, { undoCount: 1, w: 500, h: 500 });
    // Undo, then a brush stroke lands at the same depth: size is the original.
    expect(resolveDocFrame(s, 1, 2000, 1000)).toEqual(s.imageFrame);
  });

  it("drops the redo branch a new crop replaces", () => {
    let s = src();
    s = recordCrop(s, { undoCount: 0, w: 2000, h: 1000 }, { x: 0, y: 0, w: 500, h: 500 }, { undoCount: 1, w: 500, h: 500 });
    s = recordCrop(s, { undoCount: 0, w: 2000, h: 1000 }, { x: 1500, y: 500, w: 500, h: 500 }, { undoCount: 1, w: 500, h: 500 });
    expect(s.crops).toHaveLength(1);
    expect(resolveDocFrame(s, 1, 500, 500)).toEqual({ x: 15, y: 5, w: 5, h: 5 });
  });

  it("maps through the import artboard's padding and keeps only the photo", () => {
    let s = src();
    // 10px artboard border on every side → a 2020×1020 document.
    expect(resolveDocFrame(s, 0, 2020, 1020)).toEqual({ x: -0.1, y: -0.1, w: 20.2, h: 10.2 });
    // A crop that takes the top-left photo quarter plus the padding beside it.
    s = recordCrop(s, { undoCount: 0, w: 2020, h: 1020 }, { x: 0, y: 0, w: 1010, h: 510 }, { undoCount: 1, w: 1010, h: 510 });
    const out = writeCroppedSvg(s, resolveDocFrame(s, 1, 1010, 510)!)!;
    expect(out).toContain('viewBox="0 0 10 5"');
  });

  it("refuses a document that is no longer a crop of the SVG", () => {
    // Rotated 90°: 1000×2000 matches nothing.
    expect(resolveDocFrame(src(), 1, 1000, 2000)).toBeNull();
  });

  it("rebases on a batch crop of the stored original", () => {
    let s = src();
    s = rebaseOnOriginalCrop(s, { x: 500, y: 0, w: 1000, h: 1000 }, 1080, 1080);
    expect(resolveDocFrame(s, 0, 1080, 1080)).toEqual({ x: 5, y: 0, w: 10, h: 10 });
    // A second batch crop re-frames the ORIGINAL, not the first crop.
    s = rebaseOnOriginalCrop(s, { x: 0, y: 0, w: 1000, h: 1000 }, 1080, 1080);
    expect(resolveDocFrame(s, 0, 1080, 1080)).toEqual({ x: 0, y: 0, w: 10, h: 10 });
  });

  it("adds a viewBox to an SVG that only had a size", () => {
    let s = prepareSvgSource('<svg width="40px" height="20px"><g/></svg>', 400, 200)!;
    s = recordCrop(s, { undoCount: 0, w: 400, h: 200 }, { x: 0, y: 0, w: 200, h: 200 }, { undoCount: 1, w: 200, h: 200 });
    const out = writeCroppedSvg(s, resolveDocFrame(s, 1, 200, 200)!)!;
    expect(out).toBe('<svg viewBox="0 0 20 20" width="20px" height="20px"><g/></svg>');
  });
});
