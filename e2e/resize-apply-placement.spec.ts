import { test, expect, type Page } from "@playwright/test";
import { join } from "node:path";

// ─────────────────────────────────────────────────────────────────────────────
// The Resize tool's footer sits OUTSIDE its ToolModeToggle, so every button in
// it renders under both tiles unless something says otherwise. "Apply Resize"
// therefore appeared while the user was in Compress — a button whose own
// tooltip says it does not compress, offered mid-compression.
//
// It hid for months because it is disabled unless the pixel dimensions
// changed, and the dimension fields live in the Resize tile: greyed out reads
// as "not for me right now", not "wrong panel". The Compress percent slider
// changes dimensions too, so it was reachable ENABLED from the wrong tile.
//
// Its sibling is deliberately NOT gated: "Apply Compression & Resize" is the
// commit-everything action and the one that unlocks A/B Compare, so it belongs
// under both tiles. This spec pins BOTH halves of that asymmetry — a future
// tidy-up that gates them together would be a regression.
// ─────────────────────────────────────────────────────────────────────────────

const FIXTURE_PNG = join(__dirname, "fixtures", "checker.png");

async function blockExternalNetwork(page: Page): Promise<void> {
  await page.route("**/*", (route) => {
    const url = route.request().url();
    if (
      /^https?:\/\/(localhost|127\.0\.0\.1)[:/]/.test(url) ||
      url.startsWith("blob:") ||
      url.startsWith("data:")
    ) {
      return route.continue();
    }
    return route.abort();
  });
}

async function importFixture(page: Page): Promise<void> {
  const fileInput = page.locator('input[type="file"]');
  await fileInput.waitFor({ state: "attached" });
  await fileInput.setInputFiles(FIXTURE_PNG);
  await page.locator("canvas.main-canvas").waitFor({ state: "visible", timeout: 30_000 });
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            document.querySelector<HTMLCanvasElement>("canvas.main-canvas")?.width ?? 0,
        ),
      { timeout: 30_000 },
    )
    .toBeGreaterThan(0);
  await page.waitForTimeout(1000);
}

test("Apply Resize renders under the Resize tile only", async ({ page }) => {
  await blockExternalNetwork(page);
  await page.goto("/");
  await importFixture(page);

  // Compress and Resize are sub-tools of the ENHANCE group, not Edit.
  await page.getByRole("button", { name: "Enhance", exact: true }).first().click();
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: "Compress", exact: true }).first().click();
  await page.waitForTimeout(900);

  const applyResize = page.getByRole("button", { name: /^Apply Resize$/ });
  const applyBoth = page.getByRole("button", { name: /Apply Compression & Resize/ });

  // ── Compress tile: the resize-only button must be absent.
  expect(await applyResize.count(), "Apply Resize must NOT render in Compress").toBe(0);
  expect(await applyBoth.count(), "Apply Compression & Resize stays in Compress").toBe(1);

  // ── Resize tile: it comes back, and its sibling is still there too.
  await page.getByRole("button", { name: "Resize", exact: true }).first().click();
  await page.waitForTimeout(900);
  expect(await applyResize.count(), "Apply Resize must render in Resize").toBe(1);
  expect(await applyBoth.count(), "Apply Compression & Resize stays in Resize").toBe(1);

  // ── The shared footer still lays out: gating in place must not collapse the
  // full-width buttons. Both tiles should report the same geometry.
  const width = async (re: RegExp) =>
    page.evaluate((src) => {
      const rx = new RegExp(src);
      const b = Array.from(document.querySelectorAll("button")).find((x) =>
        rx.test((x.textContent ?? "").trim()),
      );
      const r = b?.getBoundingClientRect();
      return r ? Math.round(r.width) : 0;
    }, re.source);

  const resizeW = await width(/^Apply Resize$/);
  const bothW = await width(/Apply Compression/);
  console.log(`[placement] Resize tile widths — Apply Resize ${resizeW}px, Apply Both ${bothW}px`);
  expect(resizeW, "Apply Resize is full-width").toBeGreaterThan(100);
  expect(bothW, "Apply Compression & Resize is full-width").toBeGreaterThan(100);
  expect(Math.abs(resizeW - bothW), "the two footer buttons match width").toBeLessThanOrEqual(2);
});
