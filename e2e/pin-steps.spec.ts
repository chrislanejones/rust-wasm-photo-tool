import { test, expect } from "./guard/test";
import type { Page } from "@playwright/test";
import { join } from "node:path";
import { installAnnotationProbe, screenPoint } from "./annotation-benchmark-harness";

// ─────────────────────────────────────────────────────────────────────────────
// Numbered steps renumber themselves (Night 10-21, §2), through the real UI.
//
//   • Delete pin 2 of 1–4 → 1, 2, 3.
//   • Next = 2, drop → the new pin is 2 and the old 2, 3 become 3, 4.
//   • Letters are the same sequence: A, B, C.
//   • Renumber closes the gaps an older photo carries, in numbered order.
//
// Each is ONE Ctrl+Z and one Ctrl+Shift+Z, and stays one undo after a reload
// (the persisted op log replays it). The engine rules are tests/pin_steps.rs.
// ─────────────────────────────────────────────────────────────────────────────

const FIXTURE_PNG = join(__dirname, "fixtures", "paper-1200x900.png");
const SPOTS = [150, 350, 550, 750, 950];

type Pin = { id: number; number: number; label_kind: number };

async function open(page: Page) {
  await page.setViewportSize({ width: 1600, height: 1100 });
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    return ["localhost", "127.0.0.1"].includes(url.hostname) || ["blob:", "data:"].includes(url.protocol)
      ? route.continue() : route.abort();
  });
  // No artboard border, so canvas pixels are image pixels (as the bench).
  await page.addInitScript(() =>
    localStorage.setItem("image-horse-prefs", JSON.stringify({ canvasArtboard: false })));
  await page.goto("/");
  await page.locator('input[type="file"]').first().setInputFiles(FIXTURE_PNG);
  await expect.poll(() => page.locator("canvas.main-canvas").getAttribute("width")).toBe("1200");
  await installAnnotationProbe(page);
  await page.getByRole("button", { name: "Create", exact: true }).first().click();
  await page.getByRole("button", { name: "Pins", exact: true }).first().click();
}

/** The active layer's pins, in draw order. */
const pins = (page: Page): Promise<Pin[]> =>
  page.evaluate(async () =>
    (JSON.parse(await window.__annotationTool.get_shape_annotations()) as (Pin & { kind: number })[])
      .filter((s) => s.kind === 5)
      .map(({ id, number, label_kind }) => ({ id, number, label_kind })));
const numbers = async (page: Page) => (await pins(page)).map((p) => p.number);
const undoCount = (page: Page) => page.evaluate(async () => await window.__annotationTool.undo_count());

async function dropAt(page: Page, x: number) {
  const before = (await pins(page)).length;
  const p = await screenPoint(page, x, 300);
  await page.mouse.click(p.x, p.y);
  await expect.poll(async () => (await pins(page)).length).toBe(before + 1);
}

async function key(page: Page, combo: string) {
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press(combo);
}

/** One Ctrl+Z gives back `before`, one Ctrl+Shift+Z gives back `after`. */
async function oneUndo(page: Page, before: number[], after: number[]) {
  const steps = await undoCount(page);
  await key(page, "Control+z");
  await expect.poll(() => numbers(page)).toEqual(before);
  expect(await undoCount(page)).toBe(steps - 1);
  await key(page, "Control+Shift+z");
  await expect.poll(() => numbers(page)).toEqual(after);
}

/** Autosave, reload, resume — then one Ctrl+Z still gives back `before`. */
async function undoAfterReload(page: Page, after: number[], before: number[]) {
  await page.waitForTimeout(6000);
  await page.reload();
  await page.getByRole("button", { name: /Resume editing/i }).click();
  await expect.poll(() => page.locator("canvas.main-canvas").getAttribute("width")).toBe("1200");
  await installAnnotationProbe(page);
  await expect.poll(() => numbers(page)).toEqual(after);
  await key(page, "Control+z");
  await expect.poll(() => numbers(page)).toEqual(before);
  expect(await page.evaluate(async () => await window.__annotationTool.oplog_is_broken())).toBe(false);
}

const nextField = (page: Page) => page.getByRole("textbox", { name: "Next" });

test("deleting pin 2 of 1–4 leaves 1, 2, 3 — one undo, after a reload too", async ({ page }) => {
  await open(page);
  for (const x of SPOTS.slice(0, 4)) await dropAt(page, x);
  expect(await numbers(page)).toEqual([1, 2, 3, 4]);
  await expect(nextField(page)).toHaveValue("5");
  // Click pin 2 to select it, then Delete.
  const p = await screenPoint(page, SPOTS[1], 300);
  await page.mouse.click(p.x, p.y);
  await expect(page.locator("svg[data-draw-overlay]")).toBeVisible();
  await key(page, "Delete");
  await expect.poll(() => numbers(page)).toEqual([1, 2, 3]);
  await expect(nextField(page)).toHaveValue("4");
  await oneUndo(page, [1, 2, 3, 4], [1, 2, 3]);
  await undoAfterReload(page, [1, 2, 3], [1, 2, 3, 4]);
});

test("Next = 2 inserts a step: the old 2 and 3 become 3 and 4", async ({ page }) => {
  await open(page);
  for (const x of SPOTS.slice(0, 3)) await dropAt(page, x);
  const [a, b, c] = await pins(page);
  await nextField(page).fill("2");
  await nextField(page).press("Enter");
  await expect(nextField(page)).toHaveValue("2");
  await dropAt(page, SPOTS[3]);
  const after = await pins(page);
  expect(after.map((p) => [p.id, p.number])).toEqual([[a.id, 1], [b.id, 3], [c.id, 4], [after[3].id, 2]]);
  // An insert keeps inserting after itself.
  await expect(nextField(page)).toHaveValue("3");
  await oneUndo(page, [1, 2, 3], [1, 3, 4, 2]);
  await undoAfterReload(page, [1, 3, 4, 2], [1, 2, 3]);
});

test("letters are the same sequence: insert at B, delete A", async ({ page }) => {
  await open(page);
  await page.getByRole("radio", { name: "Letters", exact: true }).click();
  for (const x of SPOTS.slice(0, 3)) await dropAt(page, x);
  await expect(nextField(page)).toHaveValue("D");
  await nextField(page).fill("b");
  await nextField(page).press("Enter");
  await dropAt(page, SPOTS[3]);
  expect(await numbers(page)).toEqual([1, 3, 4, 2]);
  expect((await pins(page)).every((p) => p.label_kind === 1)).toBe(true);
  const a = await screenPoint(page, SPOTS[0], 300);
  await page.mouse.click(a.x, a.y);
  await expect(page.locator("svg[data-draw-overlay]")).toBeVisible();
  await key(page, "Delete");
  await expect.poll(() => numbers(page)).toEqual([2, 3, 1]);
  await oneUndo(page, [1, 3, 4, 2], [2, 3, 1]);
});

test("Renumber closes the gaps an older photo has, in numbered order", async ({ page }) => {
  await open(page);
  for (const x of SPOTS.slice(0, 3)) await dropAt(page, x);
  await expect(page.getByRole("button", { name: "Renumber" })).toBeDisabled();
  // A gap the pre-10-21 way: a plain shape delete, which never renumbered.
  await page.evaluate(async () => {
    const t = window.__annotationTool;
    const pin2 = (JSON.parse(await t.get_shape_annotations()) as { id: number; number: number }[])
      .find((s) => s.number === 2)!;
    await t.remove_shape_annotation(pin2.id);
  });
  await dropAt(page, SPOTS[3]); // refreshes the panel's view of the sequence
  expect(await numbers(page)).toEqual([1, 3, 4]);
  await page.getByRole("button", { name: "Renumber" }).click();
  await expect.poll(() => numbers(page)).toEqual([1, 2, 3]);
  await expect(page.getByRole("button", { name: "Renumber" })).toBeDisabled();
  await oneUndo(page, [1, 3, 4], [1, 2, 3]);
  await undoAfterReload(page, [1, 2, 3], [1, 3, 4]);
});
