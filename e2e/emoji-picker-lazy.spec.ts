import { test, expect } from "./guard/test";
import { join } from "node:path";

// Create › Emoji: the emoji list (`@emoji-mart/data`, ~80 KB gzipped) is no
// longer in the main chunk. emoji-mart gets it as an async function and
// fetches it the first time the picker opens. This pins that the picker still
// fills: a `data` the picker can't resolve renders an empty grid and nothing
// else notices.
const FIXTURE_PNG = join(__dirname, "fixtures", "paper-1200x900.png");

test("the emoji picker loads its list when it opens", async ({ page }) => {
  const scripts: string[] = [];
  page.on("request", (r) => {
    if (r.resourceType() === "script") scripts.push(r.url());
  });
  // No artboard frame, so the canvas is the photo's own 1200 px (as stamps.spec).
  await page.addInitScript(() => {
    const was = JSON.parse(localStorage.getItem("image-horse-prefs") ?? "{}");
    localStorage.setItem("image-horse-prefs", JSON.stringify({ ...was, canvasArtboard: false }));
  });
  await page.goto("/");
  await page.locator('input[type="file"]').first().setInputFiles(FIXTURE_PNG);
  await expect.poll(() => page.locator("canvas.main-canvas").getAttribute("width")).toBe("1200");
  const before = scripts.length;

  await page.getByRole("button", { name: "Create", exact: true }).first().click();
  await page.getByRole("button", { name: "Emoji", exact: true }).first().click();

  const picker = page.locator(".emoji-picker-host em-emoji-picker");
  await expect(picker).toBeVisible();
  // emoji-mart draws into an open shadow root; Playwright's CSS locators
  // pierce it. Its emoji buttons are labeled with the emoji itself.
  await expect(picker.locator("button[aria-label='😀']").first()).toBeVisible({ timeout: 15_000 });
  expect(scripts.length, "opening the picker fetched the emoji list as its own script").toBeGreaterThan(before);
});
