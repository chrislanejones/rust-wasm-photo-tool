import { describe, expect, it } from "vitest";
import {
  hexToRgba,
  hslToHsv,
  hslToRgb,
  hsvToHsl,
  hsvToRgb,
  parseHslString,
  formatHsl,
  formatRgba,
  rgbToHsl,
  rgbToHsv,
  rgbaToHex,
  wrapHue,
} from "./colorConvert";

const NAMED = [
  { name: "red",     rgb: { r: 255, g: 0,   b: 0   }, hsv: { h: 0,   s: 100, v: 100 }, hsl: { h: 0,   s: 100, l: 50 } },
  { name: "lime",    rgb: { r: 0,   g: 255, b: 0   }, hsv: { h: 120, s: 100, v: 100 }, hsl: { h: 120, s: 100, l: 50 } },
  { name: "blue",    rgb: { r: 0,   g: 0,   b: 255 }, hsv: { h: 240, s: 100, v: 100 }, hsl: { h: 240, s: 100, l: 50 } },
  { name: "white",   rgb: { r: 255, g: 255, b: 255 }, hsv: { h: 0,   s: 0,   v: 100 }, hsl: { h: 0,   s: 0,   l: 100 } },
  { name: "black",   rgb: { r: 0,   g: 0,   b: 0   }, hsv: { h: 0,   s: 0,   v: 0   }, hsl: { h: 0,   s: 0,   l: 0 } },
  { name: "grey",    rgb: { r: 128, g: 128, b: 128 }, hsv: { h: 0,   s: 0,   v: 50.2 }, hsl: { h: 0, s: 0, l: 50.2 } },
  { name: "AB1163",  rgb: { r: 171, g: 17,  b: 99  }, hsv: { h: 328.1, s: 90.1, v: 67.1 }, hsl: { h: 328.1, s: 81.9, l: 36.9 } },
];

const close = (a: number, b: number, eps = 0.15) => Math.abs(a - b) <= eps;

describe("rgb ↔ hsv", () => {
  for (const c of NAMED) {
    it(`${c.name} forward`, () => {
      const hsv = rgbToHsv(c.rgb);
      expect(close(hsv.h, c.hsv.h)).toBe(true);
      expect(close(hsv.s, c.hsv.s)).toBe(true);
      expect(close(hsv.v, c.hsv.v)).toBe(true);
    });
    it(`${c.name} round-trips`, () => {
      expect(hsvToRgb(rgbToHsv(c.rgb))).toEqual(c.rgb);
    });
  }
  it("every 8-bit grey round-trips exactly", () => {
    for (let n = 0; n <= 255; n++) {
      expect(hsvToRgb(rgbToHsv({ r: n, g: n, b: n }))).toEqual({ r: n, g: n, b: n });
    }
  });
});

describe("rgb ↔ hsl", () => {
  for (const c of NAMED) {
    it(`${c.name} forward`, () => {
      const hsl = rgbToHsl(c.rgb);
      expect(close(hsl.h, c.hsl.h)).toBe(true);
      expect(close(hsl.s, c.hsl.s)).toBe(true);
      expect(close(hsl.l, c.hsl.l)).toBe(true);
    });
    it(`${c.name} round-trips`, () => {
      expect(hslToRgb(rgbToHsl(c.rgb))).toEqual(c.rgb);
    });
  }
});

describe("hsv ↔ hsl (direct)", () => {
  it("agrees with the rgb route", () => {
    for (const c of NAMED) {
      const viaDirect = hsvToHsl(c.hsv);
      const viaRgb = rgbToHsl(hsvToRgb(c.hsv));
      expect(close(viaDirect.s, viaRgb.s, 0.6)).toBe(true);
      expect(close(viaDirect.l, viaRgb.l, 0.6)).toBe(true);
    }
  });
  it("keeps hue at zero saturation — the whole reason it exists", () => {
    // rgb(128,128,128) has no hue; going through rgb would reset a user-chosen
    // hue of 200 to 0 and snap the wheel marker. The direct path must not.
    expect(hsvToHsl({ h: 200, s: 0, v: 50 }).h).toBe(200);
    expect(hslToHsv({ h: 200, s: 0, l: 50 }).h).toBe(200);
  });
  it("round-trips", () => {
    for (const c of NAMED) {
      const back = hslToHsv(hsvToHsl(c.hsv));
      expect(close(back.s, c.hsv.s, 0.6)).toBe(true);
      expect(close(back.v, c.hsv.v, 0.6)).toBe(true);
    }
  });
});

describe("hex", () => {
  it("formats opaque as #rrggbb and translucent as #rrggbbaa", () => {
    expect(rgbaToHex({ r: 171, g: 17, b: 99 })).toBe("#ab1163");
    expect(rgbaToHex({ r: 171, g: 17, b: 99 }, 1)).toBe("#ab1163");
    expect(rgbaToHex({ r: 255, g: 90, b: 60 }, 0.5)).toBe("#ff5a3c80");
    expect(rgbaToHex({ r: 0, g: 0, b: 0 }, 0)).toBe("#00000000");
  });
  it("parses the four hex lengths, with or without #", () => {
    expect(hexToRgba("#ab1163")).toEqual({ rgb: { r: 171, g: 17, b: 99 }, a: 1 });
    expect(hexToRgba("ab1163")).toEqual({ rgb: { r: 171, g: 17, b: 99 }, a: 1 });
    expect(hexToRgba("#f00")).toEqual({ rgb: { r: 255, g: 0, b: 0 }, a: 1 });
    expect(hexToRgba("#f008")?.a).toBeCloseTo(0x88 / 255, 5);
    expect(hexToRgba("#ff5a3c80")?.a).toBeCloseTo(128 / 255, 5);
  });
  it("rejects junk", () => {
    expect(hexToRgba("")).toBeNull();
    expect(hexToRgba("#12345")).toBeNull();
    expect(hexToRgba("#gggggg")).toBeNull();
    expect(hexToRgba("rgb(1,2,3)")).toBeNull();
  });
});

describe("formatters", () => {
  it("rgba is always the 4-arg form", () => {
    expect(formatRgba({ r: 255, g: 90, b: 60 })).toBe("rgba(255, 90, 60, 1)");
    expect(formatRgba({ r: 255, g: 90, b: 60 }, 0.5)).toBe("rgba(255, 90, 60, 0.5)");
    expect(formatRgba({ r: 255, g: 90, b: 60 }, 1 / 3)).toBe("rgba(255, 90, 60, 0.33)");
  });
  it("hsl drops the alpha when opaque", () => {
    expect(formatHsl({ h: 328.1, s: 81.9, l: 36.9 })).toBe("hsl(328, 82%, 37%)");
    expect(formatHsl({ h: 0, s: 100, l: 50 }, 0.25)).toBe("hsla(0, 100%, 50%, 0.25)");
  });
});

describe("parseHslString", () => {
  it("accepts comma and space syntax, with and without units", () => {
    expect(parseHslString("hsl(328, 82%, 37%)")).toEqual({ hsl: { h: 328, s: 82, l: 37 }, a: 1 });
    expect(parseHslString("hsl(328 82 37)")).toEqual({ hsl: { h: 328, s: 82, l: 37 }, a: 1 });
    expect(parseHslString("HSL(328deg,82%,37%)")).toEqual({ hsl: { h: 328, s: 82, l: 37 }, a: 1 });
    expect(parseHslString("hsla(0, 100%, 50%, 0.25)")).toEqual({ hsl: { h: 0, s: 100, l: 50 }, a: 0.25 });
    expect(parseHslString("hsl(0 100% 50% / 50%)")).toEqual({ hsl: { h: 0, s: 100, l: 50 }, a: 0.5 });
  });
  it("wraps hue and clamps the rest", () => {
    expect(parseHslString("hsl(-30, 150%, -5%)")).toEqual({ hsl: { h: 330, s: 100, l: 0 }, a: 1 });
    expect(parseHslString("hsla(390, 50%, 50%, 7)")).toEqual({ hsl: { h: 30, s: 50, l: 50 }, a: 1 });
  });
  it("rejects anything that is not hsl", () => {
    expect(parseHslString("#ab1163")).toBeNull();
    expect(parseHslString("rgb(1, 2, 3)")).toBeNull();
    expect(parseHslString("hsl(1, 2)")).toBeNull();
    expect(parseHslString("hsl(a, b%, c%)")).toBeNull();
  });
});

describe("wrapHue", () => {
  it("normalises into [0, 360)", () => {
    expect(wrapHue(0)).toBe(0);
    expect(wrapHue(360)).toBe(0);
    expect(wrapHue(-30)).toBe(330);
    expect(wrapHue(750)).toBe(30);
  });
});
