import { test, expect, type Page } from "@playwright/test";
import { join } from "node:path";

// Chris, 10-01-2026: "make these buttons two on one row and two on the next —
// make sure they are using a common ui … icons should be at the same place on
// each button — makes me think it is not using the common button ui".
//
// ⚠️ IT WAS ALREADY THE COMMON PRIMITIVE, and the icons were already aligned.
// Measured at `columns={4}` before changing anything: all four tiles 51×71,
// icon 13px from the top and 0px off centre on every one — identical to what
// 2×2 produces. Nothing wrapped, nothing was clipped. So the misalignment was
// not reproducible, and the change is the layout he asked for rather than a fix
// for the cause he guessed at.
//
// What this test is for is the layout holding: 2 rows × 2 columns, four equal
// tiles, and icons that agree. The icon assertions are cheap and would catch a
// real regression later (a longer label, a different icon size), so they stay —
// they just were not red to begin with.
//
// Measured rather than structural on purpose: a 4-across grid of the same
// component with the same icons passes every DOM-shape check there is.

const FIXTURE = join(__dirname, "fixtures", "sky-building.png");
const LABELS = ["H", "V", "Clear", "Lock"] as const;

async function blockExternalNetwork(page: Page): Promise<void> {
  await page.route("**/*", (route) => {
    const url = route.request().url();
    if (/^https?:\/\/(localhost|127\.0\.0\.1)[:/]/.test(url) || url.startsWith("blob:") || url.startsWith("data:")) {
      return route.continue();
    }
    return route.abort();
  });
}

/** Each guide tile's box, and where its icon sits INSIDE that box. */
const tiles = (page: Page) =>
  page.evaluate((labels) => {
    return labels.map((label) => {
      const el = [...document.querySelectorAll("button")].find(
        (b) => (b.textContent || "").trim() === label,
      );
      if (!el) return { label, found: false as const };
      const r = el.getBoundingClientRect();
      const svg = el.querySelector("svg");
      const s = svg?.getBoundingClientRect();
      return {
        label,
        found: true as const,
        w: Math.round(r.width),
        h: Math.round(r.height),
        top: Math.round(r.top),
        left: Math.round(r.left),
        // The number Chris was actually looking at.
        iconTop: s ? Math.round(s.top - r.top) : null,
        iconDx: s ? Math.round(s.left + s.width / 2 - (r.left + r.width / 2)) : null,
        iconW: s ? Math.round(s.width) : null,
      };
    });
  }, LABELS as unknown as string[]);

test.setTimeout(150_000);

test("the four Guides buttons are a 2×2 grid with their icons in the same place", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await blockExternalNetwork(page);
  await page.goto("/");
  const input = page.locator('input[type="file"]').first();
  await input.waitFor({ state: "attached" });
  await input.setInputFiles([FIXTURE]);
  await page.locator("canvas.main-canvas").waitFor({ state: "visible", timeout: 30_000 });
  await page.waitForTimeout(1200);

  await page.getByRole("button", { name: "Edit", exact: true }).first().click();
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: "Guides", exact: true }).first().click();
  await page.waitForTimeout(700);

  const t = await tiles(page);
  console.log("guides tiles: " + JSON.stringify(t));
  for (const x of t) expect(x.found, `${x.label} is on screen`).toBe(true);
  const got = t as Extract<(typeof t)[number], { found: true }>[];

  // 2 ROWS AND 2 COLUMNS. Two distinct tops, two distinct lefts — which is
  // what "two on one row and two on the next" means, and what a 4-across or a
  // 1-across layout would both fail.
  expect(new Set(got.map((g) => g.top)).size, "exactly two rows").toBe(2);
  expect(new Set(got.map((g) => g.left)).size, "exactly two columns").toBe(2);

  // Every tile the same size, so no label is squeezed harder than its neighbour.
  expect(new Set(got.map((g) => `${g.w}x${g.h}`)).size, "all four tiles the same size").toBe(1);

  // THE ACTUAL COMPLAINT: the icons must agree. One wrapped label is enough to
  // break this, which is why it is asserted on the measured offset rather than
  // on the class list.
  expect(new Set(got.map((g) => g.iconTop)).size, "every icon the same distance from its button's top").toBe(1);
  expect(new Set(got.map((g) => g.iconW)).size, "every icon the same size").toBe(1);
  for (const g of got) {
    expect(Math.abs(g.iconDx!), `${g.label}'s icon is centred`).toBeLessThanOrEqual(1);
  }

  // And a tile has to be wide enough for its own word, or the wrap comes back.
  expect(got[0]!.w, "tiles are wide enough for 'Clear' on one line").toBeGreaterThan(80);
});
