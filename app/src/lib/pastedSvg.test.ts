import { describe, expect, it } from "vitest";
import { buildPastedSvg, otherSide, readPastedSvg } from "./pastedSvg";
import { findRootSvgTag } from "./svgPassthrough";

const ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16v16H4z"/></svg>';

function ok(text: string) {
  const r = readPastedSvg(text);
  if (r.kind !== "ok") throw new Error(`expected ok, got ${r.kind}`);
  return r;
}

describe("readPastedSvg", () => {
  it("empty and whitespace are empty, not an error", () => {
    expect(readPastedSvg("").kind).toBe("empty");
    expect(readPastedSvg("  \n ").kind).toBe("empty");
  });

  it("text that is not SVG says so", () => {
    const r = readPastedSvg("hello <b>world</b>");
    expect(r.kind).toBe("invalid");
  });

  it("an <svg/> with nothing inside is refused", () => {
    expect(readPastedSvg('<svg viewBox="0 0 10 10"/>').kind).toBe("invalid");
  });

  it("a 24px icon starts at 1024 on its long side, like a dropped one", () => {
    const r = ok(ICON);
    expect(r.frame).toEqual({ x: 0, y: 0, w: 24, h: 24 });
    expect(r.suggested).toEqual({ w: 1024, h: 1024 });
  });

  it("a mid-size drawing keeps its own size; a huge one comes down to 4096", () => {
    expect(ok('<svg width="1600" height="900"><rect/></svg>').suggested).toEqual({ w: 1600, h: 900 });
    expect(ok('<svg viewBox="0 0 8000 4000"><rect/></svg>').suggested).toEqual({ w: 4096, h: 2048 });
  });

  it("an XML prolog and comments before the root are fine", () => {
    const r = ok(`<?xml version="1.0"?>\n<!-- from a tool -->\n${ICON}`);
    expect(r.aspect).toBe(1);
  });

  it("no viewBox and no size starts square", () => {
    const r = ok("<svg><circle r='5'/></svg>");
    expect(r.frame).toBeNull();
    expect(r.suggested).toEqual({ w: 1024, h: 1024 });
  });
});

describe("otherSide keeps the drawing's shape", () => {
  it("width → height and height → width", () => {
    expect(otherSide(16 / 9, 1920, "w")).toBe(1080);
    expect(otherSide(16 / 9, 1080, "h")).toBe(1920);
  });
  it("never 0 and never past the cap", () => {
    expect(otherSide(1000, 1, "w")).toBe(1);
    expect(otherSide(0.001, 100, "w")).toBe(8192);
  });
});

describe("buildPastedSvg", () => {
  it("sizes the root tag and adds the namespace an <img> needs", () => {
    const out = buildPastedSvg(ok(ICON), 512, 512, null);
    const root = findRootSvgTag(out)!;
    expect(root.attrs.get("width")).toBe("512");
    expect(root.attrs.get("height")).toBe("512");
    expect(root.attrs.get("xmlns")).toBe("http://www.w3.org/2000/svg");
    // stroke-width is not mistaken for width.
    expect(root.attrs.get("stroke-width")).toBe("2");
    // Everything after the root tag is the paste, byte for byte.
    expect(out.slice(root.end)).toBe(ICON.slice(findRootSvgTag(ICON)!.end));
  });

  it("keeps an existing xmlns and adds xlink only when used", () => {
    const withNs = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 4"><use xlink:href="#a"/></svg>';
    const out = buildPastedSvg(ok(withNs), 100, 100, null);
    expect(out.match(/xmlns="/g)).toHaveLength(1);
    expect(findRootSvgTag(out)!.attrs.get("xmlns:xlink")).toBe("http://www.w3.org/1999/xlink");
    expect(findRootSvgTag(buildPastedSvg(ok(ICON), 10, 10, null))!.attrs.has("xmlns:xlink")).toBe(false);
  });

  it("a size-only SVG gains the viewBox its size implied, so it scales", () => {
    const out = buildPastedSvg(ok('<svg width="200" height="100"><rect/></svg>'), 400, 200, null);
    expect(findRootSvgTag(out)!.attrs.get("viewBox")).toBe("0 0 200 100");
    expect(findRootSvgTag(out)!.attrs.get("width")).toBe("400");
  });

  it("a background is one rect under the drawing, covering its frame", () => {
    const out = buildPastedSvg(ok('<svg viewBox="-2 -2 28 14"><path d="M0 0"/></svg>'), 280, 140, { r: 255, g: 0, b: 16 });
    const root = findRootSvgTag(out)!;
    expect(out.slice(root.end)).toBe('<rect x="-2" y="-2" width="28" height="14" fill="#ff0010"/><path d="M0 0"/></svg>');
  });

  it("transparent adds nothing", () => {
    expect(buildPastedSvg(ok(ICON), 24, 24, null)).not.toContain("<rect");
  });
});
