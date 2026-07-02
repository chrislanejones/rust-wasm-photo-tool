import { test, expect, type Page } from "@playwright/test";
import { join } from "node:path";
import { readFile } from "node:fs/promises";

// ─────────────────────────────────────────────────────────────────────────────
// imagehorse-qc §1 smoke harness: boot, load a non-blank canvas, export WebP.
//
// Runs against the PRODUCTION build served by `vite preview` (see
// playwright.config webServer). Demo mode is the tested path: no VITE_CLERK /
// VITE_CONVEX keys, so the app renders logged-out with no Clerk/Convex mount.
//
// NOT covered here (flaky blind / paired work later): canvas drag gestures
// (brush strokes, crop-handle drags). This harness only exercises boot + the
// file-input pipeline + the export codec boundary.
// ─────────────────────────────────────────────────────────────────────────────

// Playwright loads specs as CJS, so `__dirname` is available natively.
const FIXTURE_PNG = join(__dirname, "fixtures", "checker.png");

/**
 * Attach console/​page-error listeners and return the collected hard errors.
 *
 * Only APP-originated errors count: `console.error` calls and uncaught page
 * exceptions. Two classes are excluded as environmental, NOT app defects:
 *   • `console.warn` — demo mode logs benign warns (missing auth keys).
 *   • browser "Failed to load resource" network failures — the offline smoke
 *     env points Convex/Clerk at unreachable placeholder hosts (routed to abort
 *     below); the real QC target has live backends and emits none of these.
 * A thrown React error or an app `console.error` still trips this guard.
 */
function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    if (/Failed to load resource/i.test(text)) return; // network boundary noise
    errors.push(`console.error: ${text}`);
  });
  page.on("pageerror", (err) => {
    errors.push(`pageerror: ${err.message}`);
  });
  return errors;
}

/**
 * Keep the run offline + deterministic: abort every request that leaves
 * localhost (Convex sync, Clerk's JS, UploadThing). The core editor pipeline
 * (file → WASM engine → canvas → export) is entirely local, so nothing the
 * smoke tests exercise depends on these. Mirrors the network boundary a
 * logged-out demo user hits when the backends are simply idle.
 */
async function blockExternalNetwork(page: Page): Promise<void> {
  await page.route("**/*", (route) => {
    const url = route.request().url();
    if (/^https?:\/\/(localhost|127\.0\.0\.1)[:/]/.test(url) || url.startsWith("blob:") || url.startsWith("data:")) {
      return route.continue();
    }
    return route.abort();
  });
}

/** Drive the app's real Browse-Files pipeline with a genuine non-uniform PNG. */
async function loadFixtureImage(page: Page): Promise<void> {
  // The hidden <input type="file" accept="image/*"> lives inside NewActions
  // (rendered on the first-run surface). setInputFiles fires its onChange even
  // though it's visually hidden — this is the same path "Browse Files" triggers.
  const fileInput = page.locator('input[type="file"]');
  await fileInput.waitFor({ state: "attached" });
  await fileInput.setInputFiles(FIXTURE_PNG);

  // Once a photo loads, the editor reveals and the engine blits pixels to the
  // main canvas. Wait for the canvas to gain real dimensions.
  const canvas = page.locator("canvas.main-canvas");
  await canvas.waitFor({ state: "visible" });
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const c = document.querySelector<HTMLCanvasElement>("canvas.main-canvas");
          return c ? c.width : 0;
        }),
      { timeout: 20_000 },
    )
    .toBeGreaterThan(0);
}

test.describe("Image Horse — smoke (boot, load, export)", () => {
  test.beforeEach(async ({ page }) => {
    await blockExternalNetwork(page);
  });

  test("1 · boots and loads the page with zero console errors", async ({ page }) => {
    const errors = collectErrors(page);

    await page.goto("/");

    // The first-run surface reveals a "Browse Files" action once boot settles.
    await expect(
      page.getByRole("button", { name: /Browse Files/i }),
    ).toBeVisible({ timeout: 30_000 });

    expect(errors, `unexpected console errors:\n${errors.join("\n")}`).toEqual([]);
  });

  test("2 · renders a non-blank canvas (64×64 region is not uniform)", async ({
    page,
  }, testInfo) => {
    const errors = collectErrors(page);
    await page.goto("/");
    await loadFixtureImage(page);

    // Capture the literal 64×64 canvas region as evidence (per spec).
    const canvas = page.locator("canvas.main-canvas");
    const box = await canvas.boundingBox();
    expect(box, "canvas has a bounding box").not.toBeNull();
    const shot = await page.screenshot({
      clip: {
        x: box!.x + Math.max(0, (box!.width - 64) / 2),
        y: box!.y + Math.max(0, (box!.height - 64) / 2),
        width: 64,
        height: 64,
      },
    });
    await testInfo.attach("canvas-64x64", { body: shot, contentType: "image/png" });

    // Assert non-uniformity from the REAL rendered canvas pixels: read a 64×64
    // centre region and confirm not every pixel is identical. A blank/solid
    // canvas would report `uniform: true` here → this test would fail.
    const result = await page.evaluate(() => {
      const c = document.querySelector<HTMLCanvasElement>("canvas.main-canvas");
      if (!c || !c.width || !c.height) return { ok: false as const };
      const S = Math.min(64, c.width, c.height);
      const sx = Math.floor((c.width - S) / 2);
      const sy = Math.floor((c.height - S) / 2);
      const tmp = document.createElement("canvas");
      tmp.width = S;
      tmp.height = S;
      const ctx = tmp.getContext("2d");
      if (!ctx) return { ok: false as const };
      ctx.drawImage(c, sx, sy, S, S, 0, 0, S, S);
      const d = ctx.getImageData(0, 0, S, S).data;
      let uniform = true;
      for (let i = 4; i < d.length; i += 4) {
        if (
          d[i] !== d[0] ||
          d[i + 1] !== d[1] ||
          d[i + 2] !== d[2] ||
          d[i + 3] !== d[3]
        ) {
          uniform = false;
          break;
        }
      }
      return { ok: true as const, uniform };
    });

    expect(result.ok, "could read canvas pixels").toBe(true);
    expect(result.ok && result.uniform, "64×64 canvas region is not uniform").toBe(
      false,
    );

    expect(errors, `unexpected console errors:\n${errors.join("\n")}`).toEqual([]);
  });

  test("3 · exports a nonzero WebP via the Download flow", async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto("/");
    await loadFixtureImage(page);

    // The default tool (compress) shows the Format <select>. Pick WebP — the
    // one select that offers a webp option. This drives the global export format.
    const formatSelect = page
      .locator("select")
      .filter({ has: page.locator('option[value="webp"]') });
    await formatSelect.selectOption("webp");

    // The sidebar "Download & Share WEBP" button opens the Download/Share modal
    // (a second format chance) rather than downloading directly.
    await page.getByRole("button", { name: /Download & Share/i }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // The modal's "Download WEBP" tile is what actually fires the browser
    // download (handleExport → <a download> click). Capture it.
    const downloadPromise = page.waitForEvent("download");
    await dialog.getByRole("button", { name: /Download WEBP/i }).click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/\.webp$/i);

    // Sniff the saved bytes: WebP is a RIFF container tagged "WEBP". This is a
    // rigorous type + nonzero-size assertion on the actual exported file.
    const path = await download.path();
    expect(path).toBeTruthy();
    const bytes = await readFile(path!);
    expect(bytes.byteLength, "exported WebP is nonzero").toBeGreaterThan(0);
    expect(bytes.subarray(0, 4).toString("ascii")).toBe("RIFF");
    expect(bytes.subarray(8, 12).toString("ascii")).toBe("WEBP");

    expect(errors, `unexpected console errors:\n${errors.join("\n")}`).toEqual([]);

    // TODO(codec-worker): once the codec worker lands (RUN_SCHEDULE Task —
    // codec-worker run), assert the export path does NOT silently fall back when
    // the worker is unavailable. Enable after that run:
    //
    //   const workerAvailable = await page.evaluate(
    //     () => typeof (window as unknown as { __codecWorker?: unknown }).__codecWorker !== "undefined",
    //   );
    //   expect(workerAvailable, "codec worker is registered").toBe(true);
  });
});
