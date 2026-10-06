import { test, expect } from "./guard/test";
import type { Page } from "@playwright/test";
import { join } from "node:path";
import { readFileSync } from "node:fs";

// A collapsed section is named for what is inside it (Chris, 10-05-2026).
// Shapes and Text fold their placement grid away; the header says
// "Placement", not "Advanced", and the grid inside has no second heading.

const FIXTURE_PNG = join(__dirname, "fixtures", "checker.png");

async function blockExternalNetwork(page: Page): Promise<void> {
  await page.route("**/*", (route) => {
    const url = route.request().url();
    if (/^https?:\/\/(localhost|127\.0\.0\.1)[:/]/.test(url) || url.startsWith("blob:") || url.startsWith("data:")) {
      return route.continue();
    }
    return route.abort();
  });
}

test.beforeEach(async ({ page }) => {
  await blockExternalNetwork(page);
  await page.goto("/");
  const input = page.locator('input[type="file"]').first();
  await input.waitFor({ state: "attached" });
  await input.setInputFiles({ name: "checker.png", mimeType: "image/png", buffer: readFileSync(FIXTURE_PNG) });
  await page.locator("canvas.main-canvas").waitFor({ state: "visible", timeout: 30_000 });
});

for (const sub of ["Shapes", "Text"]) {
  test(`${sub}: the collapsed section is called Placement, and nothing says Advanced`, async ({ page }) => {
    const panel = page.getByRole("region", { name: "Tool options" });
    await panel.getByRole("button", { name: "Create", exact: true }).first().click();
    await panel.getByRole("button", { name: sub, exact: true }).first().click();

    const header = panel.getByRole("button", { name: "Placement", exact: true });
    await expect(header).toHaveAttribute("aria-expanded", "false");
    await expect(panel.getByText("Advanced", { exact: false })).toHaveCount(0);
    // The lightbulb rides beside the header, named for it.
    await expect(panel.getByRole("button", { name: /Placement/ }).and(panel.locator(":not([aria-expanded])"))).toHaveCount(1);

    await header.click();
    await expect(header).toHaveAttribute("aria-expanded", "true");
    // The grid keeps its accessible name, and shows no second "Placement" heading.
    await expect(panel.getByRole("group", { name: "Placement" }).or(panel.getByRole("radiogroup", { name: "Placement" }))).toHaveCount(1);
    await expect(panel.getByText("Placement", { exact: true })).toHaveCount(1);
  });
}
