import { test, expect, type Page } from "@playwright/test";
import { join } from "node:path";

// Skeleton plan §1–§3, §5: the Tools card names its photo and cues every
// switch, a per-photo panel locks while one is in flight (skeletons in place
// when it is slow), and per-tool settings are untouched. Each check here goes
// red if its piece is removed.
//
// The name line is the CARD's footer as of 10-02-2026, not a line inside each
// per-photo panel, so two of these changed with it: C2 asserts the footer is
// on a per-TOOL panel too (it used to assert the opposite), and C3 compares
// every child of the region rather than skipping the first, because the region
// is now nothing but controls.

const FIXTURES = [
  join(__dirname, "fixtures", "checker.png"),
  join(__dirname, "fixtures", "sky-building.png"),
];

async function blockExternalNetwork(page: Page): Promise<void> {
  await page.route("**/*", (route) => {
    const url = route.request().url();
    if (/^https?:\/\/(localhost|127\.0\.0\.1)[:/]/.test(url) || url.startsWith("blob:") || url.startsWith("data:")) {
      return route.continue();
    }
    return route.abort();
  });
}

const canvasSize = (page: Page) =>
  page.evaluate(() => {
    const c = document.querySelector<HTMLCanvasElement>("canvas.main-canvas");
    return c ? `${c.width}x${c.height}` : "none";
  });

async function setup(page: Page) {
  await blockExternalNetwork(page);
  await page.goto("/");
  const input = page.locator('input[type="file"]').first();
  await input.waitFor({ state: "attached" });
  await input.setInputFiles(FIXTURES);
  await page.locator("canvas.main-canvas").waitFor({ state: "visible", timeout: 30_000 });
  await expect.poll(() => canvasSize(page), { timeout: 30_000 }).not.toBe("none");
  await page.waitForTimeout(1500);
}

async function open(page: Page, group: string, tool: string) {
  await page.getByRole("button", { name: group, exact: true }).first().click();
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: tool, exact: true }).first().click();
  await page.waitForTimeout(500);
}

async function pgDn(page: Page) {
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press("PageDown");
}

/** Record every state the region passes through, plus each direct child's box
 *  while the skeleton shows — so the layout-shift check compares real frames. */
async function watchRegion(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as { __rec: { busy: number; skel: boolean; busyCount: number; boxes: string | null } };
    w.__rec = { busy: 0, skel: false, busyCount: 0, boxes: null };
    const boxes = (r: Element) =>
      [...r.children].filter((c) => !c.classList.contains("sr-only")).map((c) => { const b = c.getBoundingClientRect(); return `${Math.round(b.width)}x${Math.round(b.height)}`; }).join(",");
    const obs = new MutationObserver(() => {
      const r = document.querySelector(".per-photo-region");
      if (!r) return;
      if (r.getAttribute("aria-busy") === "true") {
        w.__rec.busy++;
        w.__rec.busyCount = Math.max(w.__rec.busyCount, document.querySelectorAll('[aria-busy="true"]').length);
      }
      if (r.hasAttribute("data-switch-skeleton") && !w.__rec.skel) {
        w.__rec.skel = true;
        w.__rec.boxes = boxes(r);
      }
    });
    obs.observe(document.body, { subtree: true, attributes: true, attributeFilter: ["aria-busy", "data-switch-skeleton"] });
  });
}

test.setTimeout(150_000);

test("C1 the Tools card names its photo, and the name follows the switch", async ({ page }) => {
  await setup(page);
  await open(page, "Enhance", "Adjustments");
  const line = page.locator(".per-photo-name");
  await expect(line).toHaveText(/^1 of 2 · checker$/);
  await pgDn(page);
  await expect(line).toHaveText(/^2 of 2 · sky-building$/, { timeout: 30_000 });
  // The cue: the line re-highlights on the switch.
  await expect(line).toHaveClass(/per-photo-name-flash/);
});

test("C2 a per-TOOL panel carries the footer too, and it is not inside the lock region", async ({ page }) => {
  await setup(page);
  await open(page, "Create", "Brush");
  // The footer belongs to the CARD, so a brush panel has it even though the
  // brush itself belongs to no photo (Chris, 10-02-2026). Before that it was
  // per-photo-panels only and this asserted toHaveCount(0).
  const line = page.locator(".per-photo-name");
  await expect(line).toHaveCount(1);
  await expect(line).toHaveText(/^1 of 2 · checker$/);
  // Brush is a per-TOOL panel, so there is no lock region at all here — and
  // on the panels that have one, the footer is outside it rather than carved
  // out of the skeleton CSS by name.
  await expect(page.locator(".per-photo-region .per-photo-name")).toHaveCount(0);
});

test("C2b the footer is a 20px strip, same as the Layers summary, and neither is bold", async ({ page }) => {
  await setup(page);
  await open(page, "Create", "Brush");
  const strip = await page.locator(".per-photo-name").evaluate((e) => {
    const cs = getComputedStyle(e);
    return { h: Math.round(e.getBoundingClientRect().height), weight: cs.fontWeight };
  });
  expect(strip.h, "the card footer is the bottom 20px").toBe(20);
  expect(Number(strip.weight), "nothing in the footer is bold").toBeLessThan(600);
});

test("C3 a slow switch locks the panel, shows skeletons in place, one aria-busy, no layout shift", async ({ page }) => {
  await setup(page);
  await open(page, "Enhance", "Adjustments");
  const region = page.locator(".per-photo-region");
  const before = await region.evaluate((r) =>
    [...r.children].filter((c) => !c.classList.contains("sr-only")).map((c) => { const b = c.getBoundingClientRect(); return `${Math.round(b.width)}x${Math.round(b.height)}`; }).join(","),
  );
  await watchRegion(page);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 30 });
  await pgDn(page);
  await expect.poll(() => page.evaluate(() => (window as unknown as { __rec: { skel: boolean } }).__rec.skel), { timeout: 60_000 }).toBe(true);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
  await expect(region).not.toHaveAttribute("aria-busy", "true", { timeout: 60_000 });
  const rec = await page.evaluate(() => (window as unknown as { __rec: { busy: number; busyCount: number; boxes: string } }).__rec);
  expect(rec.busy, "the panel was locked (aria-busy + inert) during the switch").toBeGreaterThan(0);
  expect(rec.busyCount, "one aria-busy region, not a list of grey boxes").toBe(1);
  // Same boxes before, during (skeleton) and after. Every child of the region
  // is a control now that the name line has moved out to the card footer, so
  // this compares all of them — it used to drop the first entry to skip the
  // line, whose text width changed on every switch.
  const after = await region.evaluate((r) =>
    [...r.children].filter((c) => !c.classList.contains("sr-only")).map((c) => { const b = c.getBoundingClientRect(); return `${Math.round(b.width)}x${Math.round(b.height)}`; }).join(","),
  );
  const controls = (s: string) => s.split(",").filter((x) => x !== "0x0");
  expect(controls(before).length, "the region has controls to compare").toBeGreaterThan(0);
  expect(controls(rec.boxes), "skeleton boxes match the controls exactly").toEqual(controls(before));
  expect(controls(after), "nothing moved when the values returned").toEqual(controls(before));
});

test("C4 a per-tool setting survives a switch unchanged", async ({ page }) => {
  await setup(page);
  await open(page, "Create", "Brush");
  const size = page.getByRole("slider", { name: /Brush Size|Size/ }).first();
  const b = (await size.boundingBox())!;
  await page.mouse.click(b.x + b.width * 0.8, b.y + b.height / 2);
  const was = await size.inputValue();
  await pgDn(page);
  await expect.poll(() => canvasSize(page), { timeout: 30_000 }).toBe("1220x820");
  expect(await size.inputValue(), "the brush didn't change because the photo did").toBe(was);
});

test("C5 screen readers hear 'Switched to …' once the new photo is in", async ({ page }) => {
  await setup(page);
  await pgDn(page);
  await expect(page.getByRole("status").filter({ hasText: /^Switched to sky-building$/ })).toHaveCount(1, { timeout: 30_000 });
});

test("C6 reduced motion: the cue holds a static tint, the skeleton does not shimmer", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await setup(page);
  await open(page, "Enhance", "Adjustments");
  await pgDn(page);
  const line = page.locator(".per-photo-name");
  await expect(line).toHaveClass(/per-photo-name-flash/, { timeout: 30_000 });
  expect(await line.evaluate((e) => getComputedStyle(e).animationName)).toBe("per-photo-name-hold");
  const shimmer = await page.evaluate(() => {
    const d = document.createElement("div");
    d.setAttribute("data-switch-skeleton", "");
    document.body.appendChild(d);
    const v = getComputedStyle(d, "::after").display;
    d.remove();
    return v;
  });
  expect(shimmer, "no shimmer under reduced motion").toBe("none");
});

