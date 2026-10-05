import { test, expect } from "@playwright/test";
import { join } from "node:path";

// Plan A §5 — a photo import shows a skeleton tile for each file still being
// opened, at a thumbnail's box, and every one becomes a photo (or goes away on
// error). Slowed with CPU throttling so the 300 ms grace is actually exceeded.
test.setTimeout(180_000);

const FIX = [join(__dirname, "fixtures", "sky-building.png"), join(__dirname, "fixtures", "checker.png")];

test("a slow import shows skeleton tiles that turn into photos", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  const input = page.locator('input[type="file"]').first();
  await input.waitFor({ state: "attached" });
  const cdp = await page.context().newCDPSession(page);
  // Files first, THEN throttle: setInputFiles itself stalls under heavy CPU
  // throttling. The decode loop that follows is what we want slowed.
  await input.setInputFiles([FIX[0]!, FIX[1]!, FIX[0]!, FIX[1]!, FIX[0]!]);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 20 });
  // :visible — the vertical gallery is mounted (hidden) beside the strip.
  const pending = page.locator('[data-testid="pending-import"]:visible');
  await expect(pending.first()).toBeVisible({ timeout: 60_000 });
  // Same box as a real thumbnail, so nothing jumps when it lands.
  // Measured in ONE evaluate: under throttling a tile can land between two
  // separate locator calls.
  const boxes = await page.evaluate(() => {
    const vis = (e: Element) => (e as HTMLElement).offsetParent !== null;
    const real = [...document.querySelectorAll('[aria-label^="Select photo"]')].find(vis);
    const skel = [...document.querySelectorAll('[data-testid="pending-import"]')].find(vis);
    const r = (e?: Element) => (e ? { w: Math.round(e.getBoundingClientRect().width), h: Math.round(e.getBoundingClientRect().height) } : null);
    return { real: r(real), skel: r(skel) };
  });
  expect(boxes.skel, "a skeleton tile is on screen").not.toBeNull();
  expect(boxes.real, "a real thumbnail is on screen").not.toBeNull();
  // Same box as a real thumbnail, so nothing jumps when it lands.
  expect(boxes.skel).toEqual(boxes.real);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
  await expect(pending).toHaveCount(0, { timeout: 120_000 });
  await expect(page.locator('[aria-label^="Select photo"]:visible')).toHaveCount(5);
});

test("the phone grid shows the same skeleton tiles during an import", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const input = page.locator('input[type="file"]').first();
  await input.waitFor({ state: "attached" });
  const cdp = await page.context().newCDPSession(page);
  await input.setInputFiles([FIX[0]!, FIX[1]!, FIX[0]!, FIX[1]!, FIX[0]!]);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 20 });
  const pending = page.locator('[data-testid="pending-import"]:visible');
  await expect(pending.first()).toBeVisible({ timeout: 60_000 });
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
  await expect(pending).toHaveCount(0, { timeout: 120_000 });
  await expect(page.locator('[aria-label^="View photo"]:visible')).toHaveCount(5);
});
