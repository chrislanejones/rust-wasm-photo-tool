// Engine baseline, NOT pointer-to-screen latency. Run after build:wasm:
// pnpm --silent run bench:annotations > /tmp/annotation-baseline.json
// Each case runs in a fresh process: WASM memory never shrinks after free().
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { cpus, platform, release } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packagePath = resolve(process.env.ANNOTATION_BENCH_PKG ?? `${root}/pkg`);
const samples = Number(process.env.ANNOTATION_BENCH_SAMPLES ?? 30);
assert(Number.isInteger(samples) && samples >= 5, "Use at least five samples");
const warmup = 5;
const paths = (process.env.ANNOTATION_BENCH_PATHS ?? "full,tiled").split(",");
assert(paths.length > 0 && new Set(paths).size === paths.length
  && paths.every((path) => ["full", "tiled", "dirty"].includes(path)), "Unknown or duplicate path");

if (process.argv[2] !== "--case") {
  const wasm = readFileSync(`${packagePath}/stamp_tool_bg.wasm`);
  const cases = [];
  for (const [width, height] of [[1200, 800], [4000, 3000]]) {
    for (const count of [10, 100, 500]) {
      for (const path of paths) {
        const config = { width, height, count, path };
        process.stderr.write(`Benchmark ${width}×${height}, ${count}, ${path}\n`);
        cases.push(JSON.parse(execFileSync(process.execPath, [
          fileURLToPath(import.meta.url), "--case", JSON.stringify(config),
        ], { encoding: "utf8", maxBuffer: 1024 * 1024 })));
      }
    }
  }
  for (let i = 0; i < cases.length; i += paths.length) {
    for (let j = 1; j < paths.length; j++) {
      assert.equal(cases[i].checksum, cases[i + j].checksum,
        "All rendering paths must finish with identical pixels");
    }
  }
  console.log(JSON.stringify({
    schema: 1,
    capturedAt: new Date().toISOString(),
    commit: execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(),
    workingTreeDirty: execFileSync("git", ["status", "--porcelain"], { cwd: root, encoding: "utf8" }).trim().length > 0,
    engine: { packagePath, wasmBytes: wasm.length, sha256: createHash("sha256").update(wasm).digest("hex") },
    host: { node: process.version, platform: platform(), release: release(), cpu: cpus()[0]?.model },
    samples, warmup,
    notes: [
      "Engine-only synchronous WASM baseline; no browser, worker RPC, React overlay, GPU upload, or pointer-to-screen latency.",
      "Fixture cycles rectangle, arrow, numbered pin, cached text. One opaque layer; deterministic positions and overlap.",
      "Raster batch times direct rectangle/arrow drawing, excluding layer composition. Text and pin rasterization remain included in recomposition/fixture creation.",
      "Commit includes a real shape update, its history snapshot, recomposition, and optional tile flush. History is cleared OUTSIDE each timed sample.",
      "Tiled is the existing full recomposition plus tile diff/copy, not dirty-region rendering.",
      "Dirty requires the dirty-regions build feature; renders explicit union bounds for the first rectangle, with one persistent full-canvas scratch allocation. No automatic invalidation or UI wiring.",
      "Memory is allocated WASM linear-memory capacity and process RSS, not live bytes or browser memory. Cases are process-isolated.",
      "Timings include WASM binding overhead. Median/p95 are descriptive, not CI pass/fail thresholds.",
    ],
    cases,
  }, null, 2));
} else {
  const config = JSON.parse(process.argv[3]);
  const { width, height, count, path } = config;
  const mod = await import(pathToFileURL(`${packagePath}/stamp_tool.js`).href);
  const wasm = await mod.default({ module_or_path: readFileSync(`${packagePath}/stamp_tool_bg.wasm`) });
  const tool = new mod.ImageHorseTool(width, height);
  const memory = () => ({
    wasmCapacityBytes: wasm.memory.buffer.byteLength,
    rssBytes: process.memoryUsage().rss,
    jsHeapUsedBytes: process.memoryUsage().heapUsed,
  });
  const measure = (fn, after = () => {}) => {
    const times = [];
    for (let i = 0; i < warmup + samples; i++) {
      const start = performance.now();
      fn(i);
      const elapsed = performance.now() - start;
      if (i >= warmup) times.push(elapsed);
      after();
    }
    const sorted = [...times].sort((a, b) => a - b);
    return {
      medianMs: sorted[Math.floor(sorted.length / 2)],
      p95Ms: sorted[Math.ceil(sorted.length * 0.95) - 1],
      samplesMs: times,
    };
  };
  const corners = new Uint16Array(4);
  const identity = new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]);
  const positions = Array.from({ length: count }, (_, i) => ({
    x: 20 + (i * 137) % (width - 180),
    y: 20 + (i * 83) % (height - 100),
  }));
  tool.load_image(new Uint8Array(width * height * 4).fill(255));
  tool.clear_history();
  const loaded = memory();
  let selectedId;
  const fixtureStart = performance.now();
  for (let i = 0; i < count; i++) {
    const { x, y } = positions[i];
    if (i % 4 === 3) {
      tool.restore_text_annotation(`Label ${i + 1}`, 20, 40, 40, 40, false,
        x, y, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        false, false, 0, 0, 0, 0, 0, 0, 0, "", 0, 0, identity);
    } else if (i % 4 === 2) {
      tool.restore_pin_annotation(x, y, x + 80, y + 40, i + 1, 220, 50, 50, 0);
    } else {
      const id = tool.restore_shape_annotation(i % 4 === 0 ? 0 : 4,
        x, y, x + 100, y + 50, 220, 50, 50, 3, 0,
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 8, 0, 5, 0, corners);
      if (i === 0) selectedId = id;
    }
  }
  const fixtureCreationMs = performance.now() - fixtureStart;
  assert.equal(tool.shape_annotation_count() + tool.text_annotation_count(), count);
  tool.recomposite();
  tool.clear_history();
  const populated = memory();
  if (path === "dirty") assert.equal(typeof mod.AnnotationRegionPrototype, "function",
    "Build with IH_WASM_FEATURES=tiles,patchmatch,dirty-regions pnpm run build:wasm");
  const region = path === "dirty" ? new mod.AnnotationRegionPrototype(tool) : null;
  const render = () => {
    if (region) assert.equal(region.render(tool, 16, 16, 144, 74), true,
      "Benchmark must actually take the regional path");
    else tool.recomposite();
  };
  const flush = () => {
    if (path === "tiled") {
      assert.equal(tool.tiles_flush(), true, "Fixture must exercise the tiled path");
      tool.tiles_clear_dirty();
    }
  };
  flush();
  const recomposition = measure(() => tool.recomposite());
  const renderAndFlush = measure(() => { render(); flush(); });
  const tileFlushOnly = path === "tiled" ? measure(flush) : null;
  const commitAndFlush = measure((i) => {
    const { x, y } = positions[0];
    const dx = i % 2 ? 20 : 0;
    assert.equal(tool.update_shape_annotation(selectedId, 0, x + dx, y,
      x + 100 + dx, y + 50, "#dc3232", 3, 0, 0, "#000000",
      "#000000", 0, 8, 0, 5, 0, corners), true);
    render();
    flush();
  }, () => tool.clear_history());
  const afterCommit = memory();

  // Validate that the tile mirror hasn't changed the result; outside timing.
  const displayed = new Uint8Array(wasm.memory.buffer, tool.data_ptr(), tool.data_len()).slice();
  tool.recomposite();
  const full = new Uint8Array(wasm.memory.buffer, tool.data_ptr(), tool.data_len());
  assert.deepEqual(displayed, full);
  const checksum = createHash("sha256").update(full).digest("hex");
  region?.free();
  tool.free();

  // Direct raster workload is deliberately separate from the live document.
  // These calls write pixels without snapshots or a recomposite.
  const raster = new mod.ImageHorseTool(width, height);
  const rasterBatch = measure(() => {
    for (let i = 0; i < count; i++) {
      const { x, y } = positions[i];
      if (i % 2) raster.draw_arrow(x, y, x + 100, y + 50, "#dc3232", 3, 0);
      else raster.draw_shape(x, y, x + 100, y + 50, 0, "#dc3232", 3);
    }
  });
  const afterRaster = memory();
  raster.free();
  console.log(JSON.stringify({
    ...config, fixtureCreationMs, recomposition, renderAndFlush,
    prototypeScratchBytes: path === "dirty" ? width * height * 4 : 0,
    tileFlushOnly, commitAndFlush, rasterBatch,
    memory: { loaded, populated, afterCommit, afterRaster },
    fullFrameParity: true, checksum,
  }));
}
