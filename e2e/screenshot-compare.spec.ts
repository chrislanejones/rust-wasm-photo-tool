import { test, expect } from "./guard/test";
import type { Locator, Page } from "@playwright/test";
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

/** The window the 10-23 user tests ran in (Chrome, 1689 × 922). */
const USER_WINDOW = { width: 1689, height: 922 };
/** A common laptop window: the photo fills it down to the bar. */
const LAPTOP_WINDOW = { width: 1366, height: 768 };

/** Import B and A, and open B. */
async function open(page: Page, b: string, a: string, width: number, viewport = { width: 1600, height: 1100 }) {
  await page.setViewportSize(viewport);
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

test("The known pair: exactly 3 changes, each box on its known area (IoU ≥ 0.89)", async ({ page }) => {
  await open(page, "b.png", "a.png", 960);
  await compareWith(page, "a.png");
  await expect(bar(page)).toContainText("3 changes");
  const found = await regions(page);
  expect(found).toHaveLength(3);
  // Measured 0.96, 0.90 and 1.00 before and after C13's luma/chroma split
  // (10-24); 0.89 is the bar the fix was held to.
  for (const [name, known] of Object.entries(KNOWN)) {
    const best = Math.max(...found.map((r) => iou(r, known)));
    expect(best, `${name}: ${JSON.stringify(found)} vs ${JSON.stringify(known)}`).toBeGreaterThanOrEqual(0.89);
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

// C13 (10-24): bold pure-blue text re-saved as a q82 JPEG. JPEG stores color
// at half resolution, so the blue bleeds past each glyph; the engine compares
// brightness at the tolerance and color at 1.5 times it. 2 changes before.
test("C13: a q82 JPEG re-save of bold pure-blue text: no changes at the default sensitivity", async ({ page }) => {
  await open(page, "blue-nav.png", "blue-nav-q82.jpg", 1440);
  await compareWith(page, "blue-nav-q82.jpg");
  await expect(bar(page)).toContainText("No changes");
});

// C20 (10-24): a pin sat on its box's top-left corner, over the first letter
// of the change. It sits just outside the corner now, whole inside the photo
// (the bell's box touches the top edge, so its pin slides down beside it).
test("C20: each pin sits outside its box's top-left corner, inside the photo", async ({ page }) => {
  await open(page, "b.png", "a.png", 960);
  await compareWith(page, "a.png");
  await expect(bar(page)).toContainText("3 changes");
  await bar(page).getByRole("button", { name: "Mark changes" }).click();
  await expect.poll(async () => (await shapes(page)).length).toBe(6);
  const all = await shapes(page);
  for (let i = 0; i < all.length; i += 2) {
    const [box, pin] = [all[i], all[i + 1]];
    expect([box.kind, pin.kind]).toEqual([0, 5]);
    const where = `pin ${pin.number} ${JSON.stringify(pin)} vs box ${JSON.stringify(box)}`;
    // Clear of the box's inside: wholly left of it or wholly above it.
    expect(pin.x1 <= box.x0 + 0.5 || pin.y1 <= box.y0 + 0.5, where).toBe(true);
    // Beside the corner it labels, not somewhere else along the box.
    expect(pin.x1, where).toBeGreaterThanOrEqual(box.x0 - 1);
    expect(pin.y1, where).toBeGreaterThanOrEqual(box.y0 - 1);
    expect(pin.x0 >= 0 && pin.y0 >= 0 && pin.x1 <= 960 && pin.y1 <= 600, where).toBe(true);
  }
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

// ── Reachability (user tests 10-23: C3, C7, C8, C15, C16) ───────────────────
// `toBeVisible` passes for a button something else is painted over, so these
// ask the page what a click at the button's middle would land on.

/** What a person's click at the middle of `loc` would hit: "itself", or
 *  where it lands instead. */
async function hitAt(loc: Locator): Promise<string> {
  return loc.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const [x, y] = [r.left + r.width / 2, r.top + r.height / 2];
    if (x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight) return `off-screen at ${Math.round(x)}, ${Math.round(y)}`;
    const hit = document.elementFromPoint(x, y);
    if (hit && el.contains(hit)) return "itself";
    const tag = (e: Element | null) =>
      e ? `${e.tagName.toLowerCase()}${e.getAttribute("data-testid") ? `[data-testid=${e.getAttribute("data-testid")}]` : ""}${typeof e.className === "string" && e.className ? `.${e.className.split(/\s+/).slice(0, 4).join(".")}` : ""}` : "nothing";
    const owner = hit?.closest("[data-paste-yields], [aria-label], [data-testid]");
    return `${tag(hit)} in ${tag(owner ?? null)}`;
  });
}

/** Every button on the Compare bar takes a click. */
async function expectBarReachable(page: Page) {
  const buttons = bar(page).getByRole("button");
  const n = await buttons.count();
  expect(n).toBeGreaterThanOrEqual(6);
  for (let i = 0; i < n; i++) {
    const b = buttons.nth(i);
    // Polled: a panel opening or closing slides for a moment.
    await expect.poll(() => hitAt(b), { message: `bar button "${await b.getAttribute("title")}"` }).toBe("itself");
  }
}

const canvasBox = (page: Page) => page.locator("canvas.main-canvas").boundingBox();

test("C3: with the gallery open (the right-click way in), every button on the bar takes a click", async ({ page }) => {
  await open(page, "b.png", "a.png", 960, USER_WINDOW);
  await compareWith(page, "a.png");
  await expect(page.locator('[data-paste-yields="gallery"]')).toBeVisible();
  await expectBarReachable(page);
  // C19: and with the Review panel open beside it too.
  await key(page, "Alt+r");
  await expect(page.locator('[data-paste-yields="review"]')).toBeVisible();
  await expectBarReachable(page);
  await bar(page).getByRole("button", { name: "Blink", exact: true }).click();
  await expect(bar(page).getByRole("button", { name: "Blink", exact: true })).toHaveAttribute("aria-pressed", "true");
  await bar(page).getByRole("button", { name: "Done" }).click();
  await expect(bar(page)).toHaveCount(0);
});

for (const [finding, view] of [["C15", "Side by side"], ["C16", "Slider"]] as const) {
  test(`${finding}: from ${view}, the other views and Done take a click`, async ({ page }) => {
    await open(page, "b.png", "a.png", 960, LAPTOP_WINDOW);
    await compareWith(page, "a.png");
    await key(page, "Alt+g"); // gallery closed: this is about the view, not C3
    await expect(page.locator('[data-paste-yields="gallery"]')).toHaveCount(0);
    await bar(page).getByRole("button", { name: view, exact: true }).click();
    await expect(view === "Slider" ? page.locator("div.cursor-col-resize") : page.getByTestId("compare-side-a")).toBeVisible();
    await expectBarReachable(page);
    await bar(page).getByRole("button", { name: "Overlay", exact: true }).click();
    await expect(page.getByTestId("compare-tint")).toBeVisible();
    await bar(page).getByRole("button", { name: view, exact: true }).click();
    await bar(page).getByRole("button", { name: "Done" }).click();
    await expect(bar(page)).toHaveCount(0);
  });
}

test("C7: zoomed into a change, the bar keeps its size inside the window and every change takes a click", async ({ page }) => {
  await open(page, "b.png", "a.png", 960, USER_WINDOW);
  await compareWith(page, "a.png");
  await key(page, "Alt+g");
  await expect(page.locator('[data-paste-yields="gallery"]')).toHaveCount(0);
  await bar(page).getByRole("button", { name: /changes?: list them/ }).click();
  const pill = bar(page).getByRole("group", { name: "Compare" });
  const before = (await pill.boundingBox())!;
  const changes = page.getByRole("list", { name: "Changes" }).getByRole("button");
  await changes.nth(1).click();
  await expect(changes.nth(1)).toHaveAttribute("aria-pressed", "true");
  await expect.poll(async () => (await canvasBox(page))!.width).toBeGreaterThan(960 * 2);
  const after = (await pill.boundingBox())!;
  expect(Math.abs(after.width - before.width), `bar width ${before.width} → ${after.width}`).toBeLessThanOrEqual(2);
  expect(Math.abs(after.height - before.height), `bar height ${before.height} → ${after.height}`).toBeLessThanOrEqual(2);
  expect(after.x).toBeGreaterThanOrEqual(0);
  expect(after.x + after.width).toBeLessThanOrEqual(USER_WINDOW.width);
  expect(after.y + after.height).toBeLessThanOrEqual(USER_WINDOW.height);
  await expectBarReachable(page);
  for (let i = 0; i < 3; i++) await expect.poll(() => hitAt(changes.nth(i)), { message: `change ${i + 1}` }).toBe("itself");
  await changes.nth(2).click();
  await expect(changes.nth(2)).toHaveAttribute("aria-pressed", "true");
});

test("C8: leaving compare (Done or Esc) puts the photo back where it was before zooming to a change", async ({ page }) => {
  await open(page, "b.png", "a.png", 960, USER_WINDOW);
  // Measured, and checked, with the gallery open: the strip changes the
  // canvas area, so the photo's home moves with it. Closed while zoomed, so
  // this is about the pan, not about reaching the bar (C3).
  const home = (await canvasBox(page))!;
  const expectHome = async () => {
    await expect(page.locator('[data-paste-yields="gallery"]')).toBeVisible();
    await expect.poll(async () => {
      const r = (await canvasBox(page))!;
      return [r.x, r.y, r.width, r.height].map((v, i) => Math.abs(v - [home.x, home.y, home.width, home.height][i]) <= 1);
    }).toEqual([true, true, true, true]);
  };
  const zoomToChange = async (i: number) => {
    await key(page, "Alt+g");
    await expect(page.locator('[data-paste-yields="gallery"]')).toHaveCount(0);
    await bar(page).getByRole("button", { name: /changes?: list them/ }).click();
    await page.getByRole("list", { name: "Changes" }).getByRole("button").nth(i).click();
    await expect.poll(async () => (await canvasBox(page))!.width).toBeGreaterThan(home.width * 2);
  };

  // The user's path: zoom to a change, Alt+0 (zoom only), then Done.
  await compareWith(page, "a.png");
  await zoomToChange(1);
  await key(page, "Alt+0");
  await bar(page).getByRole("button", { name: "Done" }).click({ timeout: 5000 });
  await expect(bar(page)).toHaveCount(0);
  await key(page, "Alt+g");
  await expectHome();

  // Esc, straight from a zoomed change.
  await compareWith(page, "a.png");
  await zoomToChange(0);
  await key(page, "Escape");
  await expect(bar(page)).toHaveCount(0);
  await key(page, "Alt+g");
  await expectHome();
});
