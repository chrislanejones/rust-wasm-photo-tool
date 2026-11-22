// Redaction must be REAL (Night 11-21, 230): run the built engine
// (pkg/stamp_tool_bg.wasm) over a strip of synthetic 12 px "text" and measure
// what is left under the box. The thresholds are the definition of "hidden"
// the e2e uses too:
//   • no glyph pixel survives (nothing darker than 96 where the ink was 0),
//   • the box is near-flat (its standard deviation drops below 1/4 of the
//     text's),
//   • pixels away from the box are untouched.
import { beforeAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { BLOCK_MIN, BLUR_MIN, type Rect } from "@/lib/batchRedact";
import { redactOnPixels } from "@/lib/redactEngine";

const WASM = path.resolve(__dirname, "../../../pkg/stamp_tool_bg.wasm");
let mod: typeof import("stamp_tool");

beforeAll(async () => {
  mod = await import("stamp_tool");
  (mod as unknown as { initSync(o: { module: BufferSource }): void }).initSync({ module: fs.readFileSync(WASM) });
});

const W = 240;
const H = 60;
/** The "email" sits at (20, 24), 200 × 12: 1-2 px black strokes on white, a
 *  glyph-like pattern with letter gaps — the worst case for a weak blur. */
const TEXT: Rect = { x: 20, y: 24, w: 200, h: 12 };

function page(): Uint8Array {
  const px = new Uint8Array(W * H * 4).fill(255);
  for (let y = TEXT.y; y < TEXT.y + TEXT.h; y++) {
    for (let x = TEXT.x; x < TEXT.x + TEXT.w; x++) {
      const col = x - TEXT.x;
      const row = y - TEXT.y;
      const letter = col % 9; // 7 px letters, 2 px spacing
      const ink =
        letter < 7 &&
        (letter === 0 || letter === 6 || row === 0 || row === 11 || row === 5 || (col * 7 + row * 3) % 11 === 0);
      if (ink) {
        const i = (y * W + x) * 4;
        px[i] = px[i + 1] = px[i + 2] = 0;
      }
    }
  }
  return px;
}

function stats(px: Uint8Array, r: Rect) {
  let n = 0;
  let sum = 0;
  let sq = 0;
  let min = 255;
  for (let y = r.y; y < r.y + r.h; y++) {
    for (let x = r.x; x < r.x + r.w; x++) {
      const v = px[(y * W + x) * 4]!;
      n++;
      sum += v;
      sq += v * v;
      min = Math.min(min, v);
    }
  }
  const mean = sum / n;
  return { min, sd: Math.sqrt(Math.max(0, sq / n - mean * mean)) };
}

// The box a person would draw: the text plus a 2 px margin.
const BOX: Rect = { x: 18, y: 22, w: 204, h: 16 };
const before = stats(page(), TEXT);

describe("the fixture is legible text-like ink", () => {
  it("has black glyph pixels and strong contrast", () => {
    expect(before.min).toBe(0);
    expect(before.sd).toBeGreaterThan(80);
  });
});

describe.each([
  ["pixelate at the floor", { style: "pixelate" as const, block: BLOCK_MIN, blur: BLUR_MIN, color: "#000000" }],
  ["pixelate at the default", { style: "pixelate" as const, block: 16, blur: BLUR_MIN, color: "#000000" }],
  ["blur at the floor", { style: "blur" as const, block: BLOCK_MIN, blur: BLUR_MIN, color: "#000000" }],
  ["blur at the default", { style: "blur" as const, block: BLOCK_MIN, blur: 30, color: "#000000" }],
])("%s hides 12 px text", (_name, look) => {
  it("no glyph pixel survives and the box is near-flat", async () => {
    const out = await redactOnPixels(mod, page(), W, H, [BOX], look);
    const s = stats(out, TEXT);
    expect(s.min).toBeGreaterThan(96);
    expect(s.sd).toBeLessThan(before.sd / 4);
  });
  it("leaves the page away from the box alone", async () => {
    const out = await redactOnPixels(mod, page(), W, H, [BOX], look);
    // 14 px clear of the box: past the widest blur feather (one dab radius,
    // at most 12 px) and outside any mosaic cell the box touches.
    const far = stats(out, { x: 0, y: 0, w: W, h: 4 });
    expect(far.min).toBe(255);
  });
});

describe("Solid", () => {
  it("fills the box with the color, and the ink is gone with it", async () => {
    const out = await redactOnPixels(mod, page(), W, H, [BOX], { style: "solid", block: 16, blur: 30, color: "#ff0000" });
    const i = ((TEXT.y + 5) * W + TEXT.x + 3) * 4;
    expect([out[i], out[i + 1], out[i + 2]]).toEqual([255, 0, 0]);
    const s = stats(out, TEXT);
    expect(s.sd).toBe(0);
  });
});

describe("the floor matters", () => {
  it("a blur weaker than the floor would NOT hide it (why the slider starts at 20)", async () => {
    // Bypasses safeStrength's clamp by measuring the brush itself at 4.
    const tool = new mod.ImageHorseTool(W, H);
    try {
      tool.load_image(page());
      tool.effect_down(BOX.x, BOX.y + 8, 8, "blur", 4, 0, "#000000", "off");
      tool.effect_move(BOX.x + BOX.w, BOX.y + 8);
      tool.effect_up();
      const s = stats(new Uint8Array(tool.get_image_data()), TEXT);
      expect(s.min).toBeLessThan(96);
    } finally {
      tool.free();
    }
  });
});
