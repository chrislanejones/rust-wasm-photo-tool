import { test, expect, type Browser, type Page } from "@playwright/test";
import { join } from "node:path";

// ─────────────────────────────────────────────────────────────────────────────
// The 2026-07-14 A/B data loss, pinned as a permanent regression test.
//
// Same build, only localStorage flags differ. Import a photo (default
// `canvasArtboard` ON ⇒ the engine document is photo + 2×10px pad with a
// Canvas fill layer at index 0), then reload and "Resume editing":
//   • flags OFF (shipped defaults): the document round-trips at full size.
//   • flags ON (ih_tiles_flush / ih_oplog_undo / ih_oplog_persist = "1"):
//     the pre-fix write path persisted the EMPTY op log — whose lazily
//     captured base predated `set_artboard_border` — restore validated it,
//     reported success, and short-circuited the working-copy archive. The
//     220×170 repro came back 200×150 with the Canvas silently destroyed.
//
// Flags are set via localStorage "1" overrides ONLY — no default is flipped.
// Second spec pins the case human dogfooding dodged: a plain PAINT stroke
// (not an AI result, which rides a keyframe) on a default two-layer import
// must survive a reload together with the Canvas.
// ─────────────────────────────────────────────────────────────────────────────

const FIXTURE_PNG = join(__dirname, "fixtures", "checker.png"); // 256×256
const FLAGS = ["ih_tiles_flush", "ih_oplog_undo", "ih_oplog_persist"];

/** Push the verification switches before every document in this context.
 *  "1" overrides only — code defaults stay OFF, exactly as shipped. */
async function setFlags(page: Page, on: boolean): Promise<void> {
  await page.addInitScript(
    (args: { flags: string[]; on: boolean }) => {
      for (const f of args.flags) {
        if (args.on) window.localStorage.setItem(f, "1");
        else window.localStorage.removeItem(f);
      }
    },
    { flags: FLAGS, on },
  );
}

/** Keep the run offline + deterministic: abort every request that leaves
 *  localhost (Convex sync, Clerk JS). The editor pipeline under test —
 *  file → WASM engine → canvas → IndexedDB → resume — is entirely local. */
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

/** Drive the app's real Browse-Files pipeline. */
async function importFixture(page: Page): Promise<void> {
  const fileInput = page.locator('input[type="file"]');
  await fileInput.waitFor({ state: "attached" });
  await fileInput.setInputFiles(FIXTURE_PNG);
  await waitForCanvas(page);
}

/** Wait until the engine has blitted a real document to the main canvas. */
async function waitForCanvas(page: Page): Promise<void> {
  const canvas = page.locator("canvas.main-canvas");
  await canvas.waitFor({ state: "visible", timeout: 30_000 });
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const c = document.querySelector<HTMLCanvasElement>("canvas.main-canvas");
          return c ? c.width : 0;
        }),
      { timeout: 30_000 },
    )
    .toBeGreaterThan(0);
}

/** The document as the user sees it: engine-owned canvas dims + pixels. */
async function canvasState(page: Page): Promise<{ w: number; h: number; png: string }> {
  // Give in-flight blits/persistence a beat to settle before reading.
  await page.waitForTimeout(500);
  return page.evaluate(() => {
    const c = document.querySelector<HTMLCanvasElement>("canvas.main-canvas");
    if (!c) return { w: 0, h: 0, png: "" };
    return { w: c.width, h: c.height, png: c.toDataURL("image/png") };
  });
}

/** Reload the page and resume the saved session. */
async function reloadAndResume(page: Page): Promise<void> {
  await page.reload();
  await page.getByRole("button", { name: /Resume editing/i }).click({ timeout: 30_000 });
  await waitForCanvas(page);
  // Restore paths finish async (working-copy decode or op-log replay).
  await page.waitForTimeout(1500);
}

/** One full session: fresh browser context (fresh IndexedDB), import,
 *  optional edit, settle past the 2s op-log debounce, reload, resume. */
async function runScenario(
  browser: Browser,
  flagsOn: boolean,
  edit?: (page: Page) => Promise<void>,
): Promise<{
  imported: { w: number; h: number; png: string };
  edited: { w: number; h: number; png: string } | null;
  restored: { w: number; h: number; png: string };
}> {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  try {
    await blockExternalNetwork(page);
    await setFlags(page, flagsOn);
    await page.goto("/");
    await importFixture(page);
    const imported = await canvasState(page);

    let edited: { w: number; h: number; png: string } | null = null;
    if (edit) {
      await edit(page);
      edited = await canvasState(page);
    }

    // Let persistence land: working-copy autosave + (flags on) the op-log
    // write path's 2s debounce.
    await page.waitForTimeout(3500);

    await reloadAndResume(page);
    const restored = await canvasState(page);
    return { imported, edited, restored };
  } finally {
    await ctx.close();
  }
}

/** Select the Paint tool and drag one diagonal stroke across the canvas. */
async function paintStroke(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Paint", exact: true }).first().click();
  const canvas = page.locator("canvas.main-canvas");
  const box = await canvas.boundingBox();
  expect(box, "canvas has a bounding box").not.toBeNull();
  const px = (fx: number) => box!.x + box!.width * fx;
  const py = (fy: number) => box!.y + box!.height * fy;
  await page.mouse.move(px(0.3), py(0.3));
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) {
    await page.mouse.move(px(0.3 + 0.05 * i), py(0.3 + 0.04 * i), { steps: 3 });
  }
  await page.mouse.up();
  // paint_up commits the stroke + flushes; give the recorder a beat.
  await page.waitForTimeout(500);
}

test.describe("op-log persistence — canvas survives resume (2026-07-14 A/B)", () => {
  test("1 · edit-free default import: flags ON restores EXACTLY what flags OFF restores (dims + pixels)", async ({
    browser,
  }) => {
    const off = await runScenario(browser, false);
    const on = await runScenario(browser, true);

    // Sanity on the reference leg: the artboard document (256×256 photo +
    // 2×10px pad = 276×276) round-trips under shipped defaults.
    expect(off.restored.w, "flags OFF: width round-trips").toBe(off.imported.w);
    expect(off.restored.h, "flags OFF: height round-trips").toBe(off.imported.h);
    expect(off.imported.w, "default artboard grew the document").toBeGreaterThan(256);

    // THE A/B: flags must not change what the user gets back. Pre-fix this
    // came back at photo size (Canvas destroyed): 276 → 256.
    expect(on.restored.w, "flags ON: same width as flags OFF").toBe(off.restored.w);
    expect(on.restored.h, "flags ON: same height as flags OFF").toBe(off.restored.h);
    expect(on.restored.png, "flags ON: pixel-identical to flags OFF").toBe(off.restored.png);
  });

  test("2 · a plain PAINT stroke on the default two-layer import survives reload WITH the Canvas (flags ON)", async ({
    browser,
  }) => {
    // The dogfooded path (AI result) rides a keyframe and passed by accident;
    // a paint stroke rides the OP LOG and is the case that was never covered.
    const on = await runScenario(browser, true, paintStroke);

    expect(on.edited, "the edit ran").not.toBeNull();
    expect(on.edited!.png, "the stroke changed pixels").not.toBe(on.imported.png);
    expect(on.edited!.w, "painting never resizes the document").toBe(on.imported.w);

    // Both the stroke AND the Canvas (dims = photo + pad) must come back.
    expect(on.restored.w, "canvas dimensions survive").toBe(on.edited!.w);
    expect(on.restored.h, "canvas dimensions survive").toBe(on.edited!.h);
    expect(on.restored.png, "stroke + Canvas pixel-identical after resume").toBe(
      on.edited!.png,
    );
  });
});
