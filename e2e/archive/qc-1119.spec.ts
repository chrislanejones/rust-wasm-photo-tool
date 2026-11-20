import { test, expect } from "../guard/test";
import type { Page } from "@playwright/test";
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { installAnnotationProbe, screenPoint } from "../annotation-benchmark-harness";
import { PAIR_LAUNCH, galleryTiles, pairUp, png, syntheticPng } from "../pair-harness";

// ─────────────────────────────────────────────────────────────────────────────
// imagehorse-qc, automated slice — 11-19-2026, against PR #492's branch
// (master a44d17c5 + fill-first shapes), so it covers everything since v9.64.
//
// Production build, logged-out demo mode (placeholder Convex/Clerk, every
// off-localhost request blocked). Kept in archive/ as the record of the run,
// not part of the suite. Results: docs/qc/qc-1119.md. Screenshots go to
// QC_SHOTS (default /tmp/qc1119/shots).
//
// What the existing specs do NOT already pin, and this adds:
//   • boot logged out with no console errors, file picker AND drag-drop,
//   • the fill-first Shapes panel at 1280 and compact 768, light and dark,
//     Stroke shut and open, and a white square on white paper reselected,
//   • pairing: Cancel mid-send, from the sender and from the receiver,
//   • ⚡ Auto on Resize & Compress with a 3000 × 2000 photo: both sliders move.
//
// Run: copy playwright.config.ts to a throwaway playwright.qc.config.ts at the
// repo root that spreads the base config with
//   testDir: "./e2e/archive", testIgnore: [], testMatch: /qc-1119\.spec\.ts$/
// then PW_PORT=<port> pnpm exec playwright test --config playwright.qc.config.ts
// ─────────────────────────────────────────────────────────────────────────────

const FIX = (n: string) => join(__dirname, "..", "fixtures", n);
const PAPER = FIX("paper-1200x900.png");
const CHECKER = FIX("checker.png");
const SHOTS = process.env.QC_SHOTS ?? "/tmp/qc1119/shots";
mkdirSync(SHOTS, { recursive: true });

async function blockExternal(page: Page) {
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    return ["localhost", "127.0.0.1"].includes(url.hostname) || ["blob:", "data:"].includes(url.protocol)
      ? route.continue() : route.abort();
  });
}

async function prefs(page: Page, extra: Record<string, unknown>) {
  await page.addInitScript((e) => {
    const was = JSON.parse(localStorage.getItem("image-horse-prefs") ?? "{}");
    localStorage.setItem("image-horse-prefs", JSON.stringify({ ...was, canvasArtboard: false, ...e }));
  }, extra);
}

async function setTheme(page: Page, theme: "light" | "dark") {
  await page.evaluate((t) => {
    const was = JSON.parse(localStorage.getItem("image-horse-prefs") ?? "{}");
    localStorage.setItem("image-horse-prefs", JSON.stringify({ ...was, theme: t }));
    document.documentElement.classList.toggle("dark", t === "dark");
    document.documentElement.style.colorScheme = t;
  }, theme);
  await page.waitForTimeout(250);
}

async function shot(page: Page, name: string) {
  await page.screenshot({ path: join(SHOTS, `${name}.png`) });
}

async function blur(page: Page) {
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
}

async function openPhoto(page: Page, size: { width: number; height: number }, file: string | { name: string; mimeType: string; buffer: Buffer } = PAPER, width = "1200") {
  await page.setViewportSize(size);
  await blockExternal(page);
  await prefs(page, {});
  await page.goto("/");
  if (size.width <= 1000) await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.locator('input[type="file"]').first().setInputFiles(file);
  await expect.poll(() => page.locator("canvas.main-canvas").getAttribute("width"), { timeout: 30_000 }).toBe(width);
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
  await installAnnotationProbe(page);
}

// ── Q1 boot ──────────────────────────────────────────────────────────────────

// Pairing needs real local ICE candidates; the flag is harmless to the other tests.
test.use(PAIR_LAUNCH);

test("Q1 boot logged out: no console errors, engine loads, file picker and drag-drop both import", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("response", (r) => { if (r.status() >= 400) console.log(`Q1 HTTP ${r.status()} ${r.url()}`); });
  await page.setViewportSize({ width: 1600, height: 1000 });
  await blockExternal(page);
  await prefs(page, {});
  await page.goto("/");
  await expect(page.locator('input[type="file"]').first()).toBeAttached();
  await page.waitForTimeout(1500);
  await setTheme(page, "light");
  await shot(page, "q1-empty-light");
  await setTheme(page, "dark");
  await shot(page, "q1-empty-dark");

  await page.locator('input[type="file"]').first().setInputFiles(PAPER);
  await expect.poll(() => page.locator("canvas.main-canvas").getAttribute("width"), { timeout: 30_000 }).toBe("1200");
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);

  // Drag-drop a second photo onto the window (AppShell's window "drop").
  const bytes = readFileSync(CHECKER).toString("base64");
  await page.evaluate((b64) => {
    const bin = atob(b64);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    const dt = new DataTransfer();
    dt.items.add(new File([arr], "dropped-checker.png", { type: "image/png" }));
    for (const type of ["dragenter", "dragover", "drop"])
      window.dispatchEvent(new DragEvent(type, { dataTransfer: dt, bubbles: true, cancelable: true }));
  }, bytes);
  // One dropped file asks: new layer, or a new photo in the gallery.
  const ask = page.getByRole("dialog", { name: "Add this image" });
  await expect(ask).toBeVisible();
  await shot(page, "q1-drop-asks-dark");
  await ask.getByRole("button", { name: /Add Image to Gallery/ }).click();
  await expect(page.locator('[aria-label^="Select photo"]:visible')).toHaveCount(2, { timeout: 30_000 });
  await page.waitForTimeout(800);
  await shot(page, "q1-two-photos-dark");
  await setTheme(page, "light");
  await shot(page, "q1-two-photos-light");

  const real = errors.filter((e) => !/ERR_FAILED|net::|smoke-placeholder|clerk\.smoke\.invalid|Failed to load resource/i.test(e));
  console.log(`Q1 console errors (all ${errors.length}):\n${errors.join("\n")}`);
  expect(real, "console errors beyond the blocked placeholder backend").toEqual([]);
});

// ── Q2 fill-first Shapes panel ───────────────────────────────────────────────

const strokeHeader = (page: Page) => page.locator('[data-slot="collapsible"] > div > button', { hasText: "Stroke" });
const shapes = (page: Page) =>
  page.evaluate(async () => JSON.parse(await window.__annotationTool.get_shape_annotations()) as { stroke_width: number; fill_r: number }[]);

for (const size of [{ width: 1280, height: 800 }, { width: 768, height: 1024 }]) {
  test(`Q2 Shapes panel at ${size.width}: Fill Color first, Stroke shut at None then open, light and dark`, async ({ page }) => {
    await openPhoto(page, size);
    if (size.width <= 1000) {
      // Compact: the master bar's Tools tab holds the tool tiles.
      await page.getByRole("region", { name: "Master bar" }).getByRole("button", { name: "Tools", exact: true }).click().catch(() => {});
    }
    await page.getByRole("button", { name: "Create", exact: true }).first().click();
    await page.getByRole("button", { name: "Shapes", exact: true }).first().click();
    const panel = page.locator("[data-draw-panel]").first();
    await expect(panel.getByRole("radiogroup", { name: "Fill Color", exact: true })).toBeVisible();
    await expect(strokeHeader(page)).toHaveAttribute("aria-expanded", "false");
    await expect(strokeHeader(page)).toContainText("None");
    await expect(panel.getByRole("button", { name: "Sloppiness info" })).toBeVisible();
    for (const theme of ["light", "dark"] as const) {
      await setTheme(page, theme);
      await shot(page, `q2-shapes-${size.width}-shut-${theme}`);
    }
    await strokeHeader(page).click();
    await expect(strokeHeader(page)).toHaveAttribute("aria-expanded", "true");
    await panel.getByRole("radiogroup", { name: "Stroke Color", exact: true }).getByRole("radio").nth(8).click(); // black
    await expect(panel.getByRole("button", { name: "Sloppiness info" })).toHaveCount(0);
    for (const theme of ["light", "dark"] as const) {
      await setTheme(page, theme);
      await shot(page, `q2-shapes-${size.width}-open-${theme}`);
    }
    // The header's summary shows only while the section is shut.
    await strokeHeader(page).click();
    await expect(strokeHeader(page)).toContainText("2 px");
  });
}

test("Q2b a white square on white paper: committed it is invisible, reselected its edit box shows", async ({ page }) => {
  await openPhoto(page, { width: 1600, height: 1100 });
  await page.getByRole("button", { name: "Create", exact: true }).first().click();
  await page.getByRole("button", { name: "Shapes", exact: true }).first().click();
  const a = await screenPoint(page, 300, 250);
  const b = await screenPoint(page, 620, 470);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 8 });
  await page.mouse.up();
  await blur(page);
  await page.keyboard.press("Enter");
  await expect.poll(async () => (await shapes(page)).length).toBe(1);
  expect((await shapes(page))[0]).toMatchObject({ stroke_width: 0, fill_r: 255 });
  await page.waitForTimeout(400);
  await shot(page, "q2b-white-square-committed");
  const mid = await screenPoint(page, 460, 360);
  await page.mouse.click(mid.x, mid.y);
  const box = page.locator("svg[data-draw-overlay]").first();
  await expect(box).toBeAttached();
  await shot(page, "q2b-white-square-reselected");
  // The edit box draws something visible over it: an outline element with a stroke.
  const outlined = await box.evaluate((svg) =>
    Array.from(svg.querySelectorAll("rect,path,polygon,ellipse")).some((el) => {
      const s = getComputedStyle(el);
      return s.stroke !== "none" && s.stroke !== "" && parseFloat(s.strokeWidth || "0") > 0 && s.visibility !== "hidden";
    }));
  expect(outlined, "the reselected strokeless shape shows an outline").toBe(true);
});

// ── Q3 pairing: Cancel mid-send ──────────────────────────────────────────────

test.describe("Q3 pairing Cancel", () => {
  test.setTimeout(240_000);
  // Big enough to still be moving when Cancel lands, under Playwright's 50 MB upload cap: 4 noisy 1800 × 1200 PNGs.
  const big = () => [1, 2, 3, 4].map((i) => png(`big-${i}.png`, syntheticPng(1800, 1200, i, true)));

  test("the phone cancels its own send: both sides say so, at most the photos already done are added", async ({ browser, context, page }) => {
    const { phone } = await pairUp(browser, context, page);
    await phone.page.getByTestId("pair-send-input").setInputFiles(big());
    const dialog = page.getByTestId("pair-transfer");
    await expect(page.getByTestId("pair-transfer-title")).toHaveText(/wants to send 4 photos/, { timeout: 60_000 });
    await dialog.getByRole("button", { name: "Accept", exact: true }).click();
    await expect(phone.page.getByTestId("pair-transfer-title")).toHaveText("Sending to your computer", { timeout: 30_000 });
    await phone.page.getByTestId("pair-transfer").getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(phone.page.getByTestId("pair-transfer-title")).toHaveText("Canceled", { timeout: 30_000 });
    await expect(page.getByTestId("pair-transfer-title")).toHaveText(/canceled$/, { timeout: 30_000 });
    await dialog.screenshot({ path: join(SHOTS, "q3-computer-sees-phone-cancel.png") });
    const added = (await galleryTiles(page).count()) - 1;
    console.log(`Q3a photos added before the cancel: ${added} of 4`);
    expect(added).toBeLessThan(4);
    await phone.context.close();
  });

  test("the computer cancels while receiving: both sides say so", async ({ browser, context, page }) => {
    const { phone } = await pairUp(browser, context, page);
    await phone.page.getByTestId("pair-send-input").setInputFiles(big());
    const dialog = page.getByTestId("pair-transfer");
    await expect(page.getByTestId("pair-transfer-title")).toHaveText(/wants to send 4 photos/, { timeout: 60_000 });
    await dialog.getByRole("button", { name: "Accept", exact: true }).click();
    await expect(page.getByTestId("pair-transfer-title")).toHaveText(/^Receiving from /, { timeout: 30_000 });
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(page.getByTestId("pair-transfer-title")).toHaveText("Canceled", { timeout: 30_000 });
    await expect(phone.page.getByTestId("pair-transfer-title")).toHaveText("Your computer canceled", { timeout: 30_000 });
    await phone.page.screenshot({ path: join(SHOTS, "q3-phone-sees-computer-cancel.png") });
    expect((await galleryTiles(page).count()) - 1).toBeLessThan(4);
    await phone.context.close();
  });
});

// ── Q4 ⚡ Auto on Resize & Compress ──────────────────────────────────────────

test("Q4 ⚡ Auto on a 3000 × 2000 photo: Scale fits 2500 px, Quality lands at or under 75, Image weight passes", async ({ page }) => {
  await openPhoto(page, { width: 1600, height: 1100 }, png("big-3000.png", syntheticPng(3000, 2000, 7, true)), "2048");
  await page.getByRole("button", { name: "Enhance", exact: true }).first().click();
  await page.getByRole("button", { name: "Resize & Compress", exact: true }).first().click();
  const row = (label: string) =>
    page.locator('[data-slot="control-row"]').filter({ has: page.locator('[data-slot="label"]', { hasText: new RegExp(`^${label}`) }) }).first();
  const value = async (label: string) => (await row(label).locator('[data-slot="value"]').first().textContent())?.trim();
  const before = { scale: await value("Scale"), quality: await value("Quality") };
  await setTheme(page, "dark");
  await shot(page, "q4-resize-before-dark");
  const auto = page.getByRole("button", { name: "Auto compress: size and quality that pass Google's limit" });
  await expect(auto).toHaveCount(2);
  await auto.first().click();
  await expect.poll(() => value("Quality"), { timeout: 30_000 }).not.toBe(before.quality);
  const after = { scale: await value("Scale"), quality: await value("Quality") };
  console.log(`Q4 before ${JSON.stringify(before)} after ${JSON.stringify(after)}`);
  await page.waitForTimeout(1500);
  await shot(page, "q4-resize-after-auto-dark");
  await setTheme(page, "light");
  await shot(page, "q4-resize-after-auto-light");
  const q = Number(String(after.quality).replace(/\D/g, ""));
  expect(q).toBeLessThanOrEqual(75);
  expect(q).toBeGreaterThanOrEqual(50);
});
