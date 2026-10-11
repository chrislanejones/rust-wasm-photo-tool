import { test, expect } from "./guard/test";
import { join } from "node:path";

const fixtures = ["checker.png", "sky-building.png"].map((name) =>
  join(__dirname, "fixtures", name),
);

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.route("**/*", (route) => {
    const url = route.request().url();
    return /^https?:\/\/(localhost|127\.0\.0\.1)[:/]/.test(url) ||
      url.startsWith("blob:") || url.startsWith("data:")
      ? route.continue() : route.abort();
  });
  await page.goto("/");
  await page.locator('input[type="file"]').first().setInputFiles(fixtures);
  await expect(page.locator('[aria-label^="Select photo"]:visible')).toHaveCount(2);
});

for (const key of ["Enter", "Space"]) {
  test(`gallery Remove opens its confirmation with ${key}`, async ({ page }) => {
    const tiles = page.locator('[aria-label^="Select photo"]:visible');
    const remove = tiles.last().getByRole("button", { name: "Remove image", exact: true });
    await remove.focus();
    await page.keyboard.press(key);
    const dialog = page.getByRole("dialog", { name: "Delete this image?" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(tiles).toHaveCount(2);
    await remove.focus();
    await page.keyboard.press(key);
    await dialog.getByRole("button", { name: "Delete image", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(tiles).toHaveCount(1);
  });

  test(`gallery Select toggles without activating the photo with ${key}`, async ({ page }) => {
    const tiles = page.locator('[aria-label^="Select photo"]:visible');
    await expect(tiles.locator('[aria-pressed="true"]')).toHaveCount(0);
    const inactive = page.locator('[aria-label^="Select photo"][aria-pressed="false"]:visible').first();
    const photoName = await inactive.getAttribute("aria-label");
    const tile = page.getByRole("button", { name: photoName!, exact: true }).filter({ visible: true });
    const select = tile.getByRole("button", { name: "Select image", exact: true });
    await select.focus();
    await page.keyboard.press(key);
    await expect(select).toHaveAttribute("aria-pressed", "true");
    await expect(tile).toHaveAttribute("aria-pressed", "false");
    await page.keyboard.press(key);
    await expect(select).toHaveAttribute("aria-pressed", "false");
    await expect(tile).toHaveAttribute("aria-pressed", "false");
    // Activating the tile itself must still select the photo.
    await tile.focus();
    await page.keyboard.press(key);
    await expect(tile).toHaveAttribute("aria-pressed", "true");
  });
}
