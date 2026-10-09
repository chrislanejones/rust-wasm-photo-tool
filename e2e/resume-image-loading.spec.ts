import { test, expect } from "./guard/test";
import { join } from "node:path";
import { blockExternalNetwork } from "./gallery-skeleton-harness";

test("resume thumbnails reserve space through loading and failure", async ({ page }, info) => {
  await blockExternalNetwork(page);
  await page.goto("/");
  await page.locator('input[type="file"]').first().setInputFiles([
    join(__dirname, "fixtures/checker.png"), join(__dirname, "fixtures/sky-building.png"),
  ]);
  await expect(page.locator("[data-id] img")).toHaveCount(2);
  // Persist the session before restarting. No real backend is involved.
  await page.waitForTimeout(1000);
  await page.addInitScript(() => {
    URL.createObjectURL = () => `${location.origin}/held-thumbnail.png`;
  });
  let release!: () => void;
  const held = new Promise<void>((resolve) => { release = resolve; });
  await page.route("**/held-thumbnail.png", async (route) => {
    await held;
    await route.abort("failed");
  });
  await page.reload();
  await expect(page.getByText("Welcome back", { exact: true })).toBeVisible();
  const card = page.getByText("Welcome back", { exact: true }).locator("..");
  await page.waitForTimeout(400);
  for (const theme of ["light", "dark"]) {
    await page.evaluate((dark) => document.documentElement.classList.toggle("dark", dark), theme === "dark");
    await card.screenshot({ path: info.outputPath(`resume-loading-${theme}.png`), animations: "disabled" });
  }
  const before = await card.boundingBox();
  await expect(card.locator(".skeleton")).toHaveCount(2);
  release();
  await expect(card.getByRole("img", { name: /could not be displayed/ })).toHaveCount(2);
  await expect(card.locator(".skeleton")).toHaveCount(0);
  expect(await card.boundingBox()).toEqual(before);
  await expect(page.getByRole("button", { name: "Resume editing" })).toBeEnabled();
});
