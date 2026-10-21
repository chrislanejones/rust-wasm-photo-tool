import { test, expect } from "./guard/test";
import { installAnnotationProbe, measureEmptyOverlayFloor, observeDrag, screenPoint } from "./annotation-benchmark-harness";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";

// Opt-in measurements, not wall-clock CI thresholds. Run without competing
// builds/tests: ANNOTATION_BROWSER_BENCH=1 pnpm exec playwright test
// e2e/annotation-performance.spec.ts --workers=1
// ANNOTATION_BROWSER_CPU=4 slows the page's CPU fourfold (DevTools throttling).
test.skip(process.env.ANNOTATION_BROWSER_BENCH !== "1", "Opt-in performance measurement");
const CPU_SLOWDOWN = Number(process.env.ANNOTATION_BROWSER_CPU ?? 1);

function stats(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  return { medianMs: sorted[Math.floor(sorted.length / 2)],
    p95Ms: sorted[Math.ceil(sorted.length * 0.95) - 1], samplesMs: values };
}

for (const worker of [false, true]) {
    for (const count of [10, 100, 500]) {
      test(`${count} annotations, ${worker ? "worker" : "local"}`, async ({ page }, info) => {
        await page.setViewportSize({ width: 1600, height: 1100 });
        await page.route("**/*", (route) => {
          const url = new URL(route.request().url());
          return ["localhost", "127.0.0.1"].includes(url.hostname) || ["blob:", "data:"].includes(url.protocol)
            ? route.continue() : route.abort();
        });
        await page.addInitScript(({ worker }) => {
          localStorage.setItem("ih_engine_worker", worker ? "1" : "0");
          localStorage.setItem("image-horse-prefs", JSON.stringify({ canvasArtboard: false }));
        }, { worker });
        // Generate the input through the real Rust PNG encoder.
        const wasm = await import(pathToFileURL(resolve("pkg/stamp_tool.js")).href);
        await wasm.default({ module_or_path: readFileSync("pkg/stamp_tool_bg.wasm") });
        const png = Buffer.from(wasm.blank_png(1200, 800, 240, 240, 240, 255));
        await page.goto("/");
        await page.locator('input[type="file"]').setInputFiles({
          name: "annotation-benchmark.png", mimeType: "image/png", buffer: png,
        });
        await expect(page.locator("canvas.main-canvas")).toBeVisible();
        await expect.poll(() => page.locator("canvas.main-canvas").getAttribute("width")).toBe("1200");
        await installAnnotationProbe(page);
        const cdp = await page.context().newCDPSession(page);
        await cdp.send("Emulation.setCPUThrottlingRate", { rate: CPU_SLOWDOWN });
        expect(page.workers().some(w => w.url().includes("engine.worker"))).toBe(worker);
        await page.evaluate(async (count) => {
          const tool = window.__annotationTool;
          for (let i = 0; i < count - 1; i++) {
            const x = 400 + (i * 137) % 620;
            const y = 20 + (i * 83) % 700;
            if (i % 4 === 3) {
              await tool.restore_text_annotation(`Label ${i + 1}`, 20, 40, 40, 40, false,
                x, y, 0, 0, 0, 0, 0, 0, 0, 0, 0, false, false, 0, 0, 0, 0,
                0, 0, 0, "", 0, 0, new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]));
            } else if (i % 4 === 2) {
              await tool.restore_pin_annotation(x, y, x + 80, y + 40, i + 1, 220, 50, 50, 0);
            } else {
              await tool.restore_shape_annotation(i % 4 === 0 ? 0 : 4,
                x, y, x + 100, y + 50, 220, 50, 50, 3, 0,
                0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 8, 0, 5, 0, new Uint16Array(4));
            }
          }
          await tool.recomposite();
          await tool.clear_history();
        }, count);
        await page.getByRole("button", { name: "Create", exact: true }).first().click();
        await page.getByRole("button", { name: "Shapes", exact: true }).first().click();
        await page.getByRole("radio", { name: "Rectangle", exact: true }).first().click();
        const a = await screenPoint(page, 80, 100);
        const b = await screenPoint(page, 240, 200);
        await page.mouse.move(a.x, a.y);
        await page.mouse.down();
        await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2);
        await page.mouse.move(b.x, b.y);
        await page.mouse.up();
        await expect(page.locator("svg[data-draw-overlay]")).toBeVisible();
        await page.keyboard.press("Enter");
        await expect.poll(() => page.evaluate(async () =>
          await window.__annotationTool.shape_annotation_count() + await window.__annotationTool.text_annotation_count()
        )).toBe(count);
        await expect(page.locator("svg[data-draw-overlay]")).toHaveCount(0);
        // Reselect the last shape by its outline, then drag its body.
        await page.mouse.click((a.x + b.x) / 2, a.y);
        await expect(page.locator("svg[data-draw-overlay]")).toBeVisible();
        await observeDrag(page);
        const start = await screenPoint(page, 160, 150);
        const box = page.locator("svg[data-draw-overlay] rect[stroke-dasharray]").first();
        const oldX = Number(await box.getAttribute("x"));
        await page.mouse.move(start.x, start.y);
        await page.mouse.down();
        for (let i = 1; i <= 35; i++) {
          await page.mouse.move(start.x + i * 2, start.y);
          await page.waitForFunction(expected => window.__annotationDragSamples.length === expected, i);
        }
        await page.mouse.up();
        expect(Number(await box.getAttribute("x"))).toBeGreaterThan(oldX + 60);
        const dragSamples = await page.evaluate(() => window.__annotationDragSamples.slice(5));
        const rpcSamples = await page.evaluate(async () => {
          const samples = [];
          for (let i = 0; i < 35; i++) {
            const start = performance.now();
            await window.__annotationTool.width();
            if (i >= 5) samples.push(performance.now() - start);
          }
          return samples;
        });
        const before = await page.evaluate(async () => JSON.parse(await window.__annotationTool.get_shape_annotations()));
        await page.keyboard.press("Enter");
        await expect.poll(() => page.evaluate(async () =>
          JSON.parse(await window.__annotationTool.get_shape_annotations()).at(-1).x0
        )).toBeGreaterThan(before.at(-1).x0);
        await expect(page.locator("svg[data-draw-overlay]")).toHaveCount(0);
        await page.keyboard.press("Control+z");
        await expect.poll(() => page.evaluate(async () =>
          JSON.parse(await window.__annotationTool.get_shape_annotations()).at(-1).x0
        )).toBe(before.at(-1).x0);
        await cdp.send("Performance.enable");
        const { metrics } = await cdp.send("Performance.getMetrics");
        // Last, because it leaves the editor: the same paced drag on an empty page.
        const floorSamples = (await measureEmptyOverlayFloor(page, 35)).slice(5);
        const report = {
          count, worker, cpuSlowdown: CPU_SLOWDOWN, renderPath: "full", width: 1200, height: 800,
          browser: page.context().browser()?.version(), capturedAt: new Date().toISOString(),
          fixtureWasmSha256: createHash("sha256").update(readFileSync("pkg/stamp_tool_bg.wasm")).digest("hex"),
          eventToDom: stats(dragSamples.map(s => s.eventToDomMs)),
          eventToFrameOpportunity: stats(dragSamples.map(s => s.eventToFrameOpportunityMs)),
          eventToDispatch: stats(dragSamples.map(s => s.eventToDispatchMs)),
          dispatchToDom: stats(dragSamples.map(s => s.dispatchToDomMs)),
          emptyOverlayFloorEventToDom: stats(floorSamples.map(s => s.eventToDomMs)),
          engineWidthRoundTrip: stats(rpcSamples),
          mainThreadJsHeapUsedBytes: metrics.find(m => m.name === "JSHeapUsedSize")?.value,
          notes: [
            "Real Playwright mouse events through the app's editable SVG overlay; 5 warmups and 30 samples.",
            "Each drag step waits for the observed update; this measures paced latency, not burst coalescing or sustained throughput.",
            "Frame opportunity is RAF following observed overlay DOM mutation, not physical presentation latency.",
            "The SVG drag does not recompose the engine every move; commit and undo are verified separately.",
            "The old ih_tiles_flush flag is no longer consumed by the app; tiled and dirty paths are compared in the engine benchmark only.",
            "width() measures a minimal engine/worker round trip, not pure serialization overhead.",
            "JS heap excludes worker heaps, WASM memory and GPU allocations; engine capacity is in the Node benchmark.",
            "Fixture objects occupy the right side so the measured shape has an unobstructed drag target.",
            "eventToDispatch is the browser's input queue (event timestamp to the first window capture listener); dispatchToDom is the app's own work.",
            "emptyOverlayFloorEventToDom repeats the paced drag on an empty page whose SVG is written straight from a pointermove listener: the floor no overlay can beat.",
          ],
        };
        expect(dragSamples).toHaveLength(30);
        expect(dragSamples.every(s => Number.isFinite(s.eventToDomMs) && s.eventToDomMs >= 0)).toBe(true);
        await info.attach("annotation-performance", { body: JSON.stringify(report, null, 2), contentType: "application/json" });
        if (process.env.ANNOTATION_BROWSER_OUTPUT) {
          mkdirSync(process.env.ANNOTATION_BROWSER_OUTPUT, { recursive: true });
          writeFileSync(resolve(process.env.ANNOTATION_BROWSER_OUTPUT,
            `${count}-${worker ? "worker" : "local"}${CPU_SLOWDOWN === 1 ? "" : `-cpu${CPU_SLOWDOWN}`}.json`), JSON.stringify(report, null, 2) + "\n");
        }
      });
    }
}
