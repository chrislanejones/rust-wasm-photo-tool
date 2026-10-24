// Screenshot comparison diff in WASM (Night 10-23). Run after build:wasm:
// pnpm --silent run bench:compare > /tmp/compare-bench.json
// Times `compare_photo` — the call the page makes, in the engine — on a
// synthetic UI screenshot pair (panels, a grid of
// "text" strokes, three changes: a moved button, a changed label, a recolored
// icon) at three sizes. The plan's bar: 2880 x 1800 under 150 ms.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { cpus, platform, release } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = resolve(process.env.COMPARE_BENCH_PKG ?? `${root}/pkg`);
const samples = Number(process.env.COMPARE_BENCH_SAMPLES ?? 20);
const mod = await import(pathToFileURL(`${pkg}/stamp_tool.js`).href);
mod.initSync({ module: readFileSync(`${pkg}/stamp_tool_bg.wasm`) });

function screenshot(w, h, changed) {
  const px = new Uint8Array(w * h * 4).fill(255);
  const fill = (x0, y0, bw, bh, [r, g, b]) => {
    for (let y = y0; y < Math.min(h, y0 + bh); y++) {
      for (let x = x0; x < Math.min(w, x0 + bw); x++) {
        const i = (y * w + x) * 4;
        px[i] = r; px[i + 1] = g; px[i + 2] = b;
      }
    }
  };
  const u = Math.round(w / 1440); // layout unit: 1 at 1440 wide
  fill(0, 0, w, 48 * u, [32, 36, 44]); // top bar
  fill(0, 48 * u, 260 * u, h, [244, 245, 247]); // side panel
  // "Text": short dark strokes in rows, like lines of a UI.
  for (let y = 80 * u; y < h - 20 * u; y += 22 * u) {
    for (let x = 300 * u; x < w - 40 * u; x += 9 * u) {
      if ((x * 7 + y * 13) % 5 !== 0) fill(x, y, 6 * u, 2 * u, [60, 60, 70]);
    }
  }
  const bx = changed ? 360 * u : 320 * u; // a button with its label, moved 40
  fill(bx, 60 * u, 120 * u, 36 * u, [37, 99, 235]);
  for (let x = bx + 16 * u; x < bx + 104 * u; x += 9 * u) fill(x, 76 * u, 6 * u, 3 * u, [255, 255, 255]);
  fill(20 * u, 300 * u, 180 * u, 14 * u, changed ? [200, 40, 40] : [60, 60, 70]); // label
  fill(1200 * u, 600 * u, 48 * u, 48 * u, changed ? [16, 160, 90] : [240, 160, 0]); // icon
  return px;
}

const results = [];
for (const [w, h] of [[1440, 900], [2880, 1800], [4000, 3000]]) {
  const a = screenshot(w, h, false);
  const b = screenshot(w, h, true);
  // B is the open document; A is handed in, as the page does.
  const tool = new mod.ImageHorseTool(w, h);
  tool.load_image(b);
  for (let i = 0; i < 3; i++) tool.compare_photo(a, w, h, 28, 16, 24); // warm up
  const ms = [];
  let out;
  for (let i = 0; i < samples; i++) {
    const t0 = performance.now();
    out = tool.compare_photo(a, w, h, 28, 16, 24);
    ms.push(performance.now() - t0);
  }
  tool.free();
  const boxes = [...Array(out[2])].map((_, i) => [...out.slice(3 + i * 5, 8 + i * 5)]);
  assert.equal(out[2], 3, `three changes at ${w}x${h}: ${JSON.stringify(boxes)}`);
  ms.sort((x, y) => x - y);
  const pct = (p) => +ms[Math.min(ms.length - 1, Math.floor(p * ms.length))].toFixed(1);
  results.push({ width: w, height: h, regions: out[2], samples, medianMs: pct(0.5), p95Ms: pct(0.95), minMs: +ms[0].toFixed(1) });
  process.stderr.write(`${w}x${h}: median ${pct(0.5)} ms, p95 ${pct(0.95)} ms\n`);
}
const wasm = readFileSync(`${pkg}/stamp_tool_bg.wasm`);
console.log(JSON.stringify({
  date: new Date().toISOString(),
  node: process.version,
  platform: `${platform()} ${release()}`,
  cpu: cpus()[0]?.model,
  wasmBytes: wasm.length,
  results,
}, null, 2));
