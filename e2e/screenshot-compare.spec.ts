import { test, expect } from "./guard/test";
import type { Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { installAnnotationProbe } from "./annotation-benchmark-harness";

// ─────────────────────────────────────────────────────────────────────────────
// Screenshot comparison (Night 10-23), through the real UI: open screenshot B,
// right-click screenshot A in the gallery → Compare with this, read the
// changes, Mark changes as ONE undo step (before a reload and after it), and
// leave compare with nothing left behind but the marks.
//
// Fixtures (e2e/fixtures/compare/make-fixtures.mjs): two real browser
// screenshots of one settings screen; B moves the Save button, changes the
// "Draft" label and recolors the bell. known.json is the ground truth: the
// box of every pixel that differs inside each changed element.
// ─────────────────────────────────────────────────────────────────────────────

const DIR = join(__dirname, "fixtures", "compare");
const KNOWN = JSON.parse(readFileSync(join(DIR, "known.json"), "utf8")) as Record<string, [number, number, number, number]>;

/** A gallery tile is named by the file's name without its extension. */
const tile = (page: Page, file: string) =>
  page.locator(`[aria-label="Select photo ${file.replace(/\.[^.]+$/, "")}"]:visible`);

type Shape = { id: number; kind: number; number: number; x0: number; y0: number; x1: number; y1: number };

/** Import B and A, and open B. */
async function open(page: Page, b: string, a: string, width: number) {
  await page.setViewportSize({ width: 1600, height: 1100 });
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    return ["localhost", "127.0.0.1"].includes(url.hostname) || ["blob:", "data:"].includes(url.protocol)
      ? route.continue() : route.abort();
  });
  await page.addInitScript(() =>
    localStorage.setItem("image-horse-prefs", JSON.stringify({ canvasArtboard: false })));
  await page.goto("/");
  await page.locator('input[type="file"]').first().setInputFiles([join(DIR, b), join(DIR, a)]);
  await expect(page.locator('[aria-label^="Select photo"]:visible')).toHaveCount(2);
  await tile(page, b).click();
  await expect.poll(() => page.locator("canvas.main-canvas").getAttribute("width")).toBe(String(width));
  await installAnnotationProbe(page);
}

async function compareWith(page: Page, a: string) {
  await tile(page, a).click({ button: "right" });
  await page.getByRole("menuitem", { name: "Compare with this" }).click();
  await expect(bar(page)).toBeVisible();
}

const bar = (page: Page) => page.getByTestId("compare-bar");

/** The listed changes' boxes, in document px. */
async function regions(page: Page): Promise<[number, number, number, number][]> {
  await bar(page).getByRole("button", { name: /changes?: list them/ }).click();
  const boxes = await page.getByTestId("compare-region").evaluateAll((els) =>
    els.map((e) => e.getAttribute("data-box")!.split(",").map(Number)));
  return boxes as [number, number, number, number][];
}

const iou = (a: number[], b: number[]) => {
  const ix = Math.max(0, Math.min(a[0] + a[2], b[0] + b[2]) - Math.max(a[0], b[0]));
  const iy = Math.max(0, Math.min(a[1] + a[3], b[1] + b[3]) - Math.max(a[1], b[1]));
  const i = ix * iy;
  return i / (a[2] * a[3] + b[2] * b[3] - i);
};

const shapes = (page: Page): Promise<Shape[]> =>
  page.evaluate(async () => JSON.parse(await window.__annotationTool.get_shape_annotations()));

async function key(page: Page, combo: string) {
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press(combo);
}

/** Wait out the autosave, reload, resume — the op log is all undo has left. */
async function reloadAndResume(page: Page, width: number) {
  await page.waitForTimeout(6000);
  await page.reload();
  await page.getByRole("button", { name: /Resume editing/i }).click();
  await expect.poll(() => page.locator("canvas.main-canvas").getAttribute("width")).toBe(String(width));
  await installAnnotationProbe(page);
}

test("An identical pair: No changes, and Mark changes is off", async ({ page }) => {
  await open(page, "a.png", "a-copy.png", 960);
  // The top bar's way in, this time: Compare with another photo… → pick A.
  await page.getByRole("button", { name: "Compare with another photo…" }).click();
  await page.getByRole("dialog").getByRole("button", { name: /a-copy/ }).click();
  await expect(bar(page)).toContainText("No changes");
  await expect(bar(page).getByRole("button", { name: "Mark changes" })).toBeDisabled();
});

test("The known pair: exactly 3 changes, each box on its known area (IoU ≥ 0.8)", async ({ page }) => {
  await open(page, "b.png", "a.png", 960);
  await compareWith(page, "a.png");
  await expect(bar(page)).toContainText("3 changes");
  const found = await regions(page);
  expect(found).toHaveLength(3);
  for (const [name, known] of Object.entries(KNOWN)) {
    const best = Math.max(...found.map((r) => iou(r, known)));
    expect(best, `${name}: ${JSON.stringify(found)} vs ${JSON.stringify(known)}`).toBeGreaterThanOrEqual(0.8);
  }
  // A screen reader walks the list: "Change 1 of 3, …".
  await expect(page.getByRole("list", { name: "Changes" }).getByRole("button").first())
    .toHaveAccessibleName(/^Change 1 of 3, \d+ by \d+ at \d+, \d+$/);
  await expect(page.getByTestId("compare-tint")).toBeVisible();
});

test("A JPEG re-save of the same screenshot: no changes at the default sensitivity", async ({ page }) => {
  await open(page, "a.png", "a-resave.jpg", 960);
  await compareWith(page, "a-resave.jpg");
  await expect(bar(page)).toContainText("No changes");
});

test("Mark changes: 3 boxes and pins 1-3, one Ctrl+Z takes all six, before and after a reload", async ({ page }) => {
  await open(page, "b.png", "a.png", 960);
  await compareWith(page, "a.png");
  await expect(bar(page)).toContainText("3 changes");
  expect(await shapes(page)).toEqual([]);
  await bar(page).getByRole("button", { name: "Mark changes" }).click();
  await expect.poll(async () => (await shapes(page)).length).toBe(6);
  const after = await shapes(page);
  expect(after.filter((s) => s.kind === 0)).toHaveLength(3);
  expect(after.filter((s) => s.kind === 5).map((s) => s.number)).toEqual([1, 2, 3]);
  await bar(page).getByRole("button", { name: "Done" }).click();

  await key(page, "Control+z");
  await expect.poll(() => shapes(page)).toEqual([]);
  await key(page, "Control+Shift+z");
  await expect.poll(() => shapes(page)).toEqual(after);

  await reloadAndResume(page, 960);
  await expect.poll(() => shapes(page)).toEqual(after);
  await key(page, "Control+z");
  await expect.poll(() => shapes(page)).toEqual([]);
});

test("Different sizes: the Sizes differ line, and changes only inside the overlap", async ({ page }) => {
  await open(page, "b-crop.png", "a.png", 800);
  await compareWith(page, "a.png");
  await expect(page.getByTestId("compare-sizes")).toHaveText("Sizes differ: comparing the 800×500 they share");
  // The bell sits at x 863: outside the 800 px they share.
  await expect(bar(page)).toContainText("2 changes");
  for (const [x, y, w, h] of await regions(page)) {
    expect(x + w).toBeLessThanOrEqual(800);
    expect(y + h).toBeLessThanOrEqual(500);
  }
});

test("Leaving compare (Done or Esc) removes the tint and saves nothing", async ({ page }) => {
  await open(page, "b.png", "a.png", 960);
  await compareWith(page, "a.png");
  await expect(page.getByTestId("compare-tint")).toBeVisible();
  await bar(page).getByRole("button", { name: "Done" }).click();
  await expect(page.getByTestId("compare-tint")).toHaveCount(0);
  await expect(bar(page)).toHaveCount(0);

  await compareWith(page, "a.png");
  await expect(page.getByTestId("compare-tint")).toBeVisible();
  await key(page, "Escape");
  await expect(page.getByTestId("compare-tint")).toHaveCount(0);

  expect(await shapes(page)).toEqual([]);
  await reloadAndResume(page, 960);
  expect(await shapes(page)).toEqual([]);
  await expect(bar(page)).toHaveCount(0);
});

test("Blink under reduced motion does not animate; Show A swaps by hand", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await open(page, "b.png", "a.png", 960);
  await compareWith(page, "a.png");
  await bar(page).getByRole("button", { name: "Blink", exact: true }).click();
  const a = page.getByTestId("compare-blink-a");
  await expect(a).toHaveCSS("visibility", "hidden");
  const seen = await page.evaluate(async () => {
    const el = document.querySelector('[data-testid="compare-blink-a"]') as HTMLElement;
    const states = new Set<string>();
    for (let i = 0; i < 15; i++) {
      states.add(getComputedStyle(el).visibility);
      await new Promise((r) => setTimeout(r, 100));
    }
    return [...states];
  });
  expect(seen).toEqual(["hidden"]);
  await bar(page).getByRole("button", { name: "Show A" }).click();
  await expect(a).toHaveCSS("visibility", "visible");
});
