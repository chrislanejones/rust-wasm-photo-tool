import { test, expect, type Page } from "@playwright/test";
import { join } from "node:path";

// Plan §0 — "When I switch photos, is it a feeling or a bug?"
//
// Two photos of DIFFERENT sizes, so the canvas size alone says which document
// is on screen, plus a 16×16 fingerprint of its pixels to say whether an edit
// landed on it. Photo A gets Brightness +40; photo B stays untouched. Every
// test then asks the same question: after the switching is over, does each
// photo hold exactly its own pixels?
//
// The Adjust sliders are one-shot deltas that return to 0 after every commit
// and on every switch, BY DESIGN — so "A shows its +40 again" is asked of A's
// PIXELS, not of the slider.

const FIXTURES = [
  join(__dirname, "fixtures", "checker.png"),
  join(__dirname, "fixtures", "sky-building.png"),
];

type Print = { w: number; h: number; rgb: [number, number, number] };

async function blockExternalNetwork(page: Page): Promise<void> {
  await page.route("**/*", (route) => {
    const url = route.request().url();
    if (/^https?:\/\/(localhost|127\.0\.0\.1)[:/]/.test(url) || url.startsWith("blob:") || url.startsWith("data:")) {
      return route.continue();
    }
    return route.abort();
  });
}

/** Size + mean colour of the main canvas, read through drawImage so it works
 *  whatever context the engine flushes with. */
const print = (page: Page): Promise<Print | null> =>
  page.evaluate(() => {
    const c = document.querySelector<HTMLCanvasElement>("canvas.main-canvas");
    if (!c || c.width === 0) return null;
    const o = document.createElement("canvas");
    o.width = 16;
    o.height = 16;
    const ctx = o.getContext("2d")!;
    ctx.drawImage(c, 0, 0, 16, 16);
    const d = ctx.getImageData(0, 0, 16, 16).data;
    const s = [0, 0, 0];
    for (let i = 0; i < d.length; i += 4) {
      s[0] += d[i]!;
      s[1] += d[i + 1]!;
      s[2] += d[i + 2]!;
    }
    const n = d.length / 4;
    return { w: c.width, h: c.height, rgb: [s[0] / n, s[1] / n, s[2] / n] as [number, number, number] };
  });

const same = (a: Print | null, b: Print | null, tol = 2) =>
  !!a && !!b && a.w === b.w && a.h === b.h && a.rgb.every((v, i) => Math.abs(v - b.rgb[i]!) <= tol);

const fmt = (p: Print | null) => (p ? `${p.w}x${p.h} rgb(${p.rgb.map((v) => v.toFixed(1)).join(",")})` : "none");

/** Wait until the canvas stops changing: three equal reads 300ms apart. */
async function settled(page: Page): Promise<Print | null> {
  let last: Print | null = null;
  let stable = 0;
  for (let i = 0; i < 60 && stable < 3; i++) {
    await page.waitForTimeout(300);
    const p = await print(page);
    stable = same(p, last, 0.01) ? stable + 1 : 0;
    last = p;
  }
  return last;
}

async function key(page: Page, k: "PageDown" | "PageUp") {
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press(k);
}

async function openAdjust(page: Page) {
  await page.getByRole("button", { name: "Enhance", exact: true }).first().click();
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: "Adjustments", exact: true }).first().click();
  await page.waitForTimeout(500);
}

/** Drag a -100..100 slider from centre to `value` and release (commit). */
async function drag(page: Page, name: string, value: number, opts: { release?: boolean } = {}) {
  const s = page.getByRole("slider", { name, exact: true });
  const b = (await s.boundingBox())!;
  const y = b.y + b.height / 2;
  await page.mouse.move(b.x + b.width / 2, y);
  await page.mouse.down();
  await page.mouse.move(b.x + (b.width * (value + 100)) / 200, y, { steps: 8 });
  if (opts.release !== false) await page.mouse.up();
}

/** Two photos in; returns the untouched prints of A (first shown) and B. */
async function setup(page: Page) {
  await blockExternalNetwork(page);
  await page.goto("/");
  const input = page.locator('input[type="file"]').first();
  await input.waitFor({ state: "attached" });
  await input.setInputFiles(FIXTURES);
  await page.locator("canvas.main-canvas").waitFor({ state: "visible", timeout: 30_000 });
  const a0 = await settled(page);
  await key(page, "PageDown");
  const b0 = await settled(page);
  await key(page, "PageUp");
  const back = await settled(page);
  expect(a0 && b0 && (a0.w !== b0.w || a0.h !== b0.h), "the two fixtures are told apart by size").toBeTruthy();
  expect(same(back, a0), "a plain round trip returns to A untouched").toBe(true);
  await openAdjust(page);
  return { a0: a0!, b0: b0! };
}

test.describe.configure({ mode: "parallel" });
test.setTimeout(180_000);

test("§0.1 slow A→B→A: B stays untouched, A keeps its +40", async ({ page }) => {
  const { b0 } = await setup(page);
  await drag(page, "Brightness", 40);
  const a1 = await settled(page);
  console.log("A after +40", fmt(a1));
  await key(page, "PageDown");
  const b = await settled(page);
  await key(page, "PageUp");
  const a = await settled(page);
  console.log("slow: B", fmt(b), "A", fmt(a));
  expect.soft(same(b, b0), `B untouched (${fmt(b)} vs ${fmt(b0)})`).toBe(true);
  expect.soft(same(a, a1), `A keeps +40 (${fmt(a)} vs ${fmt(a1)})`).toBe(true);
});

test("§0.2 fast A↔B five times in a second: nobody gets the other's pixels", async ({ page }) => {
  const { b0 } = await setup(page);
  await drag(page, "Brightness", 40);
  const a1 = await settled(page);
  for (let i = 0; i < 5; i++) {
    await key(page, "PageDown");
    await page.waitForTimeout(100);
    await key(page, "PageUp");
    await page.waitForTimeout(100);
  }
  const a = await settled(page);
  await key(page, "PageDown");
  const b = await settled(page);
  console.log("fast: A", fmt(a), "B", fmt(b));
  expect.soft(same(a, a1), `A keeps +40 (${fmt(a)} vs ${fmt(a1)})`).toBe(true);
  expect.soft(same(b, b0), `B untouched (${fmt(b)} vs ${fmt(b0)})`).toBe(true);
});

test("§0.3 PgDn mid-drag: the drag never lands on B", async ({ page }) => {
  const { a0, b0 } = await setup(page);
  await drag(page, "Brightness", 60, { release: false });
  await key(page, "PageDown");
  await page.waitForTimeout(150);
  await page.mouse.up();
  const b = await settled(page);
  await key(page, "PageUp");
  const a = await settled(page);
  console.log("mid-drag: B", fmt(b), "A", fmt(a), "A0", fmt(a0));
  expect.soft(same(b, b0), `B untouched (${fmt(b)} vs ${fmt(b0)})`).toBe(true);
});

test("§0.4 switch while an edit is processing: it lands on A, not B", async ({ page }) => {
  const { a0, b0 } = await setup(page);
  // Commit and switch in the same breath — the engine is still working.
  await drag(page, "Brightness", 60, { release: false });
  await page.mouse.up();
  await key(page, "PageDown");
  const b = await settled(page);
  await key(page, "PageUp");
  const a = await settled(page);
  console.log("processing: B", fmt(b), "A", fmt(a), "A0", fmt(a0));
  expect.soft(same(b, b0), `B untouched (${fmt(b)} vs ${fmt(b0)})`).toBe(true);
  expect.soft(!same(a, a0), `A got the edit (${fmt(a)} vs untouched ${fmt(a0)})`).toBe(true);
});

test("§0.5 bounce: edited A, click B then A at once — you end on A", async ({ page }) => {
  const { b0 } = await setup(page);
  await drag(page, "Brightness", 40);
  const a1 = await settled(page);
  const thumbs = page.locator('[aria-label^="Select photo"]');
  await thumbs.nth(1).click();
  await thumbs.nth(0).click();
  const end = await settled(page);
  console.log("bounce: end", fmt(end));
  expect.soft(same(end, a1), `ended on A with +40 (${fmt(end)} vs ${fmt(a1)}; B is ${fmt(b0)})`).toBe(true);
});

// The bug §0.4 found. A switch decided whether to save the outgoing photo from
// React's copy of the undo count, which lags the engine by one async sync — so
// an edit released an instant before PgDn was skipped and gone on return. It
// hit about half the time (6 of 12 measured), so the test tries four times:
// ~94% odds of going red if the engine read is ever removed.
test("§0.6 an edit released an instant before a switch is kept", async ({ page }) => {
  const { a0 } = await setup(page);
  let expected = a0;
  for (let i = 0; i < 4; i++) {
    await drag(page, "Brightness", i % 2 ? -30 : 30);
    await key(page, "PageDown");
    await settled(page);
    await key(page, "PageUp");
    const a = await settled(page);
    expect(same(a, expected), `round ${i + 1}: A lost the edit (${fmt(a)} is the pre-edit ${fmt(expected)})`).toBe(false);
    expected = a!;
  }
});


/** Which thumbnail is lit: 0 = A, 1 = B, -1 = none. */
const activeThumb = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('[aria-label^="Select photo"]')].findIndex((t) => t.getAttribute("aria-pressed") === "true"),
  );

test("§0.7 edited A, fast switching: the lit photo and the canvas agree, and it is A", async ({ page }) => {
  const { b0 } = await setup(page);
  await drag(page, "Brightness", 40);
  const a1 = await settled(page);
  for (let i = 0; i < 5; i++) {
    await key(page, "PageDown");
    await page.waitForTimeout(100);
    await key(page, "PageUp");
    await page.waitForTimeout(100);
  }
  const end = await settled(page);
  const lit = await activeThumb(page);
  console.log(`FAST end: lit=${lit} canvas=${fmt(end)} isA1=${same(end, a1)} isB=${same(end, b0)}`);
  expect.soft(lit, "the lit thumbnail is A (the last key was PgUp)").toBe(0);
  expect.soft(same(end, a1), `A with its +40 is on screen (${fmt(end)}; A+40 is ${fmt(a1)})`).toBe(true);
});
