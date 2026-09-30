import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// SVG → SVG: an uploaded SVG can be cropped and downloaded as an SVG, alone or
// zipped with the others. The SVG tile is in both Format pickers and stays
// disabled until an SVG is open. (lib/svgPassthrough.ts)

const FIXTURE_PNG = join(__dirname, "fixtures", "checker.png");
const SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200" viewBox="0 0 20 10"><rect width="10" height="10" fill="red"/><rect x="10" width="10" height="10" fill="blue"/></svg>`;

async function blockExternalNetwork(page: Page): Promise<void> {
  await page.route("**/*", (route) => {
    const url = route.request().url();
    return /^https?:\/\/(localhost|127\.0\.0\.1)[:/]/.test(url) ||
      url.startsWith("blob:") ||
      url.startsWith("data:")
      ? route.continue()
      : route.abort();
  });
}

async function upload(page: Page, files: { name: string; mimeType: string; buffer: Buffer }[]) {
  const input = page.locator('input[type="file"]').first();
  await input.waitFor({ state: "attached" });
  await input.setInputFiles(files);
  await page.locator("canvas.main-canvas").waitFor({ state: "visible", timeout: 30_000 });
  await expect
    .poll(() => page.locator("canvas.main-canvas").evaluate((c: HTMLCanvasElement) => c.width), {
      timeout: 30_000,
    })
    .toBeGreaterThan(0);
  await page.waitForTimeout(1200);
}

const svgFile = (name: string) => ({ name, mimeType: "image/svg+xml", buffer: Buffer.from(SVG) });
const pngFile = () => ({ name: "checker.png", mimeType: "image/png", buffer: readFileSync(FIXTURE_PNG) });

async function openExportDialog(page: Page) {
  await page.getByRole("button", { name: "Export", exact: true }).first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible({ timeout: 10_000 });
  return dialog;
}

async function downloadText(page: Page, act: () => Promise<void>) {
  const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 30_000 }), act()]);
  const path = await dl.path();
  return { name: dl.suggestedFilename(), bytes: readFileSync(path!) };
}

test.beforeEach(async ({ page }) => {
  await blockExternalNetwork(page);
  await page.goto("/");
});

test("the SVG tile is disabled for a raster image", async ({ page }) => {
  await upload(page, [pngFile()]);
  const dialog = await openExportDialog(page);
  const svg = dialog.getByRole("radio", { name: /^SVG/ });
  await expect(svg).toBeDisabled();
  await expect(svg).toContainText("SVG uploads only");
});

test("an untouched SVG downloads byte-for-byte, a cropped one with its viewBox cropped", async ({
  page,
}) => {
  await upload(page, [svgFile("shapes.svg")]);

  let dialog = await openExportDialog(page);
  await dialog.getByRole("radio", { name: /^SVG/ }).click();
  await expect(dialog.getByRole("button", { name: "Download SVG" })).toBeVisible();
  let dl = await downloadText(page, () =>
    dialog.getByRole("button", { name: "Download SVG" }).click(),
  );
  expect(dl.name).toBe("shapes-revised.svg");
  expect(dl.bytes.toString("utf8")).toBe(SVG);

  // Crop to a centered square.
  const opts = page.getByRole("region", { name: "Tool options" });
  await opts.getByRole("button", { name: "Edit", exact: true }).first().click();
  await opts.getByRole("button", { name: "Crop", exact: true }).first().click();
  await page.getByRole("radiogroup", { name: "Ratio" }).getByRole("radio", { name: "1:1" }).click();
  await page.getByRole("button", { name: "Apply Crop" }).click();
  await page.waitForTimeout(800);

  dialog = await openExportDialog(page);
  await dialog.getByRole("radio", { name: /^SVG/ }).click();
  dl = await downloadText(page, () => dialog.getByRole("button", { name: "Download SVG" }).click());
  const text = dl.bytes.toString("utf8");
  const vb = text.match(/viewBox="([^"]+)"/)![1].split(" ").map(Number);
  // A centered square of a 20×10 drawing: ~10 wide, starting ~5 in.
  expect(vb[0]).toBeGreaterThan(4);
  expect(vb[0]).toBeLessThan(6);
  expect(vb[2]).toBeGreaterThan(9);
  expect(vb[2]).toBeLessThan(11);
  // The drawing itself is untouched.
  expect(text).toContain('<rect x="10" width="10" height="10" fill="blue"/>');
});

test("All Images zips just the SVGs", async ({ page }) => {
  await upload(page, [svgFile("one.svg"), pngFile(), svgFile("two.svg")]);
  const dialog = await openExportDialog(page);
  await dialog.getByText(/^Download All Images/).click();
  await dialog.getByRole("radio", { name: /^SVG/ }).click();
  const button = dialog.getByRole("button", { name: "Download 2 as SVG" });
  await expect(button).toBeVisible();
  await expect(dialog.getByText(/the others are left out/)).toBeVisible();
  const dl = await downloadText(page, () => button.click());
  expect(dl.name).toBe("svgs.zip");
  const zip = dl.bytes.toString("latin1");
  expect(zip).toContain("one.svg");
  expect(zip).toContain("two.svg");
  expect(zip).not.toContain("checker");
});
