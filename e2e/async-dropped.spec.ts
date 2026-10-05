import { test, expect, type Page } from "@playwright/test";
import { join } from "node:path";

// Plan C §3 — a superseded engine request resolves as "dropped". Rapid photo
// switching replaces the engine document under requests still in flight
// (syncState's capture, the switch's own undo_count read); none of them may
// surface as an unhandled rejection.
test.setTimeout(180_000);
const FIX = [join(__dirname, "fixtures", "checker.png"), join(__dirname, "fixtures", "sky-building.png")];

async function blockExternalNetwork(page: Page): Promise<void> {
  await page.route("**/*", (route) => {
    const url = route.request().url();
    if (/^https?:\/\/(localhost|127\.0\.0\.1)[:/]/.test(url) || url.startsWith("blob:") || url.startsWith("data:")) return route.continue();
    return route.abort();
  });
}

test("hammering PgDn/PgUp leaves no unhandled 'engine document replaced'", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await blockExternalNetwork(page);
  await page.goto("/");
  const input = page.locator('input[type="file"]').first();
  await input.waitFor({ state: "attached" });
  await input.setInputFiles([FIX[0]!, FIX[1]!, FIX[0]!, FIX[1]!]);
  await page.locator("canvas.main-canvas").waitFor({ state: "visible", timeout: 60_000 });
  await page.waitForTimeout(3000);
  // Edit, so the switch has an outgoing save and syncState runs mid-load.
  await page.getByRole("button", { name: "Enhance", exact: true }).first().click();
  await page.getByRole("button", { name: "Adjustments", exact: true }).first().click();
  // Slow the CPU so engine replies are still in flight when the next switch
  // replaces the document — the window this test exists to hit.
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 6 });
  const slider = page.locator('[data-slot="control-row"]').filter({ hasText: "Brightness" }).first().getByRole("slider");
  for (let round = 0; round < 6; round++) {
    const b = (await slider.boundingBox())!;
    await page.mouse.click(b.x + b.width * (0.55 + round * 0.05), b.y + b.height / 2);
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    for (let i = 0; i < 6; i++) await page.keyboard.press(i % 2 ? "PageUp" : "PageDown");
    await page.waitForTimeout(150);
  }
  await page.waitForTimeout(4000);
  expect(errors.filter((e) => /engine document replaced|engine released/.test(e))).toEqual([]);
});
