import { test, expect } from "../guard/test";
import type { Page } from "@playwright/test";
import { join } from "node:path";

// ─────────────────────────────────────────────────────────────────────────────
// imagehorse-qc, automated slice — 10-14-2026, against master 639202bf.
//
// Runs against the PRODUCTION build in logged-out demo mode (placeholder
// Convex/Clerk keys, every off-localhost request blocked). Kept in archive/ as
// the record of the run; it is not part of the suite. Results and evidence are
// in docs/qc/qc-1014.md, screenshots in docs/qc/qc-1014/.
//
// It covers what the existing specs do NOT already pin for #351/#356, #348,
// #354 and #355:
//   • a 7-point star (the existing spec draws an 8-point star from a preset;
//     7 is not a preset, so it is set with the keyboard on the Points slider),
//   • a rectangle turned by its canvas handle AND sloppy (three ops under one
//     snapshot), and a turn of an already-committed shape as its own gesture,
//   • reload, Resume, then undo through four multi-op gestures — after a
//     restore the snapshot stack is gone, so only the log's markers carry them,
//   • Diagnostics › Resources › "Why" reading "recording" in the UI itself,
//   • drag-drop import with the Night 19 preview box, Diagnostics EXIF,
//     the master bar fallback, the Night 20 radio groups and F2 rename.
//
// Run (reuses a preview already serving the build on PW_PORT). archive/ is in
// the main config's testIgnore, so point a throwaway config at it, placed at
// the repo root so the relative globalSetup path still resolves:
//   // playwright.qc.config.ts
//   import base from "./playwright.config";
//   export default { ...base, testDir: "./e2e/archive", testIgnore: [], testMatch: /qc-1014\.spec\.ts$/ };
//   PW_PORT=<port> pnpm exec playwright test --config playwright.qc.config.ts
// QC_MUTATE=first-undo-noop swallows the first Ctrl+Z after Resume in A4;
// A4 must then fail (it did, 10-14: "D duplicate — Expected 3, Received 4").
// ─────────────────────────────────────────────────────────────────────────────

const FIX = (n: string) => join(__dirname, "..", "fixtures", n);
const CHECKER = FIX("checker.png"); // 256×256 → 276×276 canvas
const SKY = FIX("sky-building.png");
const SHOTS = join(__dirname, "..", "..", "docs", "qc", "qc-1014");

interface Probe {
  broken: boolean;
  status: string;
  cursor: number;
  ops: number;
  shapes: number;
  undo: number;
  redo: number;
  hash: string;
}

interface ShapeJson {
  kind: number;
  rotation?: number;
  rotation_deg?: number;
  starPoints?: number;
  star_points?: number;
  sloppiness?: number;
  [k: string]: unknown;
}

function watchConsole(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const t = m.text();
    // The placeholder backend is unreachable by design; those are not the app's.
    if (/smoke-placeholder|clerk\.smoke\.invalid|failed_to_load_clerk_js|net::ERR_FAILED|Failed to load resource/.test(t)) return;
    errors.push(t);
  });
  page.on("pageerror", (e) => {
    if (/smoke-placeholder|clerk\.smoke\.invalid/.test(e.message)) return;
    errors.push(`pageerror: ${e.message}`);
  });
  return errors;
}

async function blockExternalNetwork(page: Page): Promise<void> {
  await page.route("**/*", (route) => {
    const url = route.request().url();
    if (/^https?:\/\/(localhost|127\.0\.0\.1)[:/]/.test(url) || url.startsWith("blob:") || url.startsWith("data:")) {
      return route.continue();
    }
    return route.abort();
  });
}

async function waitForCanvas(page: Page, size = "276x276"): Promise<void> {
  await page.locator("canvas.main-canvas").waitFor({ state: "visible", timeout: 30_000 });
  await expect
    .poll(() => page.locator("canvas.main-canvas").evaluate((c: HTMLCanvasElement) => `${c.width}x${c.height}`), {
      timeout: 30_000,
    })
    .toBe(size);
}

async function importFiles(page: Page, files: string[]): Promise<void> {
  const input = page.locator('input[type="file"]').first();
  await input.waitFor({ state: "attached" });
  await input.setInputFiles(files);
  await waitForCanvas(page);
}

async function exposeEngine(page: Page): Promise<void> {
  const found = () =>
    page.evaluate(() => {
      const root = document.querySelector("#root") as unknown as Record<string, unknown>;
      const key = Object.keys(root).find((k) => k.startsWith("__reactContainer"))!;
      type Fiber = { child?: Fiber; sibling?: Fiber; memoizedState?: unknown };
      const isTool = (v: unknown) =>
        !!v && typeof (v as { add_layer_mask_from?: unknown }).add_layer_mask_from === "function";
      let tool: unknown = null;
      const stack: Fiber[] = [root[key] as Fiber];
      while (stack.length && !tool) {
        const f = stack.pop()!;
        let s = f.memoizedState as { memoizedState?: unknown; next?: unknown } | null;
        while (s && !tool) {
          const v = s.memoizedState as { current?: unknown } | undefined;
          if (isTool(v)) tool = v;
          else if (v && isTool(v.current)) tool = v.current;
          s = s.next as typeof s;
        }
        if (f.sibling) stack.push(f.sibling);
        if (f.child) stack.push(f.child);
      }
      (window as unknown as { __ihTool: unknown }).__ihTool = tool;
      return !!tool;
    });
  await expect.poll(found, { message: "engine handle reachable", timeout: 30_000 }).toBe(true);
}

async function probe(page: Page): Promise<Probe> {
  return page.evaluate(async () => {
    type T = {
      oplog_is_broken: () => Promise<boolean>;
      oplog_status: () => Promise<string>;
      oplog_cursor: () => Promise<number>;
      oplog_op_count: () => Promise<number>;
      get_shape_annotations: () => Promise<string>;
      undo_count: () => Promise<number>;
      redo_count: () => Promise<number>;
      composite_hash_hex: () => Promise<string>;
    };
    const t = (window as unknown as { __ihTool: T }).__ihTool;
    return {
      broken: await t.oplog_is_broken(),
      status: await t.oplog_status(),
      cursor: await t.oplog_cursor(),
      ops: await t.oplog_op_count(),
      shapes: (JSON.parse(await t.get_shape_annotations()) as unknown[]).length,
      undo: await t.undo_count(),
      redo: await t.redo_count(),
      hash: await t.composite_hash_hex(),
    };
  });
}

async function shapes(page: Page): Promise<ShapeJson[]> {
  return page.evaluate(async () => {
    const t = (window as unknown as { __ihTool: { get_shape_annotations(): Promise<string> } }).__ihTool;
    return JSON.parse(await t.get_shape_annotations()) as ShapeJson[];
  });
}

const rot = (s: ShapeJson) => s.rotation ?? s.rotation_deg ?? 0;
const pts = (s: ShapeJson) => s.starPoints ?? s.star_points;

async function settled(page: Page, undo: number): Promise<Probe> {
  await expect.poll(async () => (await probe(page)).undo, { timeout: 15_000 }).toBe(undo);
  return probe(page);
}

async function key(page: Page, combo: string): Promise<void> {
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press(combo);
}

async function openShapes(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Create", exact: true }).first().click();
  await page.getByRole("button", { name: "Shapes", exact: true }).first().click();
}

async function pickShape(page: Page, name: string | RegExp): Promise<void> {
  await page.getByRole("radiogroup", { name: "Shape" }).getByRole("radio", { name }).click();
}

async function preset(page: Page, name: string): Promise<void> {
  await page.getByRole("radio", { name, exact: true }).or(page.getByRole("button", { name, exact: true })).first().click();
}

/** Points = 7 with the keyboard: it is not one of the presets (3/5/8/12).
 *  ArrowRight is tried first and its result recorded; PageUp then gets there. */
async function setStarPointsByKeyboard(page: Page, target: number): Promise<string> {
  const slider = page.getByRole("slider", { name: "Points", exact: true });
  await slider.focus();
  const start = (await slider.getAttribute("aria-valuetext")) ?? "";
  for (let i = 0; i < 5; i++) await page.keyboard.press("ArrowRight");
  const afterArrows = (await slider.getAttribute("aria-valuetext")) ?? "";
  console.log(`[qc] Points slider: start "${start}", after 5x ArrowRight "${afterArrows}"`);
  for (let i = 0; i < 12; i++) {
    const vt = (await slider.getAttribute("aria-valuetext")) ?? "";
    if (new RegExp(`^${target}\\b`).test(vt)) {
      console.log(`[qc] Points slider reached "${vt}" after ${i} PageUp`);
      return vt;
    }
    await page.keyboard.press("PageUp");
  }
  throw new Error("Points slider never reached " + target);
}

async function canvasToScreen(page: Page, cx: number, cy: number) {
  return page.evaluate(
    ([px, py]) => {
      const c = document.querySelector<HTMLCanvasElement>("canvas.main-canvas")!;
      const r = c.getBoundingClientRect();
      return { x: r.left + (px / c.width) * r.width, y: r.top + (py / c.height) * r.height };
    },
    [cx, cy] as const,
  );
}

async function dragScreen(page: Page, a: { x: number; y: number }, b: { x: number; y: number }) {
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 5 });
  await page.mouse.move(b.x, b.y, { steps: 5 });
  await page.mouse.up();
}

async function dragCanvas(page: Page, from: [number, number], to: [number, number]) {
  await dragScreen(page, await canvasToScreen(page, ...from), await canvasToScreen(page, ...to));
}

async function apply(page: Page): Promise<void> {
  await page.getByTestId("shape-action-bar").getByRole("button", { name: "Apply (Enter)" }).click();
  await expect(page.getByTestId("shape-action-bar")).toHaveCount(0);
}

/** Turn the pending/selected shape by its canvas rotate handle. */
async function turnByHandle(page: Page): Promise<void> {
  const handle = page.locator("[data-shape-rotate-handle]").first();
  await expect(handle).toBeVisible({ timeout: 10_000 });
  const hb = (await handle.boundingBox())!;
  const from = { x: hb.x + hb.width / 2, y: hb.y + hb.height / 2 };
  await dragScreen(page, from, { x: from.x + 90, y: from.y + 60 });
}

async function oneUndoOneGesture(page: Page, before: Probe, what: string): Promise<{ after: Probe; undone: Probe }> {
  const after = await probe(page);
  expect(after.broken, `${what}: log healthy before undo`).toBe(false);
  await key(page, "Control+z");
  const undone = await settled(page, before.undo);
  console.log(`[qc] ${what}: before ${JSON.stringify(before)}\n      after  ${JSON.stringify(after)}\n      undone ${JSON.stringify(undone)}`);
  expect(undone.shapes, `${what}: one Ctrl+Z`).toBe(before.shapes);
  expect(undone.hash, `${what}: composite back`).toBe(before.hash);
  expect(undone.broken).toBe(false);
  expect(undone.status).toBe("recording");
  await key(page, "Control+Shift+z");
  const redone = await settled(page, after.undo);
  expect(redone.hash, `${what}: redo byte-exact`).toBe(after.hash);
  expect(redone.broken).toBe(false);
  return { after, undone };
}

async function setup(page: Page, files = [CHECKER]): Promise<string[]> {
  const errors = watchConsole(page);
  await blockExternalNetwork(page);
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto("/");
  await importFiles(page, files);
  await exposeEngine(page);
  return errors;
}

async function diagnosticsWhy(page: Page, shot: string): Promise<{ why: string; oplog: string }> {
  await key(page, "Alt+Delete");
  const dialog = page.getByRole("dialog", { name: "Diagnostics Window" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("tab", { name: "Resources" }).or(dialog.getByRole("button", { name: /^Resources/ })).first().click();
  // The row whose label is exactly `label`: climb until the text holds more
  // than the label (the value sits in a sibling).
  const gauge = (label: string) =>
    page.evaluate((l) => {
      const dlg = document.querySelector('[role="dialog"]')!;
      const el = [...dlg.querySelectorAll("*")].find((n) => n.children.length === 0 && n.textContent?.trim() === l);
      let row: Element | null = el ?? null;
      while (row && (row.textContent ?? "").trim() === l) row = row.parentElement;
      return (row?.textContent ?? "").trim();
    }, label);
  await expect(dialog.getByText("Why", { exact: true }).first()).toBeVisible({ timeout: 10_000 });
  const why = await gauge("Why");
  const oplog = await gauge("Op Log");
  await dialog.screenshot({ path: join(SHOTS, shot) });
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  return { why, oplog };
}

// ── Op-log undo (#351, #356) ────────────────────────────────────────────────

test("A1 a 7-point star (Points set by keyboard): one Ctrl+Z, Ctrl+Shift+Z back; Ctrl+Y probed", async ({ page }) => {
  const errors = await setup(page);
  await openShapes(page);
  await pickShape(page, /Star/);
  const vt = await setStarPointsByKeyboard(page, 7);
  console.log(`[qc] Points slider valuetext: ${vt}`);
  const before = await probe(page);
  await dragCanvas(page, [40, 40], [220, 220]);
  await apply(page);
  await settled(page, before.undo + 1);
  const s = await shapes(page);
  console.log(`[qc] star json: ${JSON.stringify(s)}`);
  expect(pts(s[0]), "the star has 7 points").toBe(7);
  await page.locator("canvas.main-canvas").screenshot({ path: join(SHOTS, "a1-seven-point-star.png") });
  const { after } = await oneUndoOneGesture(page, before, "7-point star");

  // Ctrl+Y: the app documents Ctrl+Shift+Z as redo (shortcutGroups.ts). Probe
  // what Ctrl+Y does after an undo so the report states it, not assumes it.
  await key(page, "Control+z");
  await settled(page, before.undo);
  await key(page, "Control+y");
  await page.waitForTimeout(1500);
  const y = await probe(page);
  console.log(`[qc] after Ctrl+Y: undo=${y.undo} redo=${y.redo} shapes=${y.shapes} (redo would make undo=${after.undo})`);
  expect(errors).toEqual([]);
});

test("A2 a sloppy rectangle turned by its handle before Apply: one Ctrl+Z removes it whole", async ({ page }) => {
  const errors = await setup(page);
  await openShapes(page);
  await pickShape(page, "Rectangle");
  await preset(page, "Sloppiness 50%");
  const before = await probe(page);
  await dragCanvas(page, [60, 70], [200, 190]);
  await turnByHandle(page);
  await apply(page);
  await settled(page, before.undo + 1);
  const s = await shapes(page);
  console.log(`[qc] turned sloppy rect json: ${JSON.stringify(s)}`);
  expect(Math.abs(rot(s[0])), "really turned").toBeGreaterThan(5);
  expect(s[0].sloppiness ?? 0, "really sloppy").toBeGreaterThan(0);
  const after = await probe(page);
  console.log(`[qc] ops for this one gesture: ${after.ops - before.ops}`);
  await page.locator("canvas.main-canvas").screenshot({ path: join(SHOTS, "a2-turned-sloppy-rect.png") });
  await oneUndoOneGesture(page, before, "turned sloppy rectangle");
  expect(errors).toEqual([]);
});

test("A3 turning an already-committed rectangle is its own gesture: one Ctrl+Z un-turns it only", async ({ page }) => {
  const errors = await setup(page);
  await openShapes(page);
  await pickShape(page, "Rectangle");
  await preset(page, "Corner Radius 24px");
  await dragCanvas(page, [30, 60], [100, 140]);
  await apply(page);
  const drawn = await settled(page, 1);
  // Reselect by its top edge, turn it, Apply.
  const p = await canvasToScreen(page, 65, 60);
  await page.mouse.click(p.x, p.y);
  await expect(page.getByTestId("shape-action-bar")).toBeVisible();
  await turnByHandle(page);
  await apply(page);
  await settled(page, 2);
  expect(Math.abs(rot((await shapes(page))[0])), "turned").toBeGreaterThan(5);
  const { undone } = await oneUndoOneGesture(page, drawn, "turn of a committed rect");
  expect(undone.shapes, "the rect itself stays").toBe(1);
  expect(rot((await shapes(page))[0]) === 0 || undone.hash === drawn.hash).toBe(true);
  expect(errors).toEqual([]);
});

test("A4 four multi-op gestures, reload, Resume, then undo: one Ctrl+Z each, in order; Diagnostics reads recording", async ({ page }) => {
  test.setTimeout(240_000);
  const errors = await setup(page);
  const h0 = await probe(page);
  await openShapes(page);

  // A: rounded rectangle (ShapeAdd + CornerRadii)
  await pickShape(page, "Rectangle");
  await preset(page, "Corner Radius 24px");
  await dragCanvas(page, [30, 60], [100, 140]);
  await apply(page);
  const a = await settled(page, h0.undo + 1);

  // B: 7-point star (ShapeAdd + StarPoints)
  await pickShape(page, /Star/);
  await setStarPointsByKeyboard(page, 7);
  await dragCanvas(page, [150, 20], [250, 120]);
  await apply(page);
  const b = await settled(page, h0.undo + 2);

  // C: sloppy rectangle turned by its handle (ShapeAdd + Sloppiness + Rotation)
  await pickShape(page, "Rectangle");
  await preset(page, "Corner Radius 0px");
  await preset(page, "Sloppiness 50%");
  await dragCanvas(page, [150, 170], [240, 250]);
  await turnByHandle(page);
  await apply(page);
  const c = await settled(page, h0.undo + 3);

  // D: duplicate of A through the action bar's east port
  const p = await canvasToScreen(page, 65, 60);
  await page.mouse.click(p.x, p.y);
  const bar = page.getByTestId("shape-action-bar");
  await expect(bar).toBeVisible();
  await bar.getByRole("button", { name: /^Duplicate —/ }).click();
  await page.locator('[data-shape-port="e"]').click();
  await expect.poll(async () => (await probe(page)).shapes).toBe(4);
  await bar.getByRole("button", { name: "Stop duplicating" }).click();
  await apply(page);
  const d = await settled(page, h0.undo + 4);
  console.log(`[qc] pre-reload: h0 ${JSON.stringify(h0)}\n a ${JSON.stringify(a)}\n b ${JSON.stringify(b)}\n c ${JSON.stringify(c)}\n d ${JSON.stringify(d)}`);
  await page.locator("canvas.main-canvas").screenshot({ path: join(SHOTS, "a4-four-gestures-before-reload.png") });

  // Let the autosave land, then reload and Resume.
  await page.waitForTimeout(12_000);
  await page.reload();
  const resume = page.getByRole("button", { name: /Resume editing/ });
  await expect(resume).toBeVisible({ timeout: 30_000 });
  await resume.click();
  await waitForCanvas(page);
  await exposeEngine(page);
  await expect.poll(async () => (await probe(page)).shapes, { timeout: 20_000 }).toBe(4);
  // Sensitivity check, off by default: QC_MUTATE=first-undo-noop makes the
  // first undo after Resume do nothing (the #351-without-#356 symptom). This
  // test must then go red; that was demonstrated once for the 10-14 report.
  if (process.env.QC_MUTATE === "first-undo-noop") {
    // Swallow the first Ctrl+Z before the app's listener sees it: on screen,
    // exactly "the first undo did nothing".
    const patched = await page.evaluate(() => {
      let swallowed = false;
      window.addEventListener(
        "keydown",
        (e) => {
          if (!swallowed && e.ctrlKey && !e.shiftKey && (e.key === "z" || e.key === "Z")) {
            swallowed = true;
            e.stopImmediatePropagation();
            e.preventDefault();
          }
        },
        { capture: true },
      );
      return true;
    });
    console.log(`[qc] MUTANT first-undo-noop installed: ${patched}`);
  }
  const r0 = await probe(page);
  console.log(`[qc] after Resume: ${JSON.stringify(r0)}`);
  expect(r0.hash, "the resumed canvas is the pre-reload canvas").toBe(d.hash);
  expect(r0.broken).toBe(false);
  await page.locator("canvas.main-canvas").screenshot({ path: join(SHOTS, "a4-after-resume.png") });

  const steps: Array<[string, Probe]> = [
    ["D duplicate", c],
    ["C turned sloppy rect", b],
    ["B 7-point star", a],
    ["A rounded rect", h0],
  ];
  let shapesLeft = 4;
  for (const [what, target] of steps) {
    const prevUndo = (await probe(page)).undo;
    await key(page, "Control+z");
    await expect.poll(async () => (await probe(page)).shapes, { timeout: 15_000, message: what }).toBe(shapesLeft - 1);
    await page.waitForTimeout(400);
    const now = await probe(page);
    console.log(`[qc] reload-undo ${what}: ${JSON.stringify(now)} (undo was ${prevUndo})`);
    expect(now.hash, `${what}: one Ctrl+Z after reload lands on the pre-reload state`).toBe(target.hash);
    expect(now.broken, `${what}: log not broken`).toBe(false);
    shapesLeft -= 1;
  }
  // and back with redo, once
  await key(page, "Control+Shift+z");
  await expect.poll(async () => (await probe(page)).shapes, { timeout: 15_000 }).toBe(1);
  expect((await probe(page)).hash, "redo after reload brings A back byte-exact").toBe(a.hash);

  const diag = await diagnosticsWhy(page, "a4-diagnostics-oplog-recording.png");
  console.log(`[qc] Diagnostics after reload+undo: ${JSON.stringify(diag)}`);
  expect(diag.why).toMatch(/recording/);
  expect(diag.why).not.toMatch(/broken/);
  expect(errors).toEqual([]);
});

// ── #348 UI state pass ──────────────────────────────────────────────────────

test("B1 fast photo switching: six PageDown/PageUp presses in a row settle on a real, unlocked document", async ({ page }) => {
  const errors = await setup(page, [CHECKER, SKY]);
  await expect(page.locator(".per-photo-name")).toContainText("1 of 2");
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  for (const k of ["PageDown", "PageUp", "PageDown", "PageUp", "PageDown", "PageUp", "PageDown"]) {
    await page.keyboard.press(k);
    await page.waitForTimeout(60);
  }
  await expect(page.locator('[data-document-locked="true"]')).toHaveCount(0, { timeout: 20_000 });
  const dims = await page.locator("canvas.main-canvas").evaluate((c: HTMLCanvasElement) => `${c.width}x${c.height}`);
  const name = await page.locator(".per-photo-name").first().innerText();
  console.log(`[qc] after rapid switching: canvas ${dims}, name "${name}"`);
  // the canvas and the name must agree about which photo is open
  if (/sky-building/.test(name)) expect(dims).toBe("1220x820");
  else expect(dims).toBe("276x276");
  await page.screenshot({ path: join(SHOTS, "b1-rapid-switch-settled.png") });
  expect(errors).toEqual([]);
});

test("B2 a forced save failure shows the save-failed status and keeps undo", async ({ page }) => {
  await page.addInitScript(() => {
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (value, key) {
      if (this.name === "edits") throw new DOMException("Injected full disk", "QuotaExceededError");
      return put.call(this, value, key);
    };
  });
  await setup(page);
  await page.getByRole("button", { name: "Enhance", exact: true }).first().click();
  await page.getByRole("button", { name: "Presets", exact: true }).first().click();
  await page.getByRole("button", { name: /^Apply Vivid —/ }).first().click();
  await page.locator("canvas.main-canvas").hover({ position: { x: 5, y: 5 } });
  const failed = page.getByTestId("status-save-failed");
  await expect(failed).toBeVisible({ timeout: 20_000 });
  console.log(`[qc] save-failed status text: "${(await failed.innerText()).trim()}"`);
  await expect(page.getByRole("button", { name: "Undo", exact: true }).first()).toBeEnabled();
  await page.screenshot({ path: join(SHOTS, "b2-forced-save-failure.png") });
});

// ── Night 19 (#354) ─────────────────────────────────────────────────────────

test("C1 drag-drop a second image: Add this image shows a reserved preview box, Add to gallery adds it", async ({ page }) => {
  const errors = await setup(page);
  const bytes = (await import("node:fs")).readFileSync(SKY).toString("base64");
  await page.evaluate(async (b64) => {
    const bin = Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0));
    const file = new File([bin], "sky-building.png", { type: "image/png" });
    const dt = new DataTransfer();
    dt.items.add(file);
    for (const type of ["dragenter", "dragover", "drop"]) {
      window.dispatchEvent(new DragEvent(type, { dataTransfer: dt, bubbles: true, cancelable: true }));
    }
  }, bytes);
  const dialog = page.getByRole("dialog", { name: "Add this image" });
  await expect(dialog).toBeVisible();
  const box = dialog.getByTestId("import-preview-box");
  await expect(box).toBeVisible();
  await expect(dialog.getByRole("img", { name: "Image to import" })).toBeVisible();
  const bb = (await box.boundingBox())!;
  const dimsText = await dialog.locator(".import-preview-dims").innerText();
  console.log(`[qc] import preview box ${bb.width.toFixed(1)}x${bb.height.toFixed(1)}, label "${dimsText}"`);
  await dialog.screenshot({ path: join(SHOTS, "c1-import-preview.png") });
  await dialog.getByRole("button", { name: /gallery/i }).first().click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator(".per-photo-name")).toContainText(/of 2/, { timeout: 20_000 });
  expect(errors).toEqual([]);
});

test("C2 Diagnostics › Current Image Meta: EXIF row settles (no stuck skeleton)", async ({ page }) => {
  const errors = await setup(page);
  await key(page, "Alt+Delete");
  const dialog = page.getByRole("dialog", { name: "Diagnostics Window" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("tab", { name: "Current Image Meta", exact: true }).click();
  await expect(dialog.getByText("Capture metadata (EXIF)")).toBeVisible();
  await expect(dialog.getByTestId("exif-skeleton")).toHaveCount(0, { timeout: 10_000 });
  await expect(dialog.getByText(/No EXIF metadata in the original|Camera|Taken/).first()).toBeVisible();
  await dialog.screenshot({ path: join(SHOTS, "c2-diagnostics-exif.png") });
  expect(errors).toEqual([]);
});

test("C3 master bar: going to ≤1000 px holds the bar's box (fallback) while the chunk loads", async ({ page }) => {
  // Hold the lazy MasterBar chunk so the fallback is observable.
  let release: () => void = () => {};
  const gate = new Promise<void>((r) => (release = r));
  await blockExternalNetwork(page);
  await page.route(/assets\/MasterBar-[^/]*\.js$/, async (route) => {
    await gate;
    await route.continue();
  });
  const errors = watchConsole(page);
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto("/");
  await importFiles(page, [CHECKER]);
  await page.setViewportSize({ width: 900, height: 900 });
  const cont = page.getByRole("button", { name: "Continue", exact: true });
  if (await cont.isVisible().catch(() => false)) await cont.click();
  const fallback = page.getByTestId("master-bar-fallback");
  const sawFallback = await fallback.waitFor({ state: "attached", timeout: 10_000 }).then(() => true, () => false);
  if (sawFallback) {
    await page.waitForTimeout(500); // past the 300 ms grace: slot skeletons paint
    const fb = (await fallback.boundingBox())!;
    console.log(`[qc] master bar fallback box ${JSON.stringify(fb)}`);
    await page.screenshot({ path: join(SHOTS, "c3-master-bar-fallback.png") });
  }
  release();
  const bar = page.getByRole("navigation", { name: /Master bar/i }).or(page.locator('[aria-label="Master bar"]')).first();
  await expect(bar).toBeVisible({ timeout: 20_000 });
  await expect(fallback).toHaveCount(0);
  const real = (await bar.boundingBox())!;
  console.log(`[qc] real master bar box ${JSON.stringify(real)}; sawFallback=${sawFallback}`);
  await page.screenshot({ path: join(SHOTS, "c3-master-bar-loaded.png") });
  expect(sawFallback, "the fallback held the bar's place while the chunk was held").toBe(true);
  expect(errors).toEqual([]);
});

// ── Night 20 (#355) ─────────────────────────────────────────────────────────

test("D1 radio groups answer the keyboard: Histogram channels, Placement, Stamp", async ({ page }) => {
  const errors = await setup(page);
  const report: Record<string, string> = {};

  // Histogram channels: lives in the tools sidebar footer.
  await page.getByRole("button", { name: "Enhance", exact: true }).first().click();
  await page.getByRole("button", { name: "Adjustments", exact: true }).first().click();
  const hist = page.getByRole("radiogroup", { name: "Histogram channels" });
  if (await hist.isVisible().catch(() => false)) {
    const first = hist.getByRole("radio").first();
    await first.focus();
    const before = await hist.getByRole("radio", { checked: true }).innerText();
    await page.keyboard.press("ArrowRight");
    const after = await hist.getByRole("radio", { checked: true }).innerText();
    const focusedIsChecked = await page.evaluate(() => document.activeElement?.getAttribute("aria-checked"));
    report.histogram = `${before.trim()} → ${after.trim()}, focused aria-checked=${focusedIsChecked}`;
    expect(after).not.toBe(before);
    await hist.screenshot({ path: join(SHOTS, "d1-histogram-radiogroup.png") });
  } else report.histogram = "NOT VISIBLE on Enhance › Adjustments";

  // Placement: Shapes panel, with a shape selected.
  await openShapes(page);
  await pickShape(page, "Rectangle");
  await dragCanvas(page, [60, 60], [140, 140]);
  await apply(page);
  const edge = await canvasToScreen(page, 100, 60);
  await page.mouse.click(edge.x, edge.y);
  await expect(page.getByTestId("shape-action-bar")).toBeVisible();
  const section = page.getByRole("button", { name: /^Placement/ }).first();
  if ((await section.getAttribute("aria-expanded")) === "false") await section.click();
  const grid = page.getByRole("radiogroup", { name: "Placement" });
  if (await grid.isVisible().catch(() => false)) {
    const radios = grid.getByRole("radio");
    report.placementCount = String(await radios.count());
    await radios.nth(4).focus();
    await page.keyboard.press("ArrowRight");
    report.placementFocused = (await page.evaluate(() => document.activeElement?.getAttribute("aria-label"))) ?? "";
    report.placementChecked = (await grid.getByRole("radio", { checked: true }).count()).toString();
    await grid.screenshot({ path: join(SHOTS, "d1-placement-radiogroup.png") });
  } else report.placement = "NOT VISIBLE with a pending rectangle";
  await page.keyboard.press("Escape");

  // Stamp presets: Create › Stamp.
  await page.getByRole("button", { name: "Create", exact: true }).first().click();
  const stampBtn = page.getByRole("button", { name: "Stamps", exact: true }).first();
  if (await stampBtn.isVisible().catch(() => false)) {
    await stampBtn.click();
    const stamp = page.getByRole("radiogroup", { name: "Stamp" });
    if (await stamp.isVisible().catch(() => false)) {
      const r = stamp.getByRole("radio");
      report.stampCount = String(await r.count());
      await r.first().focus();
      await page.keyboard.press("ArrowDown");
      report.stampFocused = ((await page.evaluate(() => document.activeElement?.textContent)) ?? "").trim();
      report.stampChecked = ((await stamp.getByRole("radio", { checked: true }).first().textContent().catch(() => "none")) ?? "").trim();
      await stamp.screenshot({ path: join(SHOTS, "d1-stamp-radiogroup.png") });
    } else report.stamp = "radiogroup 'Stamp' not visible";
  } else report.stamp = "no Stamp tool button under Create";
  console.log(`[qc] radio groups: ${JSON.stringify(report)}`);
  expect(errors).toEqual([]);
});

test("D2 F2 renames the focused layer row; Enter commits and focus returns to the row", async ({ page }) => {
  const errors = await setup(page);
  await page.getByRole("button", { name: "Review", exact: true }).first().click();
  const row = page.locator('[aria-keyshortcuts="F2"]').first();
  await expect(row, "a layer row advertises F2").toBeVisible({ timeout: 10_000 });
  const rowLabel = (await row.getAttribute("aria-label")) ?? (await row.innerText());
  await row.focus();
  await page.keyboard.press("F2");
  const input = page.getByRole("textbox", { name: /^Rename / });
  await expect(input).toBeVisible();
  await expect(input).toBeFocused();
  const inputName = await input.getAttribute("aria-label");
  await input.fill("QC renamed");
  await page.keyboard.press("Enter");
  await expect(input).toHaveCount(0);
  await expect(page.getByText("QC renamed").first()).toBeVisible();
  await page.waitForTimeout(200);
  const focus = await page.evaluate(() => ({
    keyshortcuts: document.activeElement?.getAttribute("aria-keyshortcuts"),
    text: document.activeElement?.textContent?.slice(0, 60),
    tag: document.activeElement?.tagName,
  }));
  console.log(`[qc] F2: row "${rowLabel}", input "${inputName}", focus after Enter ${JSON.stringify(focus)}`);
  expect(focus.keyshortcuts, "focus went back to the row").toBe("F2");
  // Escape path: F2 again, Escape, name unchanged, focus back on the row.
  await page.keyboard.press("F2");
  await expect(input).toBeFocused();
  await input.fill("discard me");
  await page.keyboard.press("Escape");
  await expect(input).toHaveCount(0);
  await expect(page.getByText("discard me")).toHaveCount(0);
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => document.activeElement?.getAttribute("aria-keyshortcuts"))).toBe("F2");
  await page.screenshot({ path: join(SHOTS, "d2-f2-rename.png") });
  expect(errors).toEqual([]);
});

// ── Skill sections 1, 2 and 4 ───────────────────────────────────────────────

test("S1 logged-out boot: clean console, engine wasm fetched, an image loads", async ({ page }) => {
  const errors = watchConsole(page);
  await blockExternalNetwork(page);
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto("/");
  const input = page.locator('input[type="file"]').first();
  await input.waitFor({ state: "attached", timeout: 30_000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: join(SHOTS, "s1-boot-logged-out.png") });
  const bundle = await page.evaluate(() =>
    [...document.querySelectorAll("script[src]")].map((s) => s.getAttribute("src")).filter((s) => /index-/.test(s ?? "")),
  );
  await importFiles(page, [CHECKER]);
  const wasm = await page.evaluate(() =>
    performance
      .getEntriesByType("resource")
      .filter((e) => /stamp_tool_bg-.*\.wasm/.test(e.name))
      .map((e) => ({ name: e.name.split("/").pop(), bytes: (e as PerformanceResourceTiming).decodedBodySize })),
  );
  const signIn = await page.getByRole("button", { name: /sign in|log in/i }).count();
  console.log(`[qc] boot: bundle ${JSON.stringify(bundle)}, wasm ${JSON.stringify(wasm)}, sign-in buttons ${signIn}`);
  expect(wasm.length).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test("S4 persistence: two photos + an edit survive reload; Resume brings back the same pixels", async ({ page }) => {
  test.setTimeout(180_000);
  const errors = await setup(page, [CHECKER, SKY]);
  const before0 = await probe(page);
  await page.getByRole("button", { name: "Enhance", exact: true }).first().click();
  await page.getByRole("button", { name: "Presets", exact: true }).first().click();
  await page.getByRole("button", { name: /^Apply Vivid —/ }).first().click();
  await expect.poll(async () => (await probe(page)).hash).not.toBe(before0.hash);
  const edited = await probe(page);
  await page.waitForTimeout(12_000);
  await page.reload();
  const resume = page.getByRole("button", { name: /Resume editing/ });
  await expect(resume).toBeVisible({ timeout: 30_000 });
  await page.screenshot({ path: join(SHOTS, "s4-welcome-back.png") });
  await resume.click();
  await waitForCanvas(page);
  await exposeEngine(page);
  await expect.poll(async () => (await probe(page)).hash, { timeout: 20_000 }).toBe(edited.hash);
  await expect(page.locator(".per-photo-name")).toContainText("of 2");
  await expect(page.getByRole("button", { name: "Undo", exact: true }).first()).toBeEnabled();
  await key(page, "Control+z");
  await expect.poll(async () => (await probe(page)).hash, { timeout: 15_000 }).toBe(before0.hash);
  console.log(`[qc] persistence: edited ${edited.hash} restored, undo after resume → ${before0.hash}`);
  expect(errors.filter((e) => /dexie|indexeddb/i.test(e)), "no Dexie errors").toEqual([]);
  expect(errors).toEqual([]);
});
