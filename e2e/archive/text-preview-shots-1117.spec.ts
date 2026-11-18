import { test, expect } from "../guard/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { installAnnotationProbe, screenPoint } from "../annotation-benchmark-harness";

// ─────────────────────────────────────────────────────────────────────────────
// Night 11-17 (ADR-106): the same text in the preview and committed, at 1280.
// Run once on master (before) and once on fix/text-preview-size (after), each
// against a preview already serving that build on PW_PORT, with SHOTS_TAG set
// to "before" or "after". Synthetic fixture only. Kept in archive/ as the
// record; not part of the suite. A throwaway root config points at it:
//   // playwright.shots.config.ts
//   import base from "./playwright.config";
//   export default { ...base, testIgnore: [], testDir: "./e2e/archive", testMatch: /text-preview-shots/ };
// ─────────────────────────────────────────────────────────────────────────────

const FIXTURE_PNG = join(__dirname, "..", "fixtures", "paper-1200x900.png");
const OUT = join(__dirname, "..", "..", "docs", "day-logs", "2026-11-18");

test("text preview vs committed at 1280", async ({ page }) => {
  const tag = process.env.SHOTS_TAG ?? "shot";
  mkdirSync(OUT, { recursive: true });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    return ["localhost", "127.0.0.1"].includes(url.hostname) || ["blob:", "data:"].includes(url.protocol)
      ? route.continue() : route.abort();
  });
  await page.addInitScript(() => {
    const was = JSON.parse(localStorage.getItem("image-horse-prefs") ?? "{}");
    localStorage.setItem("image-horse-prefs", JSON.stringify({ ...was, canvasArtboard: false }));
  });
  await page.goto("/");
  await page.locator('input[type="file"]').first().setInputFiles(FIXTURE_PNG);
  await expect.poll(() => page.locator("canvas.main-canvas").getAttribute("width")).toBe("1200");
  await installAnnotationProbe(page);
  await page.getByRole("button", { name: "Create", exact: true }).first().click();
  await page.getByRole("button", { name: "Text", exact: true }).first().click();
  const panel = page.getByRole("region", { name: "Tool options" });
  const slider = panel.getByRole("slider", { name: "Font Size" });
  await slider.focus();
  for (let i = 24; i < 72; i++) await page.keyboard.press("ArrowRight");

  const at = await screenPoint(page, 120, 220);
  await page.mouse.click(at.x, at.y);
  await page.locator("textarea").first().fill("HHHHHHHH\nThe quick brown fox");
  const a = await screenPoint(page, 60, 120);
  const b = await screenPoint(page, 900, 470);
  const clip = { x: a.x, y: a.y, width: b.x - a.x, height: b.y - a.y };
  await page.mouse.move(2, 2);
  const hide = await page.addStyleTag({ content: "textarea{caret-color:transparent!important}" });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(OUT, `text-preview-${tag}-1-preview.png`), clip });
  await hide.evaluate((el) => el.remove());

  const away = await screenPoint(page, 1150, 870);
  await page.mouse.click(away.x, away.y);
  await page.waitForTimeout(600);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(600);
  await page.screenshot({ path: join(OUT, `text-preview-${tag}-2-committed.png`), clip });
});
