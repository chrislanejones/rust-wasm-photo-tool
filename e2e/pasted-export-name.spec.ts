import { test, expect } from "./guard/test";
import type { Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// ─────────────────────────────────────────────────────────────────────────────
// A pasted image exports as `pasted-revised`, not `image-revised` (Chris,
// 2026-09-15).
//
// The browser hands a pasted screenshot over as a File named `image.png`. The
// gallery name is that filename minus its extension and export appends
// `-revised`, so every paste used to download as `image-revised.png`.
// `lib/pastedImageName.ts` renames generic clipboard names at every paste entry
// point; this spec drives the real surfaces end to end:
//   1. start screen Ctrl+V          (NewActions)
//   2. editor Ctrl+V → "New gallery image"   (AppShell → import dialog)
//   3. control: a REAL filename pasted keeps it — without this, a rename that
//      turned EVERY paste into `pasted` would pass 1 and 2 too
//
// The paste is a synthetic ClipboardEvent carrying a File, because the real
// clipboard cannot be driven headless. What it can't prove is the name a real
// browser gives a real screenshot; `image.png` is Chromium's.
// ─────────────────────────────────────────────────────────────────────────────

const FIXTURE_PNG = join(__dirname, "fixtures", "checker.png");
const FIXTURE_B64 = readFileSync(FIXTURE_PNG).toString("base64");

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

async function waitForCanvas(page: Page): Promise<void> {
  await page.locator("canvas.main-canvas").waitFor({ state: "visible", timeout: 30_000 });
  await expect
    .poll(
      () =>
        page.evaluate(
          () => document.querySelector<HTMLCanvasElement>("canvas.main-canvas")?.width ?? 0,
        ),
      { timeout: 30_000 },
    )
    .toBeGreaterThan(0);
  await page.waitForTimeout(1000);
}

/** Fire a native-shaped paste carrying one PNG under `name`. */
async function pastePng(page: Page, name: string): Promise<void> {
  await page.evaluate(
    ({ b64, name }) => {
      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const dt = new DataTransfer();
      dt.items.add(new File([bytes], name, { type: "image/png" }));
      window.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true }));
    },
    { b64: FIXTURE_B64, name },
  );
}

/** Alt+E → handleExport, the same call the Export dialog's Download tile makes. */
async function exportedStem(page: Page): Promise<string> {
  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout: 30_000 }),
    page.keyboard.press("Alt+KeyE"),
  ]);
  const name = download.suggestedFilename();
  console.log(`  exported as: ${name}`);
  return name.replace(/\.[^.]+$/, "");
}

async function openEditorWithFixture(page: Page): Promise<void> {
  const fileInput = page.locator('input[type="file"]');
  await fileInput.waitFor({ state: "attached" });
  await fileInput.setInputFiles(FIXTURE_PNG);
  await waitForCanvas(page);
}

async function pasteIntoEditorAsNewImage(page: Page, name: string): Promise<void> {
  await pastePng(page, name);
  const dialog = page.getByRole("dialog", { name: "Add this image" });
  await dialog.waitFor({ state: "visible" });
  await dialog.getByRole("button", { name: /New gallery image/ }).click();
  await dialog.waitFor({ state: "hidden" });
  await waitForCanvas(page);
}

test.beforeEach(async ({ page }) => {
  await blockExternalNetwork(page);
  await page.goto("/");
});

test("start screen: a pasted screenshot exports as pasted-revised", async ({ page }) => {
  await page.locator('input[type="file"]').waitFor({ state: "attached" });
  await pastePng(page, "image.png");
  await waitForCanvas(page);
  expect(await exportedStem(page)).toBe("pasted-revised");
});

test("editor: a pasted screenshot added as a new image exports as pasted-revised", async ({ page }) => {
  await openEditorWithFixture(page);
  // Control inside the test: before the paste, the open photo exports under
  // its own name — so the assertion below is about the paste, not a constant.
  expect(await exportedStem(page)).toBe("checker-revised");
  await pasteIntoEditorAsNewImage(page, "image.png");
  expect(await exportedStem(page)).toBe("pasted-revised");
});

test("editor: a pasted file with a real name keeps it", async ({ page }) => {
  await openEditorWithFixture(page);
  await pasteIntoEditorAsNewImage(page, "beach.png");
  expect(await exportedStem(page)).toBe("beach-revised");
});
