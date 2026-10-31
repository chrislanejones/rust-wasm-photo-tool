import { test, expect } from "./guard/test";
import type { Page } from "@playwright/test";
import { join } from "node:path";

// ─────────────────────────────────────────────────────────────────────────────
// One tile per tool (Night 10-28, §1). Chris saw two Create tiles that opened
// the same "Arrows & Diagram Shapes" panel. The second one was Select objects:
// it shares the `shapes` tool and carries no mode, so its tile rendered the
// Shapes panel in whatever mode was used last — after Arrows & Shapes, the
// whole arrow and diagram-shape picker, under a different tile.
//
// Pass means: exactly one control on screen opens Arrows & Shapes, and the
// Select objects tile opens a panel of its own, whatever mode came before it.
// ─────────────────────────────────────────────────────────────────────────────

const FIXTURE_PNG = join(__dirname, "fixtures", "paper-1200x900.png");
const SHOTS = process.env.ONE_TILE_SHOTS;

async function open(page: Page, width = 1280) {
  await page.setViewportSize({ width, height: 900 });
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
}

const panel = (page: Page) => page.getByRole("region", { name: "Tool options" });
const subTools = (page: Page) => page.getByRole("toolbar", { name: "Create sub-tools" });

async function createTool(page: Page, name: string) {
  await page.getByRole("button", { name: "Create", exact: true }).first().click();
  await subTools(page).getByRole("button", { name, exact: true }).click();
}

async function shot(page: Page, name: string) {
  if (!SHOTS) return;
  for (const theme of ["light", "dark"] as const) {
    await page.evaluate((t) => document.documentElement.classList.toggle("dark", t === "dark"), theme);
    await page.waitForTimeout(150);
    await page.screenshot({ path: join(SHOTS, `${name}-${theme}.png`) });
  }
}

test("exactly one tile opens Arrows & Diagram Shapes", async ({ page }) => {
  await open(page);
  await createTool(page, "Arrows & Diagram Shapes");
  await expect(panel(page).getByText("Arrows & Diagram Shapes")).toBeVisible();
  await shot(page, "1280-arrows");

  // Every control on screen that opens the arrow and diagram-shape picker.
  await expect(page.getByRole("button", { name: "Arrows & Diagram Shapes", exact: true })).toHaveCount(1);

  await subTools(page).getByRole("button", { name: "Select objects", exact: true }).click();
  await shot(page, "1280-select-objects");
  await expect(panel(page).getByText("Arrows & Diagram Shapes")).toHaveCount(0);
  await expect(panel(page).getByRole("radiogroup", { name: "Arrow" })).toHaveCount(0);
  await expect(panel(page).getByText("Select objects", { exact: true })).toBeVisible();
});

test("Select objects keeps its own panel after Shapes and after Pins", async ({ page }) => {
  await open(page);
  for (const before of ["Shapes", "Pins"]) {
    await createTool(page, before);
    await subTools(page).getByRole("button", { name: "Select objects", exact: true }).click();
    await expect(panel(page).getByText("Select objects", { exact: true })).toBeVisible();
    await expect(panel(page).getByRole("radiogroup", { name: "Shape" })).toHaveCount(0);
  }
});

test("the route still lands on Arrows & Diagram Shapes, and Select objects on its own panel", async ({ page }) => {
  await open(page);
  await page.evaluate(() => { location.hash = "#/create/arrow"; });
  await expect(panel(page).getByText("Arrows & Diagram Shapes")).toBeVisible();
  await page.evaluate(() => { location.hash = "#/create/select-objects"; });
  await expect(panel(page).getByText("Select objects", { exact: true })).toBeVisible();
  await expect(panel(page).getByText("Arrows & Diagram Shapes")).toHaveCount(0);
});

test("phone width: no tile is lost", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.locator('input[type="file"]').first().setInputFiles(FIXTURE_PNG);
  await page.waitForTimeout(1500);
  await shot(page, "390-boot");
  // The phone layout is gallery-first and fetches no engine (ADR-080 era), so
  // there may be no tool rail to check. When there is one, the tiles hold.
  const create = page.getByRole("button", { name: "Create", exact: true }).first();
  if (!(await create.isVisible())) test.skip(true, "the phone layout has no tool rail");
  await createTool(page, "Arrows & Diagram Shapes");
  await subTools(page).getByRole("button", { name: "Select objects", exact: true }).click();
  await shot(page, "390-select-objects");
  await expect(panel(page).getByText("Arrows & Diagram Shapes")).toHaveCount(0);
});

// Every tile in every group opens a panel of its own: no two tiles in one
// group show the same header. A Coming Soon, Pro or offline tile is skipped.
// The printed table is the per-panel verdict in the PR.
test("no two tiles in a group open the same panel", async ({ page }) => {
  test.setTimeout(240_000);
  await open(page);
  // Batch needs a second photo before its tile wakes up.
  await page.locator('input[type="file"]').first().setInputFiles(join(__dirname, "fixtures", "resize-256.png"));
  await expect(page.getByRole("button", { name: "Batch", exact: true }).first()).toBeEnabled();
  const rows: string[] = [];
  for (const group of ["Enhance", "Select", "Create", "Edit", "Batch"]) {
    await page.getByRole("button", { name: group, exact: true }).first().click({ timeout: 10_000 });
    const row = page.getByRole("toolbar", { name: `${group} sub-tools` });
    const tiles = row.getByRole("button");
    const seen = new Map<string, string>();
    for (let i = 0; i < (await tiles.count()); i++) {
      const tile = tiles.nth(i);
      const name = (await tile.getAttribute("aria-label")) ?? `#${i}`;
      if (await tile.isDisabled()) { rows.push(`${group} › ${name}: skipped (disabled)`); continue; }
      await tile.click({ timeout: 10_000 });
      await page.waitForTimeout(400);
      // The panel's first section heading (SectionHeader's mono title). Batch
      // panels open on a Main | Exceptions strip, so the first LINE is the
      // same for all five and would say nothing.
      const head = await panel(page).evaluate((el) =>
        el.querySelector("span.font-mono")?.textContent?.trim() ?? "");
      rows.push(`${group} › ${name}: ${head}`);
      if (head) {
        expect(seen.get(head), `${group}: "${name}" opens the same panel as "${seen.get(head)}"`).toBeUndefined();
        seen.set(head, name);
      }
    }
  }
  console.log("PANELS\n" + rows.join("\n"));
});
