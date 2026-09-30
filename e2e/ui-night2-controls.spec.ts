import { test, expect, type Page } from "@playwright/test";
import { join } from "node:path";

// ─────────────────────────────────────────────────────────────────────────────
// UI Night 2: the parts of the control contract that only a real browser can
// check. jsdom computes no stylesheet and has no Tab order, so the unit tests
// (components/ui/segmented-modes.test.ts) cover roles, names and arrow keys,
// and this spec covers what they cannot:
//
//   • a SELECT group is ONE Tab stop in the real tab order, and the
//     accessibility tree (what getByRole reads) exposes it as a named
//     radiogroup of radios with the right one checked;
//   • the focus ring is actually painted on the plain inputs that
//     PARKING_LOT once listed as having none (measured on Night 2: they
//     have the house ring, from the global `input:focus-visible` rule).
// ─────────────────────────────────────────────────────────────────────────────

const FIXTURE_PNG = join(__dirname, "fixtures", "checker.png");

async function blockExternalNetwork(page: Page): Promise<void> {
  await page.route("**/*", (route) => {
    const url = route.request().url();
    if (
      /^https?:\/\/(localhost|127\.0\.0\.1)[:/]/.test(url) ||
      url.startsWith("blob:") ||
      url.startsWith("data:")
    ) {
      return route.continue();
    }
    return route.abort();
  });
}

async function importImages(page: Page, count: number): Promise<void> {
  const input = page.locator('input[type="file"]').first();
  await input.waitFor({ state: "attached" });
  // Batch tools need more than one image; the same fixture under several
  // names is enough.
  const png = await import("node:fs").then((fs) => fs.readFileSync(FIXTURE_PNG));
  await input.setInputFiles(
    Array.from({ length: count }, (_, i) => ({
      name: `checker-${i + 1}.png`,
      mimeType: "image/png",
      buffer: png,
    })),
  );
  await page.locator("canvas.main-canvas").waitFor({ state: "visible", timeout: 30_000 });
  await page.waitForTimeout(1200);
}

/** The focused element's painted focus treatment. */
async function focusRing(page: Page) {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement;
    const cs = getComputedStyle(el);
    return {
      tag: el.tagName.toLowerCase(),
      focusVisible: el.matches(":focus-visible"),
      style: cs.outlineStyle,
      width: parseFloat(cs.outlineWidth),
      color: cs.outlineColor,
    };
  });
}

function expectVisibleRing(r: Awaited<ReturnType<typeof focusRing>>, what: string): void {
  expect(r.focusVisible, `${what}: keyboard focus matches :focus-visible`).toBe(true);
  expect(r.style, `${what}: an outline is drawn`).not.toBe("none");
  expect(r.width, `${what}: the outline has width`).toBeGreaterThanOrEqual(2);
  expect(r.color, `${what}: the outline is not transparent`).not.toMatch(/rgba\(0, 0, 0, 0\)|transparent/);
}

test.beforeEach(async ({ page }) => {
  await blockExternalNetwork(page);
  await page.goto("/");
});

test("Settings › Appearance: each labeled pair is one named radio group and one Tab stop", async ({ page }) => {
  await importImages(page, 1);
  await page.getByRole("button", { name: /^Settings/ }).first().click();
  const dialog = page.getByRole("dialog").first();
  await dialog.getByRole("button", { name: "Appearance", exact: true }).click();

  // The accessibility tree, not the DOM: getByRole reads the tree.
  const theme = dialog.getByRole("radiogroup", { name: "Theme" });
  const motion = dialog.getByRole("radiogroup", { name: "Motion" });
  await expect(theme.getByRole("radio")).toHaveCount(3);
  await expect(motion.getByRole("radio")).toHaveCount(2);
  await expect(theme.getByRole("radio", { checked: true })).toHaveCount(1);

  // Tab from the nav button into the pane lands on the CHECKED theme option,
  // and one more Tab leaves the whole group for the next one.
  const checkedTheme = theme.getByRole("radio", { checked: true });
  const checkedName = (await checkedTheme.textContent())?.trim();
  await checkedTheme.focus();
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  await expect(checkedTheme).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(motion.getByRole("radio", { checked: true })).toBeFocused();

  // Arrow keys move and select inside the group; the ring moves with focus.
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("ArrowRight");
  const nowChecked = theme.getByRole("radio", { checked: true });
  await expect(nowChecked).not.toHaveText(checkedName ?? "");
  await expect(nowChecked).toBeFocused();
  expectVisibleRing(await focusRing(page), "arrowed-to theme option");
});

test("Batch › Rename: every plain text input shows the focus ring on keyboard focus", async ({ page }) => {
  await importImages(page, 3);
  await page.getByRole("button", { name: "Batch", exact: true }).first().click();
  await page.getByRole("button", { name: "Rename", exact: true }).first().click();

  const fields = [
    page.getByPlaceholder("{name}").first(),
    page.getByPlaceholder("Find").first(),
    page.getByPlaceholder("Replace").first(),
  ];
  for (const field of fields) {
    // Keyboard focus, not .focus(): focus the element before it, then Tab.
    await field.evaluate((el) => {
      const all = [...document.querySelectorAll<HTMLElement>("button,input,select,textarea,a[href]")];
      all[all.indexOf(el as HTMLElement) - 1]?.focus();
    });
    await page.keyboard.press("Tab");
    await expect(field).toBeFocused();
    expectVisibleRing(await focusRing(page), `Batch › Rename ${await field.getAttribute("placeholder")}`);
  }
});

test("Super User's plain inputs: their class string still gets the focus ring (proxy)", async ({ page }) => {
  // PROXY, stated plainly: the Super User pane is admin-only and does not
  // render in the demo build this harness runs. So the exact class string
  // SuperUserPane puts on its two inputs is placed in the Settings dialog —
  // the surface the pane lives on — and focused from the keyboard. What this
  // pins is the cascade: nothing between that class string and the global
  // `input:focus-visible` rule removes the ring.
  const SUPER_USER_INPUT =
    "rounded-md border border-border bg-bg-elevated px-2 py-1.5 font-mono text-text-primary";
  await importImages(page, 1);
  await page.getByRole("button", { name: /^Settings/ }).first().click();
  const dialog = page.getByRole("dialog").first();
  await dialog.getByRole("button", { name: "General", exact: true }).click();
  await dialog.evaluate((d, cls) => {
    const before = document.createElement("button");
    before.textContent = "before";
    const input = document.createElement("input");
    input.readOnly = true;
    input.className = cls;
    input.id = "night2-proxy";
    d.appendChild(before);
    d.appendChild(input);
    before.focus();
  }, SUPER_USER_INPUT);
  await page.keyboard.press("Tab");
  await expect(page.locator("#night2-proxy")).toBeFocused();
  expectVisibleRing(await focusRing(page), "Super User input class");
});
