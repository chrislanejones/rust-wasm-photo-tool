import { test, expect } from "../guard/test";
import type { Page, Download } from "@playwright/test";
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { installAnnotationProbe, screenPoint } from "../annotation-benchmark-harness";

// ─────────────────────────────────────────────────────────────────────────────
// imagehorse-qc, automated slice — 11-26-2026, against master 6322f8cf (v9.81),
// covering v9.70 – v9.81 (#497 – #520).
//
// Production build, logged-out demo mode (placeholder Convex/Clerk, every
// off-localhost request blocked). Kept in archive/ as the record of the run,
// not part of the suite. Results: docs/qc/qc-1126.md. Screenshots go to
// QC_SHOTS (default /tmp/qc1126/shots).
//
// What the suite's own specs do NOT already pin, and this adds:
//   Q1 boot logged out with no console errors, file picker AND drag-drop;
//   Q2 Find duplicates groups the turned and mirrored lakes (the suite's
//      fixture list leaves lake-rot90 and lake-mirror out);
//   Q3 every raster format writes the file it names (magic bytes), and the
//      dialog works by keyboard alone: Alt+E, arrows, Enter;
//   Q4 a recipe on Selected writes its size, format and quality, and what
//      the footer's "compressed" says next to the real file;
//   Q5 Edit swatches: Cancel changes nothing; × then OK keeps 11 after a
//      reload;
//   Q6 Hold Alt over Fill Color: opacity steps, release → back, one mode ring;
//   Q7 Stroke Stabilizer: the Pen panel shows it, the four tiles give four
//      different strokes, and what a reload does;
//   Q8 the color dialog's wheel and square are named in US English;
//   Q9 Export, the color dialog and the stabilizer row in light and dark.
//
// Run: copy playwright.config.ts to a throwaway playwright.qc.config.ts at the
// repo root that spreads the base config with
//   testDir: "./e2e/archive", testIgnore: [], testMatch: /qc-1126\.spec\.ts$/
// then PW_PORT=<port> pnpm exec playwright test --config playwright.qc.config.ts
// ─────────────────────────────────────────────────────────────────────────────
test.setTimeout(180_000);

const E2E = join(__dirname, "..");
const SHOTS = process.env.QC_SHOTS ?? "/tmp/qc1126/shots";
mkdirSync(SHOTS, { recursive: true });

const PAPER = join(E2E, "fixtures", "paper-1200x900.png");
const DUPES = join(E2E, "fixtures", "dupes");

async function blockExternal(page: Page) {
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    return ["localhost", "127.0.0.1"].includes(url.hostname) || ["blob:", "data:"].includes(url.protocol)
      ? route.continue()
      : route.abort();
  });
}

async function boot(page: Page, files: string[]) {
  await page.setViewportSize({ width: 1600, height: 1100 });
  await blockExternal(page);
  await page.addInitScript(() => {
    if (!localStorage.getItem("image-horse-prefs"))
      localStorage.setItem("image-horse-prefs", JSON.stringify({ canvasArtboard: false }));
  });
  await page.goto("/");
  const input = page.locator('input[type="file"]').first();
  await input.waitFor({ state: "attached" });
  await input.setInputFiles(files);
  await page.locator("canvas.main-canvas").waitFor({ state: "visible", timeout: 60_000 });
  await expect(page.locator(".photo-thumb")).toHaveCount(files.length, { timeout: 60_000 });
  await page.waitForTimeout(1500);
}

async function setTheme(page: Page, theme: "light" | "dark") {
  await page.evaluate((t) => {
    document.documentElement.classList.toggle("dark", t === "dark");
    document.documentElement.style.colorScheme = t;
  }, theme);
  await page.waitForTimeout(250);
}

async function openTool(page: Page, group: string, sub: string) {
  const opts = page.getByRole("region", { name: "Tool options" });
  await opts.getByRole("button", { name: group, exact: true }).first().click();
  await opts.getByRole("button", { name: sub, exact: true }).first().click();
}

async function bytesOf(d: Download): Promise<Buffer> {
  return readFileSync((await d.path())!);
}

/** What a file's first bytes say it is. */
function sniff(b: Buffer): string {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpeg";
  if (b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (b.toString("latin1", 0, 4) === "RIFF" && b.toString("latin1", 8, 12) === "WEBP") return "webp";
  if (b.toString("latin1", 4, 8) === "ftyp" && /avif|avis/.test(b.toString("latin1", 8, 12))) return "avif";
  return `unknown ${b.subarray(0, 12).toString("hex")}`;
}

/** A JPEG's size from its SOF0/SOF2 marker, and the first luminance
 *  quantization value (libjpeg's scaled table: q70 → 10, q85 → 5). */
function jpegInfo(b: Buffer): { w: number; h: number; q0: number | null } {
  let i = 2;
  let w = 0, h = 0, q0: number | null = null;
  while (i < b.length - 4) {
    if (b[i] !== 0xff) { i++; continue; }
    const m = b[i + 1]!;
    const len = b.readUInt16BE(i + 2);
    if (m === 0xdb && q0 === null) q0 = b[i + 5]!; // DQT: [len][Pq/Tq][64 values]
    if (m === 0xc0 || m === 0xc2) { h = b.readUInt16BE(i + 5); w = b.readUInt16BE(i + 7); break; }
    i += 2 + len;
  }
  return { w, h, q0 };
}

// ─────────────────────────────────────────────────────────────────────────────

test("Q1 boot: logged out, no console errors, file picker and drag-drop both import", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await boot(page, [join(DUPES, "lake-640.jpg")]);
  const b64 = readFileSync(join(DUPES, "pier-wide.jpg")).toString("base64");
  await page.evaluate((data) => {
    const bin = atob(data);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    const dt = new DataTransfer();
    dt.items.add(new File([arr], "pier-wide.jpg", { type: "image/jpeg" }));
    for (const type of ["dragenter", "dragover", "drop"])
      window.dispatchEvent(new DragEvent(type, { dataTransfer: dt, bubbles: true, cancelable: true }));
  }, b64);
  const ask = page.getByRole("dialog", { name: "Add this image" });
  await expect(ask).toBeVisible();
  await ask.getByRole("button", { name: /Add Image to Gallery/ }).click();
  await expect(page.locator(".photo-thumb")).toHaveCount(2, { timeout: 30_000 });
  const real = errors.filter((e) => !/Failed to load resource|net::ERR_FAILED|_vercel\/insights|ERR_BLOCKED/i.test(e));
  expect(real).toEqual([]);
});

test("Q2 Find duplicates: the turned and mirrored lakes join the lake group, the piers stay apart", async ({ page }) => {
  const names = ["lake-960", "lake-rot90", "lake-mirror", "pier-wide", "pier-close"];
  await boot(page, names.map((n) => join(DUPES, `${n}.jpg`)));
  await page.getByRole("button", { name: "Select by", exact: true }).click();
  await page.getByRole("menu", { name: "Select by" }).getByRole("menuitem", { name: "Find duplicates…" }).click();
  const dialog = page.getByRole("dialog", { name: "Find duplicates" });
  await expect(dialog.getByText(/1 group of look-alikes among 5 photos/)).toBeVisible({ timeout: 30_000 });
  const group = (await dialog.locator("section li[data-photo]").evaluateAll((els) => els.map((e) => e.getAttribute("data-photo")!))).sort();
  expect(group).toEqual(["lake-960", "lake-mirror", "lake-rot90"]);
  await expect(dialog.locator("li[data-photo^='pier']")).toHaveCount(0);
});

test("Q3 Export: each raster format writes what it names, and the dialog works by keyboard alone", async ({ page }) => {
  await boot(page, [PAPER]);
  const open = async () => {
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.keyboard.press("Alt+e");
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Export", exact: true })).toBeVisible();
    return dialog;
  };
  const got: Record<string, string> = {};
  for (const fmt of ["JPEG", "PNG", "WebP", "AVIF"]) {
    const dialog = await open();
    await dialog.getByRole("radiogroup", { name: "Format" }).getByRole("radio", { name: fmt, exact: true }).click();
    const [dl] = await Promise.all([
      page.waitForEvent("download"),
      dialog.getByRole("button", { name: `Download ${fmt}`, exact: true }).click(),
    ]);
    got[fmt] = sniff(await bytesOf(dl));
    expect(dl.suggestedFilename().toLowerCase(), fmt).toMatch(new RegExp(`\\.${fmt === "JPEG" ? "jpe?g" : fmt.toLowerCase()}$`));
    await expect(page.getByRole("dialog")).toBeHidden({ timeout: 15_000 });
  }
  expect(got).toEqual({ JPEG: "jpeg", PNG: "png", WebP: "webp", AVIF: "avif" });

  // Keyboard alone: Alt+E, focus the Format group, arrow to PNG, then Tab to
  // the primary and press Enter.
  const dialog = await open();
  const format = dialog.getByRole("radiogroup", { name: "Format" });
  await format.getByRole("radio", { checked: true }).focus();
  // The dialog reopens on the last pick (AVIF above). Arrow right until PNG
  // is lit: each press moves the pick and the focus together.
  const png = format.getByRole("radio", { name: "PNG", exact: true });
  for (let i = 0; i < 4 && (await png.getAttribute("aria-checked")) !== "true"; i++) await page.keyboard.press("ArrowRight");
  await expect(png).toHaveAttribute("aria-checked", "true");
  await expect(png).toBeFocused();
  const primary = dialog.getByRole("button", { name: "Download PNG", exact: true });
  let reached = false;
  for (let i = 0; i < 40 && !reached; i++) {
    await page.keyboard.press("Tab");
    reached = await primary.evaluate((el) => el === document.activeElement);
  }
  expect(reached, "Tab reaches Download PNG").toBe(true);
  const [dl] = await Promise.all([page.waitForEvent("download"), page.keyboard.press("Enter")]);
  expect(sniff(await bytesOf(dl))).toBe("png");
});

test("Q4 a recipe on Selected writes its size, format and quality; the footer next to the real file", async ({ page }) => {
  await boot(page, [PAPER]);
  const original = readFileSync(PAPER).length;
  await page.keyboard.press("Alt+e");
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Recipe").selectOption("builtin:email-small");
  await page.waitForTimeout(400);
  const footer = (await dialog.getByTestId("export-compressed").textContent())?.trim() ?? "";
  await page.screenshot({ path: join(SHOTS, "q4-recipe-email-small.png") });
  const [dl] = await Promise.all([
    page.waitForEvent("download"),
    dialog.getByRole("button", { name: /^Download (JPEG|PNG|WebP|AVIF)$/ }).click(),
  ]);
  const b = await bytesOf(dl);
  const info = jpegInfo(b);
  const realPct = Math.round((1 - b.length / original) * 100);
  console.log(`Q4 footer="${footer}" file=${dl.suggestedFilename()} ${b.length} B vs original ${original} B → ${realPct}% smaller; ${info.w}x${info.h} q0=${info.q0}`);
  expect(sniff(b)).toBe("jpeg");
  // On Selected the name is the File Name field's; the recipe's pattern is
  // for ZIPs (v9.76 Change Summary). The extension follows the recipe.
  expect(dl.suggestedFilename()).toMatch(/\.jpe?g$/);
  expect([info.w, info.h]).toEqual([1024, 768]);
  expect(info.q0, "libjpeg's q70 luminance table starts at 10").toBe(10);
  // Record, don't assert, the footer: it is the stored photo's figure.
  test.info().annotations.push({ type: "footer-vs-file", description: `footer "${footer}"; file ${realPct}% smaller than the original` });
});

test("Q5 Edit swatches: Cancel changes nothing; × then OK keeps 11 after a reload", async ({ page }) => {
  await boot(page, [PAPER]);
  await openTool(page, "Create", "Shapes");
  const row = page.getByRole("radiogroup", { name: "Fill Color", exact: true });
  const before = await row.getByRole("radio").count();
  expect(before, "transparent + the 12 site colors").toBe(13);

  const plus = page.getByRole("button", { name: "Edit Fill Color swatches" });
  await plus.click();
  let dialog = page.getByRole("dialog", { name: "Edit Fill Color swatches" });
  const removes = dialog.getByRole("button", { name: /^Remove .* from Fill Color swatches$/ });
  await expect(removes).toHaveCount(12);
  await removes.first().click();
  await expect(removes).toHaveCount(11);
  await page.screenshot({ path: join(SHOTS, "q5-edit-swatches.png") });
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(row.getByRole("radio")).toHaveCount(before);

  // Esc drops the draft the same way.
  await plus.click();
  dialog = page.getByRole("dialog", { name: "Edit Fill Color swatches" });
  await removes.first().click();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(row.getByRole("radio")).toHaveCount(before);

  await plus.click();
  dialog = page.getByRole("dialog", { name: "Edit Fill Color swatches" });
  await removes.first().click();
  await dialog.getByRole("button", { name: "OK", exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(row.getByRole("radio")).toHaveCount(before - 1);

  // A reload offers "Welcome back" with the stored photo: Resume editing.
  await page.reload();
  await page.getByRole("button", { name: "Resume editing", exact: true }).click();
  await page.locator("canvas.main-canvas").waitFor({ state: "visible", timeout: 60_000 });
  await page.waitForTimeout(1500);
  await openTool(page, "Create", "Shapes");
  await expect(page.getByRole("radiogroup", { name: "Fill Color", exact: true }).getByRole("radio")).toHaveCount(before - 1);
});

test("Q6 Hold Alt over Fill Color: opacity steps, release → back, one mode ring", async ({ page }) => {
  await boot(page, [PAPER]);
  await openTool(page, "Create", "Shapes");
  const row = page.getByRole("radiogroup", { name: "Fill Color", exact: true });
  await expect(row.getByRole("radio", { name: /^Opacity \d+%$/ })).toHaveCount(0);
  await row.hover();
  await page.keyboard.down("Alt");
  await expect(row.getByRole("radio", { name: /^Opacity \d+%$/ }).first()).toBeVisible();
  const steps = await row.getByRole("radio", { name: /^Opacity \d+%$/ }).count();
  expect(steps).toBeGreaterThanOrEqual(4);
  await expect(page.locator("[data-mode-ring]")).toHaveCount(1);
  await page.screenshot({ path: join(SHOTS, "q6-alt-opacity.png") });
  await page.keyboard.up("Alt");
  await expect(row.getByRole("radio", { name: /^Opacity \d+%$/ })).toHaveCount(0);
  await expect(page.locator("[data-mode-ring]")).toHaveCount(0);
});

test("Q7 Stroke Stabilizer: in the Pen panel; four tiles, four different strokes; a reload", async ({ page }) => {
  await boot(page, [PAPER]);
  await installAnnotationProbe(page);

  await openTool(page, "Create", "Pen");
  const options = page.getByRole("region", { name: "Tool options" });
  const penRow = options.getByRole("radiogroup", { name: /Stabiliz/ });
  await expect(penRow).toBeVisible();
  await expect(penRow.getByRole("radio")).toHaveCount(4);

  await openTool(page, "Create", "Brush");
  const row = options.getByRole("radiogroup", { name: "Stroke Stabilizer" });
  // One jittery left-to-right drag, the same each time.
  const path: [number, number][] = [];
  for (let i = 0; i <= 40; i++) path.push([250 + i * 18, 450 + (i % 2 ? 40 : -40)]);
  const prints: Record<string, string> = {};
  await page.evaluate(async () => {
    (window as unknown as { __qcBase: Uint8ClampedArray }).__qcBase = await window.__annotationTool.get_image_data();
  });
  for (const level of ["Off", "Low", "Med", "High"]) {
    await row.getByRole("radio", { name: level, exact: true }).click();
    await expect(row.getByRole("radio", { name: level, exact: true })).toHaveAttribute("aria-checked", "true");
    const pts = await Promise.all(path.map(([x, y]) => screenPoint(page, x, y)));
    await page.mouse.move(pts[0]!.x, pts[0]!.y);
    await page.mouse.down();
    for (const p of pts.slice(1)) await page.mouse.move(p.x, p.y, { steps: 2 });
    await page.mouse.up();
    await page.waitForTimeout(500);
    // The pixels the stroke changed, against the untouched paper.
    prints[level] = await page.evaluate(async () => {
      const base = (window as unknown as { __qcBase: Uint8ClampedArray }).__qcBase;
      const px: Uint8ClampedArray = await window.__annotationTool.get_image_data();
      let h = 0, n = 0;
      for (let i = 0; i < px.length; i += 4) {
        const d = Math.abs(px[i]! - base[i]!) + Math.abs(px[i + 1]! - base[i + 1]!) + Math.abs(px[i + 2]! - base[i + 2]!);
        if (d > 24) { n++; h = (h * 31 + i) | 0; }
      }
      return `${n}:${h}`;
    });
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.keyboard.press("Control+z");
    await page.waitForTimeout(400);
  }
  console.log("Q7 prints", JSON.stringify(prints));
  expect(new Set(Object.values(prints)).size, "four levels, four strokes").toBe(4);

  await row.getByRole("radio", { name: "High", exact: true }).click();
  await page.screenshot({ path: join(SHOTS, "q7-stabilizer-high.png") });
  // A reload offers "Welcome back" with the stored photo: Resume editing.
  await page.reload();
  await page.getByRole("button", { name: "Resume editing", exact: true }).click();
  await page.locator("canvas.main-canvas").waitFor({ state: "visible", timeout: 60_000 });
  await page.waitForTimeout(1500);
  await openTool(page, "Create", "Brush");
  const after = await options.getByRole("radiogroup", { name: "Stroke Stabilizer" }).getByRole("radio", { checked: true }).getAttribute("aria-label")
    ?? await options.getByRole("radiogroup", { name: "Stroke Stabilizer" }).getByRole("radio", { checked: true }).innerText();
  console.log(`Q7 after reload: ${after}`);
  test.info().annotations.push({ type: "stabilizer-after-reload", description: String(after) });
});

test("Q8 the color dialog's wheel and square are named in US English", async ({ page }) => {
  await boot(page, [PAPER]);
  await openTool(page, "Create", "Shapes");
  await page.getByRole("button", { name: "Edit Fill Color swatches" }).click();
  const dialog = page.getByRole("dialog", { name: "Edit Fill Color swatches" });
  await expect(dialog).toBeVisible();
  const named = await dialog.locator("[aria-label]").evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")!));
  expect(named.filter((n) => /colour/i.test(n))).toEqual([]);
});

test("Q9 Export, the color dialog and the stabilizer row in light and dark", async ({ page }) => {
  await boot(page, [PAPER]);
  for (const theme of ["light", "dark"] as const) {
    await setTheme(page, theme);
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.keyboard.press("Alt+e");
    await expect(page.getByRole("dialog").getByRole("heading", { name: "Export", exact: true })).toBeVisible();
    await page.waitForTimeout(400);
    await page.screenshot({ path: join(SHOTS, `q9-export-${theme}.png`) });
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeHidden();

    await openTool(page, "Create", "Shapes");
    await page.getByRole("button", { name: "Edit Fill Color swatches" }).click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: join(SHOTS, `q9-swatches-${theme}.png`) });
    await page.keyboard.press("Escape");

    await openTool(page, "Create", "Brush");
    const row = page.getByRole("region", { name: "Tool options" }).getByRole("radiogroup", { name: "Stroke Stabilizer" });
    await row.scrollIntoViewIfNeeded();
    await row.getByRole("radio", { checked: true }).focus();
    await page.waitForTimeout(250);
    await page.screenshot({ path: join(SHOTS, `q9-stabilizer-${theme}.png`) });
  }
});
