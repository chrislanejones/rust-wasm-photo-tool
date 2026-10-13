// Usage: node scripts/pins-composite-benchmark.mjs BEFORE_PKG AFTER_PKG
// Run with other builds/tests stopped. The median is engine work, not UI latency.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

for (const directory of process.argv.slice(2)) {
  const pkg = resolve(directory);
  const mod = await import(pathToFileURL(`${pkg}/stamp_tool.js`).href);
  await mod.default({ module_or_path: readFileSync(`${pkg}/stamp_tool_bg.wasm`) });
  for (const [w, h] of [[1200, 800], [4000, 3000]]) {
    for (const count of [0, 1, 30]) {
      const tool = new mod.ImageHorseTool(w, h);
      tool.load_image(new Uint8Array(w * h * 4).fill(255));
      for (let n = 0; n < count; n++) tool.add_pin_annotation(20 + n * 30, 20, 60 + n * 30, 60, n + 1, "#ef4444", 0);
      for (let n = 0; n < 3; n++) tool.recomposite();
      const times = [];
      for (let n = 0; n < 11; n++) {
        const start = performance.now();
        tool.recomposite();
        times.push(performance.now() - start);
      }
      console.log(JSON.stringify({ pkg, width: w, height: h, pins: count, medianMs: times.sort((a, b) => a - b)[5] }));
      tool.free();
    }
  }
}
