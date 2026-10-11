import { test, expect } from "./guard/test";
import { join } from "node:path";

const fixtures = ["checker.png", "sky-building.png"].map(name => join(__dirname, "fixtures", name));

for (const layout of [
  { name: "desktop", width: 1280, height: 800 },
  { name: "dock", width: 900, height: 900 },
  { name: "phone", width: 390, height: 844 },
]) {
  for (const theme of ["light", "dark"] as const) {
    test(`${layout.name} ${theme}: document identity, keyboard focus and supported controls`, async ({ page }) => {
      await page.setViewportSize(layout);
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.route("**/*", route => /^(?:https?:\/\/(?:localhost|127\.0\.0\.1)[:/]|blob:|data:)/.test(route.request().url()) ? route.continue() : route.abort());
      await page.addInitScript(theme => localStorage.setItem("image-horse-prefs", JSON.stringify({ theme })), theme);
      await page.goto("/");
      if (layout.name === "phone") await page.getByRole("button", { name: "Got it", exact: true }).click();
      if (layout.name === "dock") await page.getByRole("button", { name: "Continue", exact: true }).click();
      await page.locator('input[type="file"]').first().setInputFiles(fixtures);
      expect(await page.locator("html").evaluate(el => getComputedStyle(el).colorScheme)).toBe(theme);
      if (layout.name === "phone") {
        await expect(page.getByRole("button", { name: /^View photo / })).toHaveCount(2);
        await page.getByRole("button", { name: "View photo sky-building", exact: true }).click();
        await expect(page.getByRole("button", { name: "Download image", exact: true })).toBeVisible();
        await expect(page.locator(".app-shell")).toHaveAttribute("inert", "");
      } else {
        await expect(page.locator("canvas.main-canvas")).toBeVisible();
        await expect.poll(() => page.locator("canvas.main-canvas").evaluate((canvas: HTMLCanvasElement) => `${canvas.width}x${canvas.height}`)).toBe("276x276");
        await expect(page.locator('[data-testid="pending-import"]')).toHaveCount(0);
        await expect(page.locator(".per-photo-name")).toContainText("1 of 2");
        await expect(page.getByRole("dialog")).toHaveCount(0);
        await expect(page.locator('[data-document-locked="true"]')).toHaveCount(0);
        await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
        await page.keyboard.press("PageDown");
        await expect.poll(() => page.locator("canvas.main-canvas").evaluate((canvas: HTMLCanvasElement) => `${canvas.width}x${canvas.height}`)).toBe("1220x820");
        await expect(page.getByRole("status").filter({ hasText: /^Switched to sky-building$/ })).toHaveCount(1);
        await expect(page.locator('[data-document-locked="true"]')).toHaveCount(0);
        if (layout.name === "dock") await page.getByRole("button", { name: "Tools", exact: true }).click();
        await expect(page.locator(".per-photo-name")).toContainText("sky-building");
      }
      // The browser's real tab order must never land inside a switching/inert region.
      await page.keyboard.press("Tab");
      expect(await page.evaluate(() => {
        const active = document.activeElement as HTMLElement | null;
        return !!active && active !== document.body && !active.closest("[inert]");
      })).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: `test-results/state-v4-night7-${layout.name}-${theme}.png` });
    });
  }
}

test("diagnostics image metadata stays neutral while switching documents", async ({ page }) => {
  await page.route("**/*", route => /^(?:https?:\/\/(?:localhost|127\.0\.0\.1)[:/]|blob:|data:)/.test(route.request().url()) ? route.continue() : route.abort());
  await page.goto("/");
  await page.locator('input[type="file"]').first().setInputFiles(fixtures);
  await expect(page.locator(".per-photo-name")).toContainText("1 of 2");
  await expect(page.locator('[data-document-locked="true"]')).toHaveCount(0);
  await page.keyboard.press("Alt+Delete");
  const dialog = page.getByRole("dialog", { name: "Diagnostics Window" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("tab", { name: "Current Image Meta", exact: true }).click();
  const size = dialog.getByText("Current size", { exact: true }).locator("..");
  const dimensions = () => page.locator("canvas.main-canvas").evaluate((canvas: HTMLCanvasElement) => `${canvas.width} × ${canvas.height}`);
  await expect(size).toContainText(await dimensions());
  await page.evaluate(() => {
    const audit = { locked: false, stale: false };
    (window as unknown as { metadataAudit: typeof audit }).metadataAudit = audit;
    new MutationObserver(() => {
      if (!document.querySelector('[data-document-locked="true"]')) return;
      audit.locked = true;
      const label = [...document.querySelectorAll("span")].find(node => node.textContent === "Current size");
      if (/\d+\s*×\s*\d+/.test(label?.parentElement?.textContent ?? "")) audit.stale = true;
    }).observe(document.body, { childList: true, attributes: true, subtree: true });
  });
  await page.keyboard.press("PageDown");
  await expect.poll(dimensions).toBe("1220 × 820");
  await expect(size).toContainText("1220 × 820");
  expect(await page.evaluate(() => (window as unknown as { metadataAudit: { locked: boolean; stale: boolean } }).metadataAudit)).toEqual({ locked: true, stale: false });
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
});
