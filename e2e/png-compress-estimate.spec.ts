import { test, expect } from "./guard/test";
import type { Page } from "@playwright/test";

// ─────────────────────────────────────────────────────────────────────────────
// PNG Compress: the "Image weight" readout never shows the lossless estimate
// for a color-reduced PNG (PNG Compress leftover, 10-27-2026; fixed 11-23).
//
// Below Quality 100 a PNG is color-reduced, and what that saves depends on the
// picture: a flat logo shrinks a lot, a photo hardly. The formula cannot see
// the picture, so its "≈" was the LOSSLESS size, shown for the ~350 ms before
// the measurement landed. Now the readout is a skeleton until the measured
// number is in.
//
// From the first quality step on, every value the readout takes is recorded
// (a MutationObserver) and it is also sampled after every key press, so a
// "≈" that shows for one frame fails, and so does one that just stays. A first
// draft only recorded changes and PASSED on the old code: the lossless "≈" was
// already on screen and never changed, so nothing recorded it.
// ─────────────────────────────────────────────────────────────────────────────

test.setTimeout(120_000);

async function offline(page: Page) {
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    return ["localhost", "127.0.0.1"].includes(url.hostname) || ["blob:", "data:"].includes(url.protocol)
      ? route.continue()
      : route.abort();
  });
}

/** Flat art, drawn in the page: a few solid shapes with anti-aliased edges
 *  and some lettering. Edges give it thousands of colors; most of the area is
 *  flat, which is what color reduction is for. */
async function flatArtPng(page: Page): Promise<Buffer> {
  const b64 = await page.evaluate(async () => {
    const c = new OffscreenCanvas(1200, 800);
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#f4f1ea";
    ctx.fillRect(0, 0, 1200, 800);
    const shapes: [string, number, number, number][] = [
      ["#e4572e", 300, 300, 180],
      ["#29335c", 760, 420, 240],
      ["#f3a712", 520, 620, 120],
      ["#669bbc", 980, 180, 110],
    ];
    for (const [color, x, y, r] of shapes) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#1b1b1e";
    ctx.font = "bold 96px sans-serif";
    ctx.fillText("FLAT ART", 120, 760);
    const bytes = new Uint8Array(await (await c.convertToBlob({ type: "image/png" })).arrayBuffer());
    let bin = "";
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  });
  return Buffer.from(b64, "base64");
}

test("a flat-art PNG at Quality 60 never shows the lossless estimate first", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await offline(page);
  await page.goto("/");
  const png = await flatArtPng(page);
  await page.locator('input[type="file"]').first().setInputFiles([{ name: "flat-art.png", mimeType: "image/png", buffer: png }]);
  await page.locator("canvas.main-canvas").waitFor({ state: "visible", timeout: 60_000 });
  await page.waitForTimeout(1500);

  await page.getByRole("button", { name: "Enhance", exact: true }).first().click();
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: "Resize & Compress", exact: true }).first().click();
  const box = page.getByTestId("pagespeed-box");
  const readout = page.getByTestId("image-weight");
  const slider = page.getByRole("slider", { name: "Quality" });
  // PNG at the opening quality first. Nothing is pending there, so the panel
  // previews Apply Resize: this PNG's own encoding, which is lossless, and
  // there the "≈" estimate IS the right number. Let it measure and settle.
  await expect(readout).toContainText("KB", { timeout: 15_000 });
  const startQuality = await slider.getAttribute("aria-valuetext");
  await box.getByRole("radio", { name: "PNG", exact: true }).click();
  await expect(readout).toContainText("KB", { timeout: 15_000 });
  await expect(readout).not.toContainText("≈", { timeout: 15_000 });
  const lossless = await readout.locator("span.tabular-nums").first().textContent();

  // From here every readout is a color-reduced PNG's. Record every value it
  // takes (a MutationObserver), AND sample it right after every key press: a
  // "≈" that is already on screen and does not change makes no mutation.
  await readout.evaluate((el) => {
    const w = window as unknown as { __weights: string[] };
    w.__weights = [];
    new MutationObserver(() => w.__weights.push(el.textContent ?? "")).observe(el, {
      subtree: true,
      childList: true,
      characterData: true,
    });
  });
  const sample = () => readout.evaluate((el) => (window as unknown as { __weights: string[] }).__weights.push(`sample:${el.textContent}`));
  await slider.focus();
  for (let i = 0; i < 100 && (await slider.getAttribute("aria-valuetext")) !== "60%"; i++) {
    await page.keyboard.press("ArrowLeft");
    await sample();
  }
  await expect(slider).toHaveAttribute("aria-valuetext", "60%");

  // The measured number lands: no "≈", no skeleton.
  await expect(readout.getByRole("status")).toHaveCount(0, { timeout: 15_000 });
  await expect(readout).toContainText("KB");
  await expect(readout).not.toContainText("≈");
  const measured = await readout.locator("span.tabular-nums").first().textContent();
  await sample();

  const seen = await page.evaluate(() => (window as unknown as { __weights: string[] }).__weights);
  const estimates = seen.filter((t) => t.includes("≈"));
  console.info(
    `opened at ${startQuality} · PNG lossless ${lossless} · measured at 60: ${measured} · ${seen.length} readouts · with "≈": ${JSON.stringify(estimates.slice(0, 3))}`,
  );
  expect(startQuality).not.toBe("60%");
  expect(seen.length).toBeGreaterThan(1);
  expect(estimates).toEqual([]);
  expect(measured).not.toBe(lossless); // the reduced size, not the lossless one
});
