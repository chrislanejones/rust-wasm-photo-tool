import { test, expect } from "./guard/test";
import type { Page } from "@playwright/test";
import { join } from "node:path";
import { readFileSync } from "node:fs";
import { installAnnotationProbe, screenPoint } from "./annotation-benchmark-harness";

// ─────────────────────────────────────────────────────────────────────────────
// A downloaded export is the picture on the canvas (PARKING_LOT 33a leftovers,
// 11-12-2026: "no e2e downloads a file yet").
//
// A text with a dragged box and a rectangle go on the paper fixture, the
// Export dialog downloads a PNG, and the file's pixels are compared with the
// engine's own composite (`get_image_data`, what the canvas shows). PNG is
// lossless, so they must match exactly: same size, every RGBA byte.
// The PNG is decoded in the page with no color conversion and no
// premultiplication, so the browser hands back the file's bytes as stored.
// ─────────────────────────────────────────────────────────────────────────────

const FIXTURE_PNG = join(__dirname, "fixtures", "paper-1200x900.png");
const TEXT = "Exported exactly as drawn: a boxed text over the paper.";

async function open(page: Page) {
  await page.setViewportSize({ width: 1600, height: 1100 });
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    return ["localhost", "127.0.0.1"].includes(url.hostname) || ["blob:", "data:"].includes(url.protocol)
      ? route.continue() : route.abort();
  });
  await page.addInitScript(() =>
    localStorage.setItem("image-horse-prefs", JSON.stringify({ canvasArtboard: false })));
  await page.goto("/");
  await page.locator('input[type="file"]').first().setInputFiles(FIXTURE_PNG);
  await expect.poll(() => page.locator("canvas.main-canvas").getAttribute("width")).toBe("1200");
  await installAnnotationProbe(page);
}

async function boxedText(page: Page) {
  await page.getByRole("button", { name: "Create", exact: true }).first().click();
  await page.getByRole("button", { name: "Text", exact: true }).first().click();
  const at = await screenPoint(page, 200, 200);
  await page.mouse.click(at.x, at.y);
  const input = page.locator("textarea").first();
  await expect(input).toBeVisible();
  await input.fill(TEXT);
  const corners = page.locator('rect[style*="nwse-resize"]');
  await expect(corners).toHaveCount(2);
  const nw = (await corners.nth(0).boundingBox())!;
  const se = (await corners.nth(1).boundingBox())!;
  const k = await page.evaluate(() => {
    const c = document.querySelector<HTMLCanvasElement>("canvas.main-canvas")!;
    return c.getBoundingClientRect().width / c.width;
  });
  await page.mouse.move(se.x + se.width / 2, se.y + se.height / 2);
  await page.mouse.down();
  await page.mouse.move(nw.x + nw.width / 2 + 300 * k, nw.y + nw.height / 2 + 160 * k, { steps: 10 });
  await page.mouse.up();
  const away = await screenPoint(page, 1000, 800);
  await page.mouse.click(away.x, away.y);
  await page.waitForTimeout(600);
  await page.keyboard.press("Escape");
  await expect.poll(async () =>
    JSON.parse(await page.evaluate(async () => await window.__annotationTool.get_text_annotations())).length).toBe(1);
}

test("a downloaded PNG has exactly the canvas's pixels", async ({ page }) => {
  await open(page);
  await boxedText(page);
  await page.evaluate(async () => {
    const t = window.__annotationTool;
    await t.add_shape_annotation(0, 700, 500, 1000, 700, "#e02020", 4, 0, 0, "#000000", "#000000", 0, 0, 0, 0, 0, new Uint16Array(4));
    await t.recomposite();
  });
  const canvas = await page.evaluate(async () => {
    const t = window.__annotationTool;
    return { w: await t.width(), h: await t.height(), px: Array.from(await t.get_image_data()) };
  });

  await page.getByRole("button", { name: "Export", exact: true }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByText("PNG", { exact: true }).click();
  const [dl] = await Promise.all([
    page.waitForEvent("download", { timeout: 30_000 }),
    dialog.getByRole("button", { name: /^Download PNG/ }).click(),
  ]);
  const file = readFileSync((await dl.path())!);
  expect(file.subarray(1, 4).toString(), "the download is a PNG").toBe("PNG");

  const decoded = await page.evaluate(async (b64) => {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const bmp = await createImageBitmap(new Blob([bytes], { type: "image/png" }), {
      colorSpaceConversion: "none",
      premultiplyAlpha: "none",
    });
    const c = new OffscreenCanvas(bmp.width, bmp.height);
    const ctx = c.getContext("2d", { colorSpace: "srgb" })!;
    ctx.drawImage(bmp, 0, 0);
    return { w: bmp.width, h: bmp.height, px: Array.from(ctx.getImageData(0, 0, bmp.width, bmp.height).data) };
  }, file.toString("base64"));

  expect({ w: decoded.w, h: decoded.h }, "same size").toEqual({ w: canvas.w, h: canvas.h });
  let differ = 0;
  let first = -1;
  for (let i = 0; i < canvas.px.length; i++) {
    if (canvas.px[i] !== decoded.px[i]) {
      differ++;
      if (first < 0) first = i;
    }
  }
  expect(differ, `bytes that differ (first at pixel ${first >> 2})`).toBe(0);
});
