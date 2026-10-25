import { test, expect } from "./guard/test";
import type { Page } from "@playwright/test";
import { join } from "node:path";
import { installAnnotationProbe, screenPoint } from "./annotation-benchmark-harness";
import { findCallouts, type CalloutShape, type CalloutText } from "../app/src/lib/callouts";

// ─────────────────────────────────────────────────────────────────────────────
// Night 10-24 §1 — undoing a text's Placement never loses work.
//
// PARKING_LOT (Night 10-23): add a text, open it, Placement › Bottom right,
// Escape, Ctrl+Z → `oplog_status()` read "broken — snapshot undo has taken
// over", and after a reload the snapshot steps undo then fell back to dropped
// the layer's SHAPES: one Ctrl+Z on a placed callout's label brought the label
// back and lost its pin and leader.
//
//   1. the repro → the log is NOT broken after the Ctrl+Z;
//   2. Placement on a callout's label, Escape, reload, Ctrl+Z → pin, leader
//      and label all still there, the label back where it was;
//   3. ten mixed edits, reload, undo all ten → every state matches its
//      pre-reload composite hash;
//   4. the fallback itself: the log forced broken, reload, undo → no object
//      is ever dropped;
//   5. leaving the Text tool for Pins after a Placement pushes no empty step.
// ─────────────────────────────────────────────────────────────────────────────

const FIXTURE_PNG = join(__dirname, "fixtures", "paper-1200x900.png");
const PIN_AT = { x: 300, y: 450 };

type Shape = CalloutShape & { kind: number };
type Text = CalloutText & { text: string };
type Layer = { shapes: Shape[]; texts: Text[] };

async function open(page: Page) {
  await page.setViewportSize({ width: 1600, height: 1100 });
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
  await installAnnotationProbe(page);
}

const layer = (page: Page): Promise<Layer> =>
  page.evaluate(async () => ({
    shapes: JSON.parse(await window.__annotationTool.get_shape_annotations()),
    texts: JSON.parse(await window.__annotationTool.get_text_annotations()),
  }));

/** What the engine says about its log and its history. */
const oplog = (page: Page) =>
  page.evaluate(async () => {
    const t = window.__annotationTool;
    return {
      broken: await t.oplog_is_broken(),
      status: await t.oplog_status(),
      cursor: await t.oplog_cursor(),
      ops: await t.oplog_op_count(),
      undo: await t.undo_count(),
    };
  });

const hash = (page: Page) => page.evaluate(() => window.__annotationTool.composite_hash_hex());

/** Objects only: kinds and where they are — what "lost work" means. Not
 *  ids: a reload re-adds the shapes in stack order and numbers them afresh. */
const objects = (l: Layer) => ({
  shapes: l.shapes.map((s) => `${s.kind}@${Math.round(s.x0)},${Math.round(s.y0)}`).sort(),
  texts: l.texts.map((t) => `${t.text}@${t.x},${t.y}`).sort(),
});

/** The on-canvas text editor. */
const editor = (page: Page) => page.locator("textarea[data-text-overlay]");

async function key(page: Page, combo: string) {
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press(combo);
}

async function createTool(page: Page, name: string) {
  await page.getByRole("button", { name: "Create", exact: true }).first().click();
  await page.getByRole("button", { name, exact: true }).first().click();
}

async function placeCallout(page: Page, label: string, at = PIN_AT) {
  await createTool(page, "Pins");
  await page.getByRole("radio", { name: "Callout", exact: true }).click();
  const p = await screenPoint(page, at.x, at.y);
  await page.mouse.click(p.x, p.y);
  const input = page.getByRole("textbox", { name: "Callout label" });
  await expect(input).toBeFocused();
  await input.fill(label);
  await input.press("Enter");
  await expect(input).toHaveCount(0);
  await expect.poll(async () => {
    const l = await layer(page);
    return findCallouts(l.shapes, l.texts).length;
  }).toBe(1);
  await page.getByRole("radio", { name: "Pin", exact: true }).click();
}

/** A plain text, committed: click, type, click away, Escape the fresh input
 *  the click opens (Escape alone DISCARDS an uncommitted text). */
async function addText(page: Page, text: string, at: { x: number; y: number }) {
  await createTool(page, "Text");
  const before = (await layer(page)).texts.length;
  const p = await screenPoint(page, at.x, at.y);
  await page.mouse.click(p.x, p.y);
  await expect(editor(page)).toBeVisible();
  await editor(page).fill(text);
  const away = await screenPoint(page, 1100, 120);
  await page.mouse.click(away.x, away.y);
  await expect.poll(async () => (await layer(page)).texts.length).toBe(before + 1);
  // Escape in the editor the click opened, as a person does (no blur first).
  await page.keyboard.press("Escape");
  await expect(editor(page)).toHaveCount(0);
}

/** Open `t` in the Text tool (the tool must already be the Text tool). */
async function openText(page: Page, t: Text) {
  const at = await screenPoint(page, t.x + t.tile_offset_x + t.tile_w / 2, t.y + t.tile_offset_y + t.tile_h / 2);
  await page.mouse.click(at.x, at.y);
  await expect(editor(page)).toHaveValue(t.text);
}

/** Placement › `cell` on the open text. The move re-opens the editor on the
 *  text and focuses it; wait for that, so nothing below races it. */
async function place(page: Page, cell: string) {
  const panel = page.getByRole("region", { name: "Tool options" });
  const grid = panel.getByRole("radio", { name: cell, exact: true }).or(
    panel.getByRole("button", { name: cell, exact: true }));
  if (!(await grid.isVisible())) await panel.getByRole("button", { name: "Placement", exact: true }).click();
  const at = (await layer(page)).texts.map((t) => `${t.x},${t.y}`).join();
  await grid.click();
  await expect.poll(async () => (await layer(page)).texts.map((t) => `${t.x},${t.y}`).join()).not.toBe(at);
  await expect(editor(page)).toBeFocused();
}

/** The PARKING_LOT recipe's Escape: focus has left the editor (a panel
 *  control, the page), so Escape never reaches it and the text stays open. */
async function escapeElsewhere(page: Page) {
  await key(page, "Escape");
  await expect(editor(page)).toHaveCount(1);
}

/** Leave the Text tool for Pins: the switch commits the open text. Until
 *  the editor closes the text's tile is hidden, so a state is read after. */
async function leaveForPins(page: Page) {
  await createTool(page, "Pins");
  await expect(editor(page)).toHaveCount(0);
}

/** Wait out the autosave, reload, resume. Until the resumed photo stops
 *  loading (the panel's aria-busy), the app drops an undo press on purpose
 *  (`isPhotoSwitching`), so nothing is pressed before then. */
async function reloadAndResume(page: Page) {
  await page.waitForTimeout(6000);
  await page.reload();
  await page.getByRole("button", { name: /Resume editing/i }).click();
  await expect.poll(() => page.locator("canvas.main-canvas").getAttribute("width")).toBe("1200");
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
  await installAnnotationProbe(page);
}

/** A rectangle dragged with the Shapes tool, committed with Enter. */
async function addRect(page: Page, x: number, y: number) {
  await createTool(page, "Shapes");
  const before = (await layer(page)).shapes.length;
  const a = await screenPoint(page, x, y);
  const b = await screenPoint(page, x + 120, y + 80);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 6 });
  await page.mouse.up();
  await key(page, "Enter");
  await expect.poll(async () => (await layer(page)).shapes.length).toBe(before + 1);
}

/** One pin, dropped with the Pins tool (Pin mode). */
async function addPin(page: Page, x: number, y: number) {
  await createTool(page, "Pins");
  await page.getByRole("radio", { name: "Pin", exact: true }).click();
  const before = (await layer(page)).shapes.length;
  const p = await screenPoint(page, x, y);
  await page.mouse.click(p.x, p.y);
  await expect.poll(async () => (await layer(page)).shapes.length).toBe(before + 1);
}

test.describe("undoing a text's Placement never loses work (Night 10-24 §1)", () => {
  test("1 — Placement, the editor still open, Ctrl+Z: the log is not broken", async ({ page }) => {
    await open(page);
    await addText(page, "Plain", { x: 300, y: 300 });
    const before = await layer(page);
    await openText(page, before.texts[0]);
    await place(page, "Bottom right");
    await escapeElsewhere(page);
    await key(page, "Control+z");
    await expect.poll(() => layer(page)).toEqual(before);
    const log = await oplog(page);
    expect(log.status).not.toContain("broken");
    expect(log.cursor, "the undo replayed the log").toBe(1);
    await expect(editor(page), "no editor left open over the undone text").toHaveCount(0);
  });

  test("1b — the same with the Undo button", async ({ page }) => {
    await open(page);
    await addText(page, "Plain", { x: 300, y: 300 });
    const before = await layer(page);
    await openText(page, before.texts[0]);
    await place(page, "Bottom right");
    await page.getByRole("button", { name: "Undo", exact: true }).first().click();
    await expect.poll(() => layer(page)).toEqual(before);
    expect((await oplog(page)).broken).toBe(false);
    await expect(editor(page)).toHaveCount(0);
  });

  test("1c — typing in the open editor: Ctrl+Z throws the typing away, and only that", async ({ page }) => {
    await open(page);
    await addText(page, "Plain", { x: 300, y: 300 });
    const before = await layer(page);
    await openText(page, before.texts[0]);
    await editor(page).fill("Plainer");
    await key(page, "Control+z");
    await expect(editor(page)).toHaveCount(0);
    expect(await layer(page), "the committed text is untouched").toEqual(before);
    expect((await oplog(page)).undo).toBe(1);
  });

  test("2 — Placement on a callout's label, undo, redo, reload, Ctrl+Z: pin, leader and label all stay", async ({ page }) => {
    await open(page);
    await placeCallout(page, "Crack");
    const before = await layer(page);
    const label = findCallouts(before.shapes, before.texts)[0];
    const t = before.texts.find((x) => x.id === label.label)!;
    await createTool(page, "Text");
    await openText(page, t);
    await place(page, "Bottom right");
    await escapeElsewhere(page);
    const placed = await layer(page);
    // callout-leader.spec's sequence: one Ctrl+Z, one redo, then the reload.
    await key(page, "Control+z");
    await expect.poll(() => layer(page)).toEqual(before);
    await key(page, "Control+Shift+z");
    await expect.poll(() => layer(page)).toEqual(placed);
    await reloadAndResume(page);
    await expect.poll(async () => objects(await layer(page))).toEqual(objects(placed));
    await key(page, "Control+z");
    await expect.poll(async () => objects(await layer(page))).toEqual(objects(before));
    const l = await layer(page);
    expect(findCallouts(l.shapes, l.texts), "pin, leader and label are still one callout").toHaveLength(1);
    expect((await oplog(page)).broken).toBe(false);
  });

  test("3 — ten mixed edits, reload, undo all ten: every state matches", async ({ page }) => {
    test.setTimeout(240_000);
    await open(page);
    const hashes: string[] = [await hash(page)];
    const states: ReturnType<typeof objects>[] = [objects(await layer(page))];
    const step = async (act: () => Promise<void>) => {
      await act();
      hashes.push(await hash(page));
      states.push(objects(await layer(page)));
    };
    await step(() => addRect(page, 150, 150));
    await step(() => addPin(page, 600, 200));
    await step(() => addText(page, "One", { x: 400, y: 500 }));
    await step(async () => {
      await openText(page, (await layer(page)).texts[0]);
      await place(page, "Top right");
      await escapeElsewhere(page);
      await leaveForPins(page);
    });
    await step(() => addRect(page, 200, 600));
    await step(() => placeCallout(page, "Two", { x: 800, y: 600 }));
    await step(() => addText(page, "Three", { x: 200, y: 400 }));
    await step(async () => {
      await openText(page, (await layer(page)).texts.find((x) => x.text === "Three")!);
      await place(page, "Bottom left");
      await escapeElsewhere(page);
      await leaveForPins(page);
    });
    await step(() => addPin(page, 900, 300));
    await step(() => addRect(page, 700, 100));
    const repeats = hashes.map((h, i) => (hashes.indexOf(h) !== i ? `${i}=${hashes.indexOf(h)}` : "")).filter(Boolean);
    expect(repeats, "ten edits, eleven distinct states").toEqual([]);
    expect((await oplog(page)).undo, "ten edits, ten undo steps").toBe(10);
    await reloadAndResume(page);
    expect(await hash(page)).toBe(hashes[10]);
    for (let i = 9; i >= 0; i--) {
      await key(page, "Control+z");
      await expect.poll(() => hash(page), { message: `state ${i} after undo` }).toBe(hashes[i]);
      expect(objects(await layer(page)), `objects at state ${i}`).toEqual(states[i]);
    }
    expect((await oplog(page)).broken).toBe(false);
  });

  // Red on master, and still red: a fallback undo after a reload restores a
  // FLATTENED picture of the step — the saved undo steps keep pixels and a
  // text list, no shapes and no layer stack (capture.rs, useEngineCore.ts) —
  // and a broken log is never persisted, so there is no log to rebuild from.
  // Fixing it changes the saved-edit format: written up as ADR-093 (proposed),
  // not half-fixed here. Night 10-24's fix keeps the log from breaking on a
  // Placement undo, which is what sent the callout case down this path.
  test.fixme("4 — the log forced broken: a fallback undo after a reload drops no object", async ({ page }) => {
    await open(page);
    await placeCallout(page, "Crack");
    const withCallout = await layer(page);
    await addRect(page, 700, 150);
    // An edit the log cannot follow: a shape restack breaks it on purpose
    // (annotations.rs, `op_log_undo_of_a_reorder_keeps_every_shape`).
    await page.evaluate(async () => {
      const t = window.__annotationTool;
      const shapes = JSON.parse(await t.get_shape_annotations()) as { id: number }[];
      await t.move_shape_annotation(shapes[shapes.length - 1].id, 0);
    });
    await expect.poll(async () => (await oplog(page)).broken).toBe(true);
    const restacked = await layer(page);
    await reloadAndResume(page);
    await expect.poll(async () => objects(await layer(page))).toEqual(objects(restacked));
    await key(page, "Control+z");
    await key(page, "Control+z");
    await expect.poll(async () => objects(await layer(page))).toEqual(objects(withCallout));
  });

  test("5 — Text tool → Pins right after a Placement pushes no empty undo step", async ({ page }) => {
    await open(page);
    await addText(page, "Plain", { x: 300, y: 300 });
    const before = await layer(page);
    await openText(page, before.texts[0]);
    await place(page, "Bottom right");
    const placed = await oplog(page);
    await leaveForPins(page);
    expect((await oplog(page)).undo, "a tool switch is not an undo step").toBe(placed.undo);
    await key(page, "Control+z");
    await expect.poll(() => layer(page)).toEqual(before);
  });
});
