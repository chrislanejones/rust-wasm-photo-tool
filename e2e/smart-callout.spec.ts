import { test, expect } from "./guard/test";
import type { Page } from "@playwright/test";
import { join } from "node:path";
import { installAnnotationProbe, screenPoint } from "./annotation-benchmark-harness";
import { findCallouts, type CalloutShape, type CalloutText } from "../app/src/lib/callouts";

// ─────────────────────────────────────────────────────────────────────────────
// Smart Callout v1 (Night 10-21, §3), through the real UI: Create › Pins with
// Drop on Callout, a click, a label, Enter → a numbered pin, the label and a
// leader joining them.
//
//   • One Ctrl+Z removes all three; one redo brings all three back.
//   • Dragging the pin, and dragging the label with the Text tool, keeps the
//     leader joined — and the drag plus its follow is one undo.
//   • After a reload the join still holds: the pin still drags its leader.
//   • Deleting the pin deletes its leader and label, in one undo step.
//
// The join is read with the app's own rule (lib/callouts `findCallouts`).
// ─────────────────────────────────────────────────────────────────────────────

const FIXTURE_PNG = join(__dirname, "fixtures", "paper-1200x900.png");
const PIN_AT = { x: 300, y: 450 };

type Layer = { shapes: CalloutShape[]; texts: (CalloutText & { text: string })[] };

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

async function pins(page: Page) {
  await page.getByRole("button", { name: "Create", exact: true }).first().click();
  await page.getByRole("button", { name: "Pins", exact: true }).first().click();
}

const layer = (page: Page): Promise<Layer> =>
  page.evaluate(async () => ({
    shapes: JSON.parse(await window.__annotationTool.get_shape_annotations()),
    texts: JSON.parse(await window.__annotationTool.get_text_annotations()),
  }));

/** The one callout on the layer, with its pin's center and label's box. */
async function callout(page: Page) {
  const l = await layer(page);
  const found = findCallouts(l.shapes, l.texts);
  if (found.length !== 1) return null;
  const pin = l.shapes.find((s) => s.id === found[0].pin)!;
  const label = l.texts.find((t) => t.id === found[0].label)!;
  return {
    // Rounded: a drag maps screen px back to canvas px through a float scale.
    pin: { x: Math.round((pin.x0 + pin.x1) / 2), y: Math.round((pin.y0 + pin.y1) / 2) },
    label: { x: label.x, y: label.y, text: label.text },
    counts: [l.shapes.length, l.texts.length],
  };
}

const counts = async (page: Page) => {
  const l = await layer(page);
  return [l.shapes.length, l.texts.length];
};

async function key(page: Page, combo: string) {
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press(combo);
}

async function placeCallout(page: Page, label: string) {
  await pins(page);
  await page.getByRole("radio", { name: "Callout", exact: true }).click();
  const p = await screenPoint(page, PIN_AT.x, PIN_AT.y);
  await page.mouse.click(p.x, p.y);
  const input = page.getByRole("textbox", { name: "Callout label" });
  await expect(input).toBeFocused();
  await input.fill(label);
  await input.press("Enter");
  await expect(input).toHaveCount(0);
  await expect.poll(() => callout(page).then((c) => c?.counts)).toEqual([2, 1]);
}

/** Drag the pin's edit box body by (dx, dy) canvas px, then Apply. */
async function dragPin(page: Page, from: { x: number; y: number }, dx: number, dy: number) {
  const a = await screenPoint(page, from.x, from.y);
  await page.mouse.click(a.x, a.y);
  await expect(page.locator("svg[data-draw-overlay]")).toBeVisible();
  const b = await screenPoint(page, from.x + dx, from.y + dy);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 8 });
  await page.mouse.up();
  await key(page, "Enter");
  await expect(page.locator("svg[data-draw-overlay]")).toHaveCount(0);
}

test("Enter places pin, label and leader — one Ctrl+Z takes all three", async ({ page }) => {
  await open(page);
  await placeCallout(page, "Loose screw");
  const c = await callout(page);
  expect(c!.pin).toEqual(PIN_AT);
  expect(c!.label.text).toBe("Loose screw");
  const steps = await page.evaluate(async () => await window.__annotationTool.undo_count());
  await key(page, "Control+z");
  await expect.poll(() => counts(page)).toEqual([0, 0]);
  expect(await page.evaluate(async () => await window.__annotationTool.undo_count())).toBe(steps - 1);
  await key(page, "Control+Shift+z");
  await expect.poll(() => callout(page).then((x) => x?.label.text)).toBe("Loose screw");
});

test("Escape or an empty label places nothing", async ({ page }) => {
  await open(page);
  await pins(page);
  await page.getByRole("radio", { name: "Callout", exact: true }).click();
  const p = await screenPoint(page, PIN_AT.x, PIN_AT.y);
  await page.mouse.click(p.x, p.y);
  const input = page.getByRole("textbox", { name: "Callout label" });
  await input.fill("never mind");
  await input.press("Escape");
  await expect(input).toHaveCount(0);
  await page.mouse.click(p.x, p.y);
  await input.press("Enter");
  await expect(input).toHaveCount(0);
  expect(await counts(page)).toEqual([0, 0]);
});

test("the leader follows the pin and the label, and still does after a reload", async ({ page }) => {
  await open(page);
  await placeCallout(page, "Crack");
  const placed = (await callout(page))!;

  // The pin: drag it 150 px down. The drag and the follow are one undo.
  await dragPin(page, PIN_AT, 0, 150);
  await expect.poll(() => callout(page).then((c) => c?.pin)).toEqual({ x: PIN_AT.x, y: PIN_AT.y + 150 });
  await key(page, "Control+z");
  await expect.poll(() => callout(page).then((c) => c?.pin)).toEqual(PIN_AT);
  await key(page, "Control+Shift+z");
  await expect.poll(() => callout(page).then((c) => c?.pin)).toEqual({ x: PIN_AT.x, y: PIN_AT.y + 150 });

  // The label: open it in the Text tool and drag its move handle 120 px down.
  await page.getByRole("button", { name: "Create", exact: true }).first().click();
  await page.getByRole("button", { name: "Text", exact: true }).first().click();
  const at = await screenPoint(page, placed.label.x + 10, placed.label.y + 8);
  await page.mouse.click(at.x, at.y);
  const textarea = page.locator("textarea").first();
  await expect(textarea).toBeVisible();
  const box = (await textarea.boundingBox())!;
  const handle = { x: box.x + box.width / 2, y: box.y - 14 };
  await page.mouse.move(handle.x, handle.y);
  await page.mouse.down();
  await page.mouse.move(handle.x, handle.y + 120, { steps: 8 });
  await page.mouse.up();
  // Commit by clicking away; Escape the fresh input that click opens.
  const away = await screenPoint(page, 1100, 850);
  await page.mouse.click(away.x, away.y);
  await page.keyboard.press("Escape");
  await expect.poll(() => callout(page).then((c) => (c ? c.label.y > placed.label.y + 60 : false))).toBe(true);
  const moved = (await callout(page))!;

  // Reload: the join is geometry, and the geometry was saved.
  await page.waitForTimeout(6000);
  await page.reload();
  await page.getByRole("button", { name: /Resume editing/i }).click();
  await expect.poll(() => page.locator("canvas.main-canvas").getAttribute("width")).toBe("1200");
  await installAnnotationProbe(page);
  await expect.poll(() => callout(page)).toEqual(moved);
  await pins(page);
  await dragPin(page, moved.pin, 200, 0);
  await expect.poll(() => callout(page).then((c) => c?.pin)).toEqual({ x: moved.pin.x + 200, y: moved.pin.y });
});

test("deleting the pin deletes its leader and label — one undo puts them back", async ({ page }) => {
  await open(page);
  await placeCallout(page, "Remove me");
  await page.getByRole("radio", { name: "Pin", exact: true }).click();
  const p = await screenPoint(page, PIN_AT.x, PIN_AT.y);
  await page.mouse.click(p.x, p.y);
  await expect(page.locator("svg[data-draw-overlay]")).toBeVisible();
  await key(page, "Delete");
  await expect.poll(() => counts(page)).toEqual([0, 0]);
  await key(page, "Control+z");
  await expect.poll(() => callout(page).then((c) => c?.label.text)).toBe("Remove me");
});

test("clicking away with a label typed places it there and starts the next", async ({ page }) => {
  await open(page);
  await pins(page);
  await page.getByRole("radio", { name: "Callout", exact: true }).click();
  const p = await screenPoint(page, PIN_AT.x, PIN_AT.y);
  await page.mouse.click(p.x, p.y);
  const input = page.getByRole("textbox", { name: "Callout label" });
  await input.fill("First");
  const q = await screenPoint(page, 800, 600);
  await page.mouse.click(q.x, q.y);
  await expect.poll(() => callout(page).then((c) => c && [c.pin, c.label.text])).toEqual([PIN_AT, "First"]);
  await expect(input).toBeFocused();
  await expect(input).toHaveValue("");
  await input.press("Escape");
  await expect(input).toHaveCount(0);
  expect(await counts(page)).toEqual([2, 1]);
});
