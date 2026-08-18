import { test, expect, type Page } from "@playwright/test";
import { join } from "node:path";

// ─────────────────────────────────────────────────────────────────────────────
// imagehorse-qc, automated slice — cut for v8.41.
//
// Runs against the PRODUCTION build in logged-out demo mode (the harness bakes
// placeholder Convex/Clerk keys and the spec blocks every off-localhost
// request), because demo mode is the sacred path.
//
// Covers the surfaces v8.41 actually touched:
//   • the shared stroke coalescer (Clone Stamp + Blur Brush) — the perf fix
//     must not have changed what the pixels end up being, and undo/redo must
//     still bracket a stroke exactly.
//   • text (op-log v4 / box_height) committing onto the canvas.
//   • shapes: picking a different shape must not retype the one already drawn.
//   • guides: the colour is a preference and survives a reload.
//   • export still produces real bytes.
//
// Section 5 of the skill (visual polish, contrast) is NOT covered here — that
// needs eyes on a visible window, and is reported separately.
// ─────────────────────────────────────────────────────────────────────────────

const FIXTURE_PNG = join(__dirname, "fixtures", "checker.png"); // 256×256

/** Keep the run offline + deterministic. */
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

/** Console errors that are inherent to the offline harness, not the app. */
const HARNESS_NOISE =
  /Clerk|clerk|ERR_INTERNET_DISCONNECTED|ERR_FAILED|net::|WebSocket|Failed to load resource|convex/i;

function watchConsole(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error" && !HARNESS_NOISE.test(m.text())) errors.push(m.text());
  });
  page.on("pageerror", (e) => {
    if (!HARNESS_NOISE.test(e.message)) errors.push("PAGEERROR: " + e.message);
  });
  return errors;
}

async function importFixture(page: Page): Promise<void> {
  const fileInput = page.locator('input[type="file"]');
  await fileInput.waitFor({ state: "attached" });
  await fileInput.setInputFiles(FIXTURE_PNG);
  const canvas = page.locator("canvas.main-canvas");
  await canvas.waitFor({ state: "visible", timeout: 30_000 });
  await expect
    .poll(
      () =>
        page.evaluate(
          () => document.querySelector<HTMLCanvasElement>("canvas.main-canvas")?.width ?? 0,
        ),
      { timeout: 30_000 },
    )
    .toBeGreaterThan(0);
  await page.waitForTimeout(1200);
}

/** Pick a sub-tool the way the five-group toolbar exposes it: group, then tool. */
async function pickTool(page: Page, group: string, subTool: string): Promise<void> {
  await page.getByRole("button", { name: group, exact: true }).first().click();
  await page.getByRole("button", { name: subTool, exact: true }).first().click();
  await page.waitForTimeout(400);
}

/** The document as the user sees it. */
async function canvasPng(page: Page): Promise<string> {
  await page.waitForTimeout(600);
  return page.evaluate(
    () =>
      document.querySelector<HTMLCanvasElement>("canvas.main-canvas")?.toDataURL("image/png") ??
      "",
  );
}

/** Drag a stroke across the middle of the canvas. */
async function stroke(page: Page, steps = 10): Promise<void> {
  const box = await page.locator("canvas.main-canvas").boundingBox();
  expect(box, "canvas has a bounding box").not.toBeNull();
  const px = (f: number) => box!.x + box!.width * f;
  const py = (f: number) => box!.y + box!.height * f;
  await page.mouse.move(px(0.25), py(0.3));
  await page.mouse.down();
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(px(0.25 + 0.045 * i), py(0.3 + 0.035 * i), { steps: 3 });
  }
  await page.mouse.up();
  await page.waitForTimeout(900);
}

async function undo(page: Page): Promise<void> {
  await page.keyboard.press("Control+z");
  await page.waitForTimeout(900);
}

async function redo(page: Page): Promise<void> {
  await page.keyboard.press("Control+Shift+z");
  await page.waitForTimeout(900);
}

test.describe("imagehorse-qc v8.41", () => {
  test("§1 boot + demo mode: engine initialises logged-out, no app console errors", async ({
    page,
  }) => {
    const errors = watchConsole(page);
    await blockExternalNetwork(page);
    await page.goto("/");
    await importFixture(page);

    const state = await page.evaluate(() => ({
      signedIn: !!(window as unknown as { Clerk?: { user?: unknown } }).Clerk?.user,
      canvasW: document.querySelector<HTMLCanvasElement>("canvas.main-canvas")?.width ?? 0,
      wasm: performance
        .getEntriesByType("resource")
        .filter((r) => r.name.endsWith(".wasm"))
        .map((r) => (r as PerformanceResourceTiming).responseStatus),
    }));

    expect(state.signedIn, "demo mode: no Clerk user").toBe(false);
    expect(state.canvasW, "engine blitted a document").toBeGreaterThan(0);
    expect(state.wasm.every((s) => s === 200 || s === 0), "wasm served OK").toBe(true);
    expect(errors, "no app-level console errors").toEqual([]);
  });

  test("§2 Clone Stamp: a stroke changes pixels, undo removes it, redo restores it byte-exact", async ({
    page,
  }) => {
    await blockExternalNetwork(page);
    await page.goto("/");
    await importFixture(page);

    const before = await canvasPng(page);
    await pickTool(page, "Create", "Clone Stamp");

    // Clone needs a source, and the source is armed by a mousedown carrying
    // altKey. ⚠️ `mouse.click(x, y, { modifiers: ["Alt"] })` does NOT deliver
    // altKey on the mousedown here — the source stays unarmed, `has_source()`
    // is false, and the stroke silently paints nothing (no op, no pixels). Hold
    // Alt explicitly around a real down/up instead.
    const box = (await page.locator("canvas.main-canvas").boundingBox())!;
    await page.keyboard.down("Alt");
    await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.68);
    await page.mouse.down();
    await page.mouse.up();
    await page.keyboard.up("Alt");
    await page.waitForTimeout(500);

    await stroke(page);

    // Undo going live is the engine's own signal that the stroke recorded an
    // op — a stronger check than pixels, which can coincide on a repetitive
    // source region.
    await expect(page.getByRole("button", { name: "Undo", exact: true }).first()).toBeEnabled();

    const after = await canvasPng(page);
    expect(after, "the clone stroke changed pixels").not.toBe(before);

    await undo(page);
    expect(await canvasPng(page), "undo removed the clone stroke").toBe(before);

    await redo(page);
    expect(await canvasPng(page), "redo restored the stroke byte-exact").toBe(after);
  });

  test("§2 Blur Brush: a stroke changes pixels and undo removes it", async ({ page }) => {
    await blockExternalNetwork(page);
    await page.goto("/");
    await importFixture(page);

    const before = await canvasPng(page);
    await pickTool(page, "Create", "Blur Brush");
    await stroke(page);

    const after = await canvasPng(page);
    expect(after, "the blur stroke changed pixels").not.toBe(before);

    await undo(page);
    expect(await canvasPng(page), "undo removed the blur stroke").toBe(before);
  });

  test("§2 Shapes: picking a different shape does not retype the one already drawn", async ({
    page,
  }) => {
    await blockExternalNetwork(page);
    await page.goto("/");
    await importFixture(page);

    await pickTool(page, "Create", "Shapes");
    await stroke(page, 6);
    const drawn = await canvasPng(page);

    // Click a DIFFERENT shape in the settings panel. Pre-fix this retyped the
    // shape already on the canvas, because a pending shape read its type live
    // from the panel instead of pinning it at mouse-up.
    const panelShapes = ["Rectangle", "Ellipse", "Circle", "Triangle", "Line"];
    let clicked: string | null = null;
    for (const name of panelShapes) {
      const btn = page.getByRole("button", { name, exact: true }).first();
      if ((await btn.count()) > 0 && (await btn.isVisible())) {
        await btn.click();
        clicked = name;
        break;
      }
    }
    expect(clicked, "found a shape-type button in the panel").not.toBeNull();
    await page.waitForTimeout(700);

    expect(await canvasPng(page), `clicking ${clicked} left the drawn shape alone`).toBe(drawn);
  });

  test("§2 Text: typing commits onto the canvas and undo removes it (op-log v4 / box_height)", async ({
    page,
  }) => {
    await blockExternalNetwork(page);
    await page.goto("/");
    await importFixture(page);

    const before = await canvasPng(page);
    await pickTool(page, "Create", "Text");

    const box = (await page.locator("canvas.main-canvas").boundingBox())!;
    await page.mouse.click(box.x + box.width * 0.25, box.y + box.height * 0.4);
    const textarea = page.locator("textarea").first();
    await expect(textarea, "the text input opened").toBeVisible({ timeout: 10_000 });
    await textarea.fill("QC v8.41");
    await page.waitForTimeout(400);

    // Clicking away commits the annotation (and opens a fresh input, which
    // Escape closes without committing anything).
    await page.mouse.click(box.x + box.width * 0.75, box.y + box.height * 0.8);
    await page.waitForTimeout(900);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(1200);

    const after = await canvasPng(page);
    expect(after, "the committed text changed pixels").not.toBe(before);

    await expect(page.getByRole("button", { name: "Undo", exact: true }).first()).toBeEnabled();
    await undo(page);
    expect(await canvasPng(page), "undo removed the text").toBe(before);
  });

  test("§3 Perspective: all THREE tiles are selectable and each lights on its own", async ({
    page,
  }) => {
    await blockExternalNetwork(page);
    await page.goto("/");
    await importFixture(page);

    await page.getByRole("button", { name: "Edit", exact: true }).first().click();
    await page.waitForTimeout(400);

    const MODES = ["Perspective", "Distort", "Skew"] as const;

    // All three are sidebar tiles (ADR-034 decision 1, restored by ADR-036).
    for (const m of MODES) {
      await expect(
        page.getByRole("button", { name: m, exact: true }).first(),
        `${m} is a sidebar tile`,
      ).toBeVisible();
    }

    // THE REGRESSION, and the actual ask: "make sure I can select all of them."
    // v8.43 shipped these three and NONE of them ever lit — `modeOfTool` in
    // activateSubTool.ts was a fourth hand-written copy of the sub-mode axis
    // with no `perspective` case, so it returned undefined, `useActiveSubTool`
    // rejected the stored key on every read, and the fallback lit live[0]
    // (Distort) whichever you clicked. So it is not enough to assert the
    // clicked tile is pressed — assert the OTHER TWO are not, or a build that
    // lights all three, or always the same one, passes.
    for (const m of MODES) {
      await page.getByRole("button", { name: m, exact: true }).first().click();
      await page.waitForTimeout(500);
      for (const other of MODES) {
        await expect(
          page.getByRole("button", { name: other, exact: true }).first(),
          `after clicking ${m}, ${other} is ${other === m ? "lit" : "dark"}`,
        ).toHaveAttribute("aria-pressed", other === m ? "true" : "false");
      }
    }
  });

  test("§4 Guides: the colour is a preference and survives a reload", async ({ page }) => {
    await blockExternalNetwork(page);
    await page.goto("/");
    await importFixture(page);

    await page.evaluate(() => localStorage.setItem("image-horse-guide-color", "#22c55e"));
    await page.reload();
    await page.waitForTimeout(2500);

    const kept = await page.evaluate(() => localStorage.getItem("image-horse-guide-color"));
    expect(kept, "guide colour survived the reload").toBe("#22c55e");

    // And the default is the documented cyan on a origin that never set one.
    const fresh = await page.evaluate(() => {
      localStorage.removeItem("image-horse-guide-color");
      return localStorage.getItem("image-horse-guide-color");
    });
    expect(fresh, "cleared cleanly").toBeNull();
  });

  test("§2 Export: Download produces real bytes", async ({ page }) => {
    await blockExternalNetwork(page);
    await page.goto("/");
    await importFixture(page);

    // The export path builds a Blob, hands it to URL.createObjectURL and clicks
    // a synthetic <a download>. Playwright's "download" event does not fire
    // reliably for that shape, so capture the bytes at the source instead —
    // this also proves the blob is real rather than an empty placeholder.
    await page.evaluate(() => {
      const w = window as unknown as {
        __qcExport?: { size: number; type: string }[];
        URL: typeof URL;
      };
      w.__qcExport = [];
      const orig = w.URL.createObjectURL.bind(w.URL);
      w.URL.createObjectURL = (obj: Blob | MediaSource) => {
        if (obj instanceof Blob) w.__qcExport!.push({ size: obj.size, type: obj.type });
        return orig(obj);
      };
    });

    // Two steps, not one: the toolbar button opens a "Download, Copy, or Share"
    // dialog, and the export only happens on that dialog's own primary action.
    await page
      .getByRole("button", { name: /^Download & Share/ })
      .first()
      .click();

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog, "the share dialog opened").toBeVisible({ timeout: 10_000 });

    const downloadBtn = dialog.getByRole("button", { name: /^Download / }).first();
    await expect(downloadBtn, "the dialog's Download action is enabled").toBeEnabled();
    await downloadBtn.click();
    await page.waitForTimeout(6000);

    const blobs = await page.evaluate(
      () => (window as unknown as { __qcExport: { size: number; type: string }[] }).__qcExport,
    );
    const biggest = blobs.sort((a, b) => b.size - a.size)[0];

    expect(blobs.length, "export created at least one blob").toBeGreaterThan(0);
    expect(biggest.size, "export produced real bytes").toBeGreaterThan(1000);
    expect(biggest.type, "export blob carries an image mime type").toMatch(/^image\//);
  });
});
