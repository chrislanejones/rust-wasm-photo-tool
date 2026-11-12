import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";

// /design-system (UI Night 21). Run against the production build:
//   pnpm -C marketing run build && pnpm -C marketing exec playwright test
// SHOTS=<dir> also writes screenshots at 1440, 960 and 390 wide.

async function go(page: Page, path = "/design-system") {
  await page.goto(path);
  await expect(page.getByRole("heading", { level: 1, name: "Design System" })).toBeVisible();
}

test("direct load and refresh both render the page", async ({ page }) => {
  await go(page);
  await page.reload();
  await expect(page.getByRole("heading", { level: 1, name: "Design System" })).toBeVisible();
  expect(await page.title()).toContain("Design System");
});

test("Learn → Design System navigates, and the feature panel follows hover", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Primary" });
  // Learn opens on hover (a click on an open menu closes it again).
  await nav.getByRole("menuitem", { name: "Learn" }).hover();
  const card = page.locator(".nav-mega__learn-grid").getByRole("link", { name: /Design System/ });
  await card.hover();
  // The feature panel swaps to the hovered page's lines.
  await expect(page.locator(".nav-mega__learn .nav-mega__feat")).toContainText("How the editor looks and behaves");
  // Eight cards: five on the first row, three on the second.
  const tops = await page.locator(".nav-mega__learn-grid > a").evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)));
  expect(tops.length).toBe(8);
  expect(tops.filter((t) => t === tops[0]).length, "five on the first row").toBe(5);
  await card.click();
  await expect(page).toHaveURL(/\/design-system$/);
  await expect(page.getByRole("heading", { level: 1, name: "Design System" })).toBeVisible();
});

test("the phone menu has it, and it works", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Menu" }).click();
  await page.getByRole("link", { name: /Design System/ }).first().click();
  await expect(page).toHaveURL(/\/design-system$/);
});

test("the Command Palette finds it", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.getByRole("button", { name: /Search this site/ }).click();
  const input = page.getByPlaceholder("Search pages, sections, source…");
  await input.fill("design system");
  await expect(page.getByRole("option", { name: /^Design System/ })).toBeVisible();
  await input.press("Enter");
  await expect(page).toHaveURL(/\/design-system$/);
});

test("two tabs: Editor opens first, Marketing switches the panel, arrows move between them", async ({ page }) => {
  await go(page);
  const editor = page.getByRole("tab", { name: /Image Horse Editor/ });
  const marketing = page.getByRole("tab", { name: /Image Horse Marketing/ });
  await expect(editor).toHaveAttribute("aria-selected", "true");
  await expect(marketing).toHaveAttribute("aria-selected", "false");
  await expect(page.getByRole("tabpanel")).toHaveAttribute("aria-labelledby", "ds-tab-editor");
  await marketing.click();
  await expect(marketing).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tabpanel")).toHaveAttribute("aria-labelledby", "ds-tab-marketing");
  await expect(page).toHaveURL(/#marketing$/);
  await expect(page.getByRole("heading", { level: 2, name: "Motion" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Loading and interaction states" })).toBeHidden();
  // Arrow keys move the selection and the focus together.
  await page.keyboard.press("ArrowLeft");
  await expect(editor).toBeFocused();
  await expect(editor).toHaveAttribute("aria-selected", "true");
});

test("the two tabs are one even row, like the Trail Log's tiles", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await go(page);
  const boxes = await page.getByRole("tab").evaluateAll((els) => els.map((e) => e.getBoundingClientRect()).map((r) => ({ top: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) })));
  expect(boxes).toHaveLength(2);
  expect(boxes[0].top).toBe(boxes[1].top);
  expect(Math.abs(boxes[0].w - boxes[1].w)).toBeLessThanOrEqual(1);
  expect(boxes[0].h).toBeGreaterThanOrEqual(44);
});

test("a link to a Marketing section opens the Marketing tab on it", async ({ page }) => {
  await page.goto("/design-system#m-color");
  await expect(page.getByRole("tab", { name: /Image Horse Marketing/ })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("heading", { level: 2, name: "Colors", exact: true })).toBeInViewport();
});

test("the Marketing tab shows the site's real token values", async ({ page }) => {
  await page.goto("/design-system#marketing");
  const swatch = page.locator(".ds-swatch").filter({ hasText: "--color-accent-ink" });
  await expect(swatch).toContainText("oklch(15% 0.040 50)");
  // Ink is measured against the page background, and passes AA.
  const ink2 = page.locator("#ds-panel-marketing .ds-swatch").filter({ hasText: /--color-ink-2/ });
  const ratio = Number((await ink2.innerText()).match(/([\d.]+):1/)![1]);
  expect(ratio).toBeGreaterThanOrEqual(4.5);
});

test("component cards line up across a row", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await go(page);
  // The first row of Actions: Button, IconButton, ToolButton. Button's picture
  // wraps to two lines; the names under all three still share one line.
  const row = page.locator("#components .ds-comps").first().locator("> .ds-comp");
  const read = (sel: string) => row.locator(sel).evaluateAll((els) => els.slice(0, 3).map((e) => Math.round(e.getBoundingClientRect().top)));
  for (const sel of [".ds-comp__name", ".ds-comp__what", ".ds-comp__src", '.ds-ed[data-theme="dark"]']) {
    const tops = await read(sel);
    expect(tops, sel).toHaveLength(3);
    expect(new Set(tops).size, `${sel} tops ${tops.join(", ")}`).toBe(1);
  }
});

test("each tab ends with its Figma file and its source", async ({ page }) => {
  await go(page);
  const editor = page.locator("#ds-panel-editor .arch-coda");
  await expect(editor.getByRole("link", { name: /Open the Figma file/ })).toHaveAttribute("href", /figma\.com\/design\/FDdCTUAv9LPdVy5lHwCwtA/);
  await expect(editor.getByRole("link", { name: /Read the UI consistency doc/ })).toBeVisible();
  await page.getByRole("tab", { name: /Image Horse Marketing/ }).click();
  const site = page.locator("#ds-panel-marketing .arch-coda");
  await expect(site.getByRole("link", { name: /Open the Figma file/ })).toHaveAttribute("href", /figma\.com\/design\/u596SNiguDyjqlXObV2BZi/);
  await expect(site.getByRole("link", { name: /Read tokens\.css/ })).toBeVisible();
});

test("section links land on their sections", async ({ page }) => {
  await go(page);
  await page.getByRole("navigation", { name: "On this page" }).getByRole("link", { name: "Typography" }).click();
  await expect(page).toHaveURL(/#type$/);
  await expect(page.getByRole("heading", { level: 2, name: "Typography" })).toBeInViewport();
});

test("the specimens show the editor's real light and dark values, and the preview switches", async ({ page }) => {
  await go(page);
  const swatch = page.locator(".ds-swatch").filter({ hasText: "--bg-primary" });
  await expect(swatch).toContainText("#f3efe8");
  await expect(swatch).toContainText("#121212");
  const group = page.getByRole("radiogroup", { name: "Editor theme in the examples" });
  await group.getByRole("radio", { name: "Light" }).click();
  await expect(swatch).toContainText("#f3efe8");
  await expect(swatch).not.toContainText("#121212");
  await expect(page.locator('.ds-ed[data-theme="dark"]')).toHaveCount(0);
  const bg = await page.locator('.ds-ed[data-theme="light"]').first().evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(bg, "--bg-secondary, light").toBe("rgb(251, 249, 245)");
});

test("headings: one h1, and no level is skipped", async ({ page }) => {
  await go(page);
  const levels = await page.locator("main h1, main h2, main h3, main h4").evaluateAll((els) => els.map((e) => Number(e.tagName[1])));
  expect(levels.filter((l) => l === 1)).toHaveLength(1);
  for (let i = 1; i < levels.length; i++) expect(levels[i] - levels[i - 1], `heading ${i}`).toBeLessThanOrEqual(1);
});

test("Reduce Motion stops the skeleton shimmer", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await go(page);
  const anim = await page.locator(".ds-skel").first().evaluate((el) => getComputedStyle(el, "::after").animationName);
  expect(anim).toBe("none");
});

test("a fast load never shows a skeleton", async ({ page }) => {
  await go(page);
  await page.getByRole("button", { name: "Load in 150 ms" }).click();
  await expect(page.locator("#states .ds-demo")).toContainText("No skeleton was shown.");
  await expect(page.locator(".ds-thumbs .ds-skel")).toHaveCount(0);
});

test("keyboard focus is visible on the page's controls", async ({ page }) => {
  await go(page);
  await page.getByRole("tab", { name: /Image Horse Editor/ }).focus();
  await page.keyboard.press("Tab");
  const outline = await page.evaluate(() => getComputedStyle(document.activeElement!).outlineStyle);
  expect(outline).not.toBe("none");
});

test("body text has enough contrast", async ({ page }) => {
  await go(page);
  // WCAG AA, 4.5:1, for the page's own small text on its own background.
  const ratio = await page.locator(".ds-note").first().evaluate((el) => {
    const c = document.createElement("canvas").getContext("2d")!;
    const rgb = (css: string) => { c.fillStyle = css; c.fillRect(0, 0, 1, 1); return Array.from(c.getImageData(0, 0, 1, 1).data).slice(0, 3); };
    const lum = (v: number[]) => v.map((x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }).reduce((s, x, i) => s + x * [0.2126, 0.7152, 0.0722][i], 0);
    let bgEl: Element | null = el;
    let bg = "rgba(0, 0, 0, 0)";
    while (bgEl && (bg = getComputedStyle(bgEl).backgroundColor) === "rgba(0, 0, 0, 0)") bgEl = bgEl.parentElement;
    const a = lum(rgb(getComputedStyle(el).color)), b = lum(rgb(bg));
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  });
  expect(ratio).toBeGreaterThanOrEqual(4.5);
});

test("screenshots at desktop, dock and phone", async ({ page }) => {
  const dir = process.env.SHOTS;
  test.skip(!dir, "set SHOTS=<dir> to write screenshots");
  mkdirSync(dir!, { recursive: true });
  for (const [name, w, h] of [["desktop-1440", 1440, 900], ["dock-960", 960, 800], ["phone-390", 390, 844]] as const) {
    await page.setViewportSize({ width: w, height: h });
    await go(page);
    await page.screenshot({ path: `${dir}/${name}-top.png` });
    await page.locator("#color").scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${dir}/${name}-colors.png`, fullPage: false });
    await page.locator("#components").scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${dir}/${name}-components.png` });
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await go(page);
  const group = page.getByRole("radiogroup", { name: "Editor theme in the examples" });
  for (const t of ["Light", "Dark"]) {
    await group.getByRole("radio", { name: t }).click();
    await page.locator("#components").scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${dir}/editor-${t.toLowerCase()}-components.png` });
  }
  // The Marketing tab, and the closing row of each tab.
  for (const [name, w, h] of [["desktop-1440", 1440, 900], ["phone-390", 390, 844]] as const) {
    await page.setViewportSize({ width: w, height: h });
    await page.goto("/design-system#marketing");
    await expect(page.getByRole("tab", { name: /Image Horse Marketing/ })).toHaveAttribute("aria-selected", "true");
    await page.screenshot({ path: `${dir}/${name}-marketing-top.png` });
    for (const id of ["m-color", "m-type", "m-space", "m-components", "m-motion"]) {
      await page.locator(`#${id}`).scrollIntoViewIfNeeded();
      await page.locator(`#${id}`).evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 120));
      await page.screenshot({ path: `${dir}/${name}-${id}.png` });
    }
    await page.locator("#ds-panel-marketing .arch-coda").scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${dir}/${name}-marketing-coda.png` });
    await page.goto("/design-system");
    await page.locator("#ds-panel-editor .arch-coda").scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${dir}/${name}-editor-coda.png` });
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/trail-log");
  await page.screenshot({ path: `${dir}/trail-tiles-1440.png` });
  await page.goto("/");
  await page.getByRole("navigation", { name: "Primary" }).getByRole("menuitem", { name: "Learn" }).hover();
  await page.locator(".nav-mega__learn-grid").getByRole("link", { name: /Design System/ }).hover();
  await page.screenshot({ path: `${dir}/learn-menu-1440.png` });
});
