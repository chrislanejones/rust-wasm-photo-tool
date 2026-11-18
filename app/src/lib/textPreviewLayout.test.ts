// ADR-106: the open textarea laid out as the engine lays out the text. The
// browser half (that Chrome then draws those glyphs where the engine does) is
// e2e/text-preview-size.spec.ts; this pins the arithmetic.
import { describe, it, expect, beforeEach } from "vitest";
import { alignShiftFrom, engineBlockHeight, engineLineCount, engineTextarea, sidePadding } from "./textPreviewLayout";
import { primeTextMetrics, resetTextMetricsCache, textEmRatio } from "./engine/textMetricsCache";
import type { ImageHorseTool } from "stamp_tool";

const SANS = 2048 / 2288;
const base = {
  canvasX: 300.4,
  canvasY: 250.2,
  scaleX: 1,
  scaleY: 1,
  fontSize: 48,
  emRatio: SANS,
  plainInk: [15, 21] as const,
  shift: 0,
  column: 0,
  row: 0,
  wrapWidth: 0,
  boxHeight: 0,
  lines: 1,
  widest: 241,
  padX: 4,
  padY: 2,
};

describe("engineTextarea", () => {
  it("draws at the engine's em, with the engine's line pitch, not 1.3 em", () => {
    const { style } = engineTextarea(base);
    expect(style.fontSize).toBeCloseTo(48 * SANS, 6);
    // 1.3 in f32, as `render_text_with` computes it.
    expect(parseFloat(style.lineHeight)).toBeCloseTo(48 * 1.3, 4);
  });

  it("puts the content box on the pen origin commitText will store", () => {
    // commitText: x = round(canvasX + PAD_X / s - ink[0] + shift), the same
    // for y, and the pen is `side_padding` inside that.
    const a = engineTextarea(base);
    const x = Math.round(base.canvasX + base.padX - base.plainInk[0]);
    const y = Math.round(base.canvasY + base.padY - base.plainInk[1]);
    expect(base.canvasX + a.dx).toBe(x);
    expect(base.canvasY + a.dy).toBe(y);
    const [top, side, bottom] = a.style.padding.split(" ").map(parseFloat);
    expect(side).toBe(sidePadding(48));
    expect(bottom).toBe(sidePadding(48));
    // First baseline: CSS centers ascent + descent (= the engine size at this
    // em) in a 1.3 * size line, so 0.15 * size of the line sits above it.
    // …plus BASELINE_SNAP (1 px), measured in the browser: Chrome's glyphs
    // sit ~1 px above ab_glyph's at the same computed baseline.
    expect(top + 0.15 * 48 - 1).toBeCloseTo(sidePadding(48), 4);
  });

  it("follows the commit's alignment shift", () => {
    const a = engineTextarea(base);
    const b = engineTextarea({ ...base, shift: 7.3 });
    expect(b.dx - a.dx).toBe(Math.round(base.canvasX + 4 - 15 + 7.3) - Math.round(base.canvasX + 4 - 15));
  });

  it("wraps in the engine's content width, and never wraps with no box", () => {
    const boxed = engineTextarea({ ...base, wrapWidth: 300 });
    expect(boxed.style.width - 2 * sidePadding(48)).toBe(300 - 2 * sidePadding(48));
    expect(boxed.style.whiteSpace).toBe("pre-wrap");
    const free = engineTextarea(base);
    expect(free.style.width).toBe(241 + 2 * sidePadding(48));
    expect(free.style.whiteSpace).toBe("pre");
  });

  it("drops the text into a taller box the way grow_to_box_height_aligned does", () => {
    const block = engineBlockHeight(2, 48);
    const top = (row: number) =>
      parseFloat(engineTextarea({ ...base, lines: 2, boxHeight: block + 41, row }).style.padding);
    expect(top(1) - top(0)).toBe(20); // spare / 2, floored, as Rust's integer division
    expect(top(2) - top(0)).toBe(41);
  });

  it("scales everything by the canvas scale", () => {
    const a = engineTextarea({ ...base, scaleX: 0.5, scaleY: 0.5 });
    expect(a.style.fontSize).toBeCloseTo(24 * SANS, 6);
    expect(parseFloat(a.style.lineHeight)).toBeCloseTo(48 * 1.3 * 0.5, 4);
  });

  it("turns off what ab_glyph does not do: kerning, ligatures, hinted advances", () => {
    const { style } = engineTextarea(base);
    expect(style.fontKerning).toBe("none");
    expect(style.fontVariantLigatures).toBe("none");
    expect(style.textRendering).toBe("geometricPrecision");
  });
});

describe("the engine's block", () => {
  it("is ceil(lines * 1.3 * size) + 2 * side padding, in f32 like Rust", () => {
    expect(engineBlockHeight(1, 48)).toBe(Math.ceil(62.4) + 24);
    expect(engineBlockHeight(2, 48)).toBe(125 + 24);
    expect(engineBlockHeight(3, 24)).toBe(Math.ceil(3 * 31.2) + 12);
  });

  it("counts lines as str::lines does: a trailing newline adds none", () => {
    expect(engineLineCount("a\nb", 2)).toBe(2);
    expect(engineLineCount("a\n", 2)).toBe(1);
  });
});

describe("alignShiftFrom is alignAnchorShift's arithmetic", () => {
  it("is 0 for left", () => {
    expect(alignShiftFrom(0, 300, 48, [260, 80], [15, 21], 280, 4)).toBe(0);
  });
  it("anchors a boxed text on its box", () => {
    expect(alignShiftFrom(1, 300, 48, undefined, [15, 21], 0, 4)).toBe(11);
    expect(alignShiftFrom(2, 300, 48, undefined, [15, 21], 0, 4)).toBe(15 + 12 - 8);
  });
  it("anchors a no-box text on the textarea's content box", () => {
    const widest = 265 - 24 - 0.5;
    expect(alignShiftFrom(1, 0, 48, [265, 80], [15, 21], 290, 4)).toBe(3 + (290 - widest) / 2);
    expect(alignShiftFrom(2, 0, 48, [265, 80], [15, 21], 290, 4)).toBe(3 + 290 - widest);
    expect(alignShiftFrom(2, 0, 48, undefined, [15, 21], 290, 4)).toBe(0);
  });
});

describe("the em ratio in the metrics cache", () => {
  beforeEach(() => resetTextMetricsCache());

  const tool = (ratio?: number) =>
    ({
      measure_text: () => new Uint32Array([10, 10]),
      text_ink_offset: () => new Int32Array([1, 1]),
      ...(ratio === undefined ? {} : { text_em_ratio: (id: string, bold: boolean) => ratio + (bold ? 0.01 : 0) + (id ? 0.1 : 0) }),
    }) as unknown as ImageHorseTool;

  it("is filled by primeTextMetrics, keyed on face and weight", async () => {
    expect(textEmRatio(null, false, "")).toBeUndefined();
    expect(await primeTextMetrics(tool(SANS), "Hi", 48, false, "")).toBe(true);
    expect(textEmRatio(null, false, "")).toBeCloseTo(SANS, 9);
    expect(textEmRatio(null, true, "")).toBeUndefined();
    await primeTextMetrics(tool(SANS), "Hi", 48, true, "liberation-serif");
    expect(textEmRatio(null, true, "liberation-serif")).toBeCloseTo(SANS + 0.11, 9);
  });

  it("stays a miss on an engine without text_em_ratio, so the preview keeps the old box", async () => {
    await primeTextMetrics(tool(), "Hi", 48, false, "");
    expect(textEmRatio(null, false, "")).toBeUndefined();
  });
});
