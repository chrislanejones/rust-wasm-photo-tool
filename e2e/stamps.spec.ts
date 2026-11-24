import { test, expect } from "./guard/test";
import type { Page } from "@playwright/test";
import { join } from "node:path";
import { installAnnotationProbe, screenPoint } from "./annotation-benchmark-harness";

// ─────────────────────────────────────────────────────────────────────────────
// Stamps are text (ADR-109, op log v17).
//
// Create › Stamps places a TEXT in a stamp's style — a bold capital word in a
// bordered, transparent box, tilted −5° — not pixels. So: one click is one
// undo step and one text; clicking it opens it for editing and retyping keeps
// its box, border and tilt (the look held for the edit); any word can be a
// stamp; and it comes back from a reload, by the op log and by the archive,
// as the same pixels.
// ─────────────────────────────────────────────────────────────────────────────

const FIXTURE_PNG = join(__dirname, "fixtures", "paper-1200x900.png");
const AT = { x: 500, y: 400 };

type Text = {
  id: number; text: string; x: number; y: number; rotation_deg: number;
  r: number; g: number; b: number; bold: boolean;
  background_kind: number; bg_a: number;
  border_width: number; border_r: number; border_g: number; border_b: number; border_a: number;
  tile_w: number; tile_h: number; tile_offset_x: number; tile_offset_y: number;
};

async function open(page: Page) {
  await page.setViewportSize({ width: 1600, height: 1100 });
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
}

const texts = (page: Page): Promise<Text[]> =>
  page.evaluate(async () => JSON.parse(await window.__annotationTool.get_text_annotations()));
const undoCount = (page: Page): Promise<number> =>
  page.evaluate(async () => await window.__annotationTool.undo_count());
const composite = (page: Page): Promise<number[]> =>
  page.evaluate(async () => Array.from(await window.__annotationTool.get_image_data()));

const panel = (page: Page) => page.getByRole("region", { name: "Tool options" });

async function openStamps(page: Page) {
  await page.getByRole("button", { name: "Create", exact: true }).first().click();
  await page.getByRole("button", { name: "Stamps", exact: true }).first().click();
  await expect(panel(page).getByRole("radiogroup", { name: "Stamp" })).toBeVisible();
}

async function clickCanvas(page: Page, x: number, y: number) {
  const at = await screenPoint(page, x, y);
  await page.mouse.click(at.x, at.y);
}

/** Pixels of the composite near the stamp's center that are the stamp's red. */
async function redPixels(page: Page, t: Text): Promise<number> {
  const px = await composite(page);
  const W = 1200;
  let n = 0;
  const x0 = t.x + t.tile_offset_x;
  const y0 = t.y + t.tile_offset_y;
  for (let y = y0; y < y0 + t.tile_h; y++) {
    for (let x = x0; x < x0 + t.tile_w; x++) {
      const i = (y * W + x) * 4;
      if (px[i] > 180 && px[i + 1] < 90 && px[i + 2] < 90) n++;
    }
  }
  return n;
}

async function placeRejected(page: Page): Promise<{ steps: number; t: Text }> {
  await openStamps(page);
  await panel(page).getByRole("radio", { name: "Rejected" }).click();
  await expect(panel(page).getByRole("radio", { name: "Rejected" })).toBeChecked();
  const steps = await undoCount(page);
  await clickCanvas(page, AT.x, AT.y);
  await expect.poll(async () => (await texts(page)).length).toBe(1);
  const [t] = await texts(page);
  return { steps, t };
}

test("a click places a stamp as an editable text, in one undo step", async ({ page }) => {
  await open(page);
  const { steps, t } = await placeRejected(page);
  expect(t.text).toBe("REJECTED");
  expect([t.r, t.g, t.b], "the palette's red").toEqual([0xef, 0x44, 0x44]);
  expect(t.bold).toBe(true);
  expect(t.rotation_deg, "tilted like a rubber stamp").toBe(-5);
  expect(t.background_kind, "a box").toBe(1);
  expect(t.bg_a, "a transparent one").toBe(0);
  expect(t.border_width, "with a border").toBeGreaterThan(0);
  expect([t.border_r, t.border_g, t.border_b, t.border_a]).toEqual([0xef, 0x44, 0x44, 255]);
  // Centered on the click: the tile's center is within a few px of it.
  const cx = t.x + t.tile_offset_x + t.tile_w / 2;
  const cy = t.y + t.tile_offset_y + t.tile_h / 2;
  expect(Math.abs(cx - AT.x), `center x ${cx}`).toBeLessThanOrEqual(3);
  expect(Math.abs(cy - AT.y), `center y ${cy}`).toBeLessThanOrEqual(3);
  expect(await redPixels(page, t), "drawn on the canvas").toBeGreaterThan(200);
  expect(await undoCount(page), "ONE step: text, centering and border").toBe(steps + 1);

  await page.keyboard.press("Escape");
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press("Control+z");
  await expect.poll(async () => (await texts(page)).length, "one undo takes it all").toBe(0);
  await page.keyboard.press("Control+Shift+z");
  await expect.poll(async () => (await texts(page)).length).toBe(1);
  expect((await texts(page))[0].border_width).toBe(t.border_width);
});

test("retyping a stamp keeps its box, border, color and tilt", async ({ page }) => {
  await open(page);
  const { t } = await placeRejected(page);
  // The Text panel's own Background is None: before the look was held for an
  // edit, committing here would have stripped the stamp's box and border.
  await clickCanvas(page, AT.x, AT.y);
  const input = page.locator("textarea").first();
  await expect(input).toBeVisible();
  await expect(input).toHaveValue("REJECTED");
  await expect(page.getByTestId("text-border-preview"), "the preview shows the border").toBeVisible();
  await input.fill("PAID");
  await clickCanvas(page, 1100, 850);
  await page.keyboard.press("Escape");
  await expect.poll(async () => (await texts(page))[0]?.text).toBe("PAID");
  const [after] = await texts(page);
  expect(after.background_kind, "still a box").toBe(1);
  expect(after.bg_a, "still transparent").toBe(0);
  expect(after.border_width, "still bordered").toBe(t.border_width);
  expect([after.r, after.g, after.b]).toEqual([t.r, t.g, t.b]);
  expect(after.rotation_deg, "still tilted").toBe(-5);
});

test("any word is a stamp, in capitals", async ({ page }) => {
  await open(page);
  await openStamps(page);
  await panel(page).getByLabel("Word").fill("sold out");
  const presets = panel(page).getByRole("radiogroup", { name: "Stamp" });
  await expect(presets.getByRole("radio", { checked: true }), "a custom word unchecks the presets").toHaveCount(0);
  await clickCanvas(page, AT.x, AT.y);
  await expect.poll(async () => (await texts(page))[0]?.text).toBe("SOLD OUT");
});

for (const retireLog of [false, true]) {
  test(`a stamp survives a reload by the ${retireLog ? "archive" : "op log"}`, async ({ page }) => {
    await open(page);
    const { t } = await placeRejected(page);
    await page.keyboard.press("Escape");
    const before = await composite(page);
    await page.waitForTimeout(7000);
    if (retireLog) {
      await page.evaluate(() => new Promise<void>((resolve) => {
        const req = indexedDB.open("image-horse-dexie");
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction("oplogManifests", "readwrite");
          const store = tx.objectStore("oplogManifests");
          const all = store.getAll();
          all.onsuccess = () => { for (const m of all.result) store.put({ ...m, stale: true }); };
          tx.oncomplete = () => { db.close(); resolve(); };
        };
      }));
    }
    await page.reload();
    await page.getByRole("button", { name: /Resume editing/i }).click();
    await expect.poll(() => page.locator("canvas.main-canvas").getAttribute("width")).toBe("1200");
    await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
    await installAnnotationProbe(page);
    await expect.poll(async () => (await texts(page)).length).toBe(1);
    const [after] = await texts(page);
    expect(after.text).toBe("REJECTED");
    expect(after.border_width, "the border came back").toBe(t.border_width);
    expect(after.rotation_deg).toBe(-5);
    expect((await composite(page)).join(",") === before.join(","), "the same pixels").toBe(true);
  });
}

test("an old Red Stamps link opens Stamps", async ({ page }) => {
  await open(page);
  await page.evaluate(() => { location.hash = "#/tool/stamps/red"; });
  await expect(panel(page).getByRole("radiogroup", { name: "Stamp" })).toBeVisible();
});
