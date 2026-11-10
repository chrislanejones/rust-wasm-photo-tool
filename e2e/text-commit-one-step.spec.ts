import { test, expect } from "./guard/test";
import type { Page } from "@playwright/test";
import { join } from "node:path";
import { installAnnotationProbe, screenPoint } from "./annotation-benchmark-harness";

// ─────────────────────────────────────────────────────────────────────────────
// A fresh text with the shadow ON, an outline and Align: Center commits as ONE
// undo step (PARKING_LOT 08-28). `commitText` was the add plus a setter each
// for the shadow and the outline, each its own snapshot: "Add Text", then
// "Text Shadow", then "Text Stroke". v12's gestures (ADR-088) made one step of
// several ops possible; the commit now joins them (lib/commitSteps).
//
// Checked in the session, and after a reload by the op log and by the archive:
// one "Add Text" in the history, and one Ctrl+Z takes the whole text away.
// ─────────────────────────────────────────────────────────────────────────────

const FIXTURE_PNG = join(__dirname, "fixtures", "paper-1200x900.png");

async function open(page: Page) {
  await page.setViewportSize({ width: 1600, height: 1100 });
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    return ["localhost", "127.0.0.1"].includes(url.hostname) || ["blob:", "data:"].includes(url.protocol)
      ? route.continue() : route.abort();
  });
  await page.addInitScript(() =>
    localStorage.setItem("image-horse-prefs", JSON.stringify({ canvasArtboard: false })));
  await page.goto("/");
  await page.locator('input[type="file"]').first().setInputFiles(FIXTURE_PNG);
  await expect.poll(() => page.locator("canvas.main-canvas").getAttribute("width")).toBe("1200");
  await installAnnotationProbe(page);
}

type T = { shadow_text: boolean; shadow_a: number; stroke_width: number; align: number };
const texts = (page: Page): Promise<T[]> =>
  page.evaluate(async () => JSON.parse(await window.__annotationTool.get_text_annotations()));
/** The undo stack's labels, oldest first (`history_labels` is
 *  `current:…|undo:…|redo:…`). */
const labels = (page: Page): Promise<string[]> =>
  page.evaluate(async () =>
    (await window.__annotationTool.history_labels())
      .split("|")
      .filter((p) => p.startsWith("undo:"))
      .map((p) => p.slice(5)));

async function key(page: Page, combo: string) {
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press(combo);
}

async function styledText(page: Page) {
  await page.getByRole("button", { name: "Create", exact: true }).first().click();
  await page.getByRole("button", { name: "Text", exact: true }).first().click();
  const panel = page.getByRole("region", { name: "Tool options" });

  await panel.getByRole("radiogroup", { name: "Align" }).getByRole("radio", { name: "Center", exact: true }).click();
  // The two sections open on click; each one's controls show once it's open.
  const stroke = panel.getByRole("slider", { name: "Stroke Width" });
  if (!(await stroke.isVisible())) await panel.getByRole("button", { name: /^Stroke/ }).first().click();
  await stroke.focus();
  for (let i = 0; i < 3; i++) await page.keyboard.press("ArrowRight");
  const cast = panel.getByRole("radiogroup", { name: "Cast From" });
  if (!(await cast.isVisible())) await panel.getByRole("button", { name: /^Drop Shadow/ }).first().click();
  await cast.getByRole("radio", { name: "Text", exact: true }).click();

  const at = await screenPoint(page, 300, 300);
  await page.mouse.click(at.x, at.y);
  const input = page.locator("textarea").first();
  await expect(input).toBeVisible();
  await input.fill("Styled\nlabel");
  const away = await screenPoint(page, 1000, 800);
  await page.mouse.click(away.x, away.y);
  await page.waitForTimeout(600);
  await page.keyboard.press("Escape");
  await expect.poll(async () => (await texts(page)).length).toBe(1);
  const [t] = await texts(page);
  expect(t.shadow_text, "shadow on").toBe(true);
  expect(t.stroke_width, "outline on").toBeGreaterThan(0);
  expect(t.align, "centered").toBe(1);
}

async function reloadAndResume(page: Page, retireLog: boolean) {
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
}

test("shadow + outline + center: one Add Text, one Ctrl+Z", async ({ page }) => {
  await open(page);
  const before = await labels(page);
  await styledText(page);
  expect((await labels(page)).slice(before.length), "the commit's history rows").toEqual(["Add Text"]);
  await key(page, "Control+z");
  await expect.poll(async () => (await texts(page)).length, "one undo takes it all").toBe(0);
  await key(page, "Control+Shift+z");
  await expect.poll(async () => (await texts(page)).length).toBe(1);
  expect((await texts(page))[0].shadow_text, "redo brings the shadow back too").toBe(true);
});

for (const retireLog of [false, true]) {
  test(`after a reload by the ${retireLog ? "archive" : "op log"}, one Ctrl+Z still takes it all`, async ({ page }) => {
    await open(page);
    await styledText(page);
    await reloadAndResume(page, retireLog);
    await expect.poll(async () => (await texts(page)).length).toBe(1);
    await key(page, "Control+z");
    await expect.poll(async () => (await texts(page)).length).toBe(0);
  });
}
