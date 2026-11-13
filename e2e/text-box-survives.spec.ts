import { test, expect } from "./guard/test";
import type { Page } from "@playwright/test";
import { join } from "node:path";
import { installAnnotationProbe, screenPoint } from "./annotation-benchmark-harness";

// ─────────────────────────────────────────────────────────────────────────────
// A dragged text box keeps its size on every way the editor brings it back
// (33a; ADR-024-F7, open since v8.40: "wrap_width 340 → 0 after a reload").
//
// A text is typed, its box dragged to about 340 × 200, and committed. Then one
// of the in-session actions below runs (or none), a last edit lands on top,
// and the page is reloaded down ONE of the two resume paths:
//
//   oplog    — the normal resume: the op log on disk is replayed.
//   archive  — the op log's manifest is marked stale first, the way a log
//              retired for a missing edit is (ADR-103), so the resume falls
//              back to the working-copy archive (lib/restoreLayerStack.ts).
//
// After the reload: the texts are field-for-field what they were (so the box,
// the wrap and the line breaks, which are the tile's size, match), the engine's
// pixels hash the same, and ONE Ctrl+Z undoes the last edit, not the box.
//
// The actions: nothing, a duplicate, a nudge, a Perspective, a rotation, and
// (through the UI) Align ▾ › Align bottom and Placement › Bottom right
// (PARKING_LOT 33a leftovers, 11-12-2026).
//
// Cloud restore uses the archive's own format and restore code
// (useEditPersistence → restoreLayerStack), so `archive` covers it. Export
// rebuilds through the same `restoreLayerStack`; e2e/export-matches-canvas.spec.ts
// downloads one and compares it with the canvas.
// ─────────────────────────────────────────────────────────────────────────────

const FIXTURE_PNG = join(__dirname, "fixtures", "paper-1200x900.png");
const AT = { x: 200, y: 200 };
const WANT = { w: 340, h: 200 };
const TEXT = "The crack runs along the north wall. It is wider at the top. Patch it before the rain comes.";

type Text = { id: number; text: string; x: number; y: number; wrap_width: number; box_height: number; rotation_deg: number };
type Layer = { shapes: unknown[]; texts: Text[] };

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

const withoutIds = (l: Layer) => ({
  shapes: l.shapes.map((s) => ({ ...(s as object), id: 0 })),
  texts: l.texts.map((t) => ({ ...t, id: 0 })),
});

/** SHA-256 of the engine's composite: the pixels, not the canvas element. */
const pixels = (page: Page): Promise<string> =>
  page.evaluate(async () => {
    const px = await window.__annotationTool.get_image_data();
    const d = await crypto.subtle.digest("SHA-256", new Uint8Array(px));
    return Array.from(new Uint8Array(d), (b) => b.toString(16).padStart(2, "0")).join("");
  });

async function key(page: Page, combo: string) {
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press(combo);
}

async function createTool(page: Page, name: string) {
  await page.getByRole("button", { name: "Create", exact: true }).first().click();
  await page.getByRole("button", { name, exact: true }).first().click();
}

/** Type TEXT at AT, drag the box's bottom-right corner to make it WANT, then
 *  commit (click away, Escape the input that click opens). */
async function placeBoxedText(page: Page): Promise<Text> {
  await createTool(page, "Text");
  const at = await screenPoint(page, AT.x, AT.y);
  await page.mouse.click(at.x, at.y);
  const input = page.locator("textarea").first();
  await expect(input).toBeVisible();
  await input.fill(TEXT);
  await page.waitForTimeout(300);

  // The box's corners: the two diagonal-cursor handles on the NW and SE.
  const corners = page.locator('rect[style*="nwse-resize"]');
  await expect(corners).toHaveCount(2);
  const nw = (await corners.nth(0).boundingBox())!;
  const se = (await corners.nth(1).boundingBox())!;
  const scale = await page.evaluate(() => {
    const c = document.querySelector<HTMLCanvasElement>("canvas.main-canvas")!;
    return c.getBoundingClientRect().width / c.width;
  });
  const from = { x: se.x + se.width / 2, y: se.y + se.height / 2 };
  const to = { x: nw.x + nw.width / 2 + WANT.w * scale, y: nw.y + nw.height / 2 + WANT.h * scale };
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(300);

  const away = await screenPoint(page, 1000, 800);
  await page.mouse.click(away.x, away.y);
  await page.waitForTimeout(600);
  await page.keyboard.press("Escape");
  await expect.poll(async () => (await layer(page)).texts.length).toBe(1);
  const t = (await layer(page)).texts[0];
  // The drag lands within a few px of what was asked; what matters after this
  // is that whatever it IS comes back unchanged.
  expect(Math.abs(t.wrap_width - WANT.w), `wrap_width ${t.wrap_width}`).toBeLessThanOrEqual(4);
  expect(Math.abs(t.box_height - WANT.h), `box_height ${t.box_height}`).toBeLessThanOrEqual(4);
  return t;
}

/** The last edit, landed on top of everything: a rectangle. */
async function lastEdit(page: Page) {
  await page.evaluate(async () => {
    const t = window.__annotationTool;
    await t.add_shape_annotation(0, 900, 700, 1100, 820, "#e02020", 4, 0, 0, "#000000", "#000000", 0, 0, 0, 0, 0, new Uint16Array(4));
    await t.recomposite();
  });
  await expect.poll(async () => (await layer(page)).shapes.length).toBeGreaterThan(0);
}

/** Retire the op log on disk, as a log missing an edit is (ADR-103): restore
 *  then skips it and resumes from the working-copy archive. */
async function retireOplog(page: Page) {
  const n = await page.evaluate(
    () =>
      new Promise<number>((resolve, reject) => {
        const req = indexedDB.open("image-horse-dexie");
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction("oplogManifests", "readwrite");
          const store = tx.objectStore("oplogManifests");
          const all = store.getAll();
          all.onsuccess = () => {
            for (const m of all.result) store.put({ ...m, stale: true });
            tx.oncomplete = () => { db.close(); resolve(all.result.length); };
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
  );
  expect(n, "there was an op log to retire").toBeGreaterThan(0);
}

async function oplogIsLive(page: Page): Promise<boolean> {
  return page.evaluate(
    () =>
      new Promise<boolean>((resolve) => {
        const req = indexedDB.open("image-horse-dexie");
        req.onsuccess = () => {
          const db = req.result;
          const all = db.transaction("oplogManifests").objectStore("oplogManifests").getAll();
          all.onsuccess = () => { db.close(); resolve(all.result.some((m: { stale?: boolean; opCount: number }) => !m.stale && m.opCount > 0)); };
        };
        req.onerror = () => resolve(false);
      }),
  );
}

async function reloadAndResume(page: Page, path: "oplog" | "archive") {
  // Wait out both autosaves (archive + op log debounce).
  await page.waitForTimeout(7000);
  if (path === "archive") await retireOplog(page);
  else expect(await oplogIsLive(page), "an op log was saved to resume from").toBe(true);
  await page.reload();
  await page.getByRole("button", { name: /Resume editing/i }).click();
  await expect.poll(() => page.locator("canvas.main-canvas").getAttribute("width")).toBe("1200");
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
  await installAnnotationProbe(page);
}

type Action = (page: Page, t: Text) => Promise<void>;
const ACTIONS: Record<string, Action> = {
  "nothing else": async () => {},
  "a duplicate": async (page, t) => {
    await page.evaluate(async (id) => {
      await window.__annotationTool.duplicate_annotations(new Uint32Array(0), Uint32Array.of(id), 20, 20);
      await window.__annotationTool.recomposite();
    }, t.id);
  },
  "a nudge": async (page, t) => {
    await page.evaluate(async (id) => {
      // The app recomposites after every move (useAnnotationSelection's
      // `after`), which is what closes the move's gesture in the op log.
      await window.__annotationTool.move_annotations(new Uint32Array(0), Uint32Array.of(id), 0, 10);
      await window.__annotationTool.recomposite();
    }, t.id);
  },
  "a Perspective": async (page, t) => {
    await page.evaluate(async (id) => {
      await window.__annotationTool.set_text_perspective(id, Float32Array.of(0, 0, 1, 0.05, 0.95, 1, 0.02, 0.97));
      await window.__annotationTool.recomposite();
    }, t.id);
  },
  // The Text tool's rotate handle ends in this same call: the annotation
  // rewritten with every field it had and a new angle.
  "a rotation": async (page, t) => {
    await page.evaluate(async (id) => {
      const tool = window.__annotationTool;
      const a = JSON.parse(await tool.get_text_annotations()).find((x: { id: number }) => x.id === id);
      await tool.update_text_annotation(
        id, a.text, a.font_size, a.r, a.g, a.b, a.bold, a.x, a.y, 15,
        a.background_kind, a.bg_r, a.bg_g, a.bg_b, a.bg_a, a.bg_padding, a.bg_corner_radius, a.bg_tail,
      );
      await tool.recomposite();
    }, t.id);
    expect((await layer(page)).texts[0].rotation_deg).toBe(15);
  },
  // Through the UI: Select objects, the text, Align ▾ › Align bottom.
  "an Align": async (page, t) => {
    await createTool(page, "Select objects");
    const at = await screenPoint(page, t.x + 20, t.y + 20);
    await page.mouse.click(at.x, at.y);
    const bar = page.getByTestId("multi-select-bar");
    await bar.getByRole("button", { name: "Align", exact: true }).click();
    await page.getByRole("menuitem", { name: "Align bottom", exact: true }).click();
    await expect.poll(async () => (await layer(page)).texts[0].y).toBeGreaterThan(t.y + 100);
    await page.keyboard.press("Escape");
  },
  // Through the UI: the text open in the Text tool, Placement › Bottom right.
  "a Placement": async (page, t) => {
    await createTool(page, "Text");
    const at = await screenPoint(page, t.x + 20, t.y + 20);
    await page.mouse.click(at.x, at.y);
    await expect(page.locator("textarea").first()).toBeVisible();
    const panel = page.getByRole("region", { name: "Tool options" });
    const cell = panel.getByRole("radio", { name: "Bottom right", exact: true }).or(
      panel.getByRole("button", { name: "Bottom right", exact: true }));
    if (!(await cell.isVisible())) await panel.getByRole("button", { name: "Placement", exact: true }).click();
    await cell.click();
    await expect.poll(async () => (await layer(page)).texts[0].x).toBeGreaterThan(t.x + 100);
    const away = await screenPoint(page, 100, 100);
    await page.mouse.click(away.x, away.y);
    await page.waitForTimeout(600);
    await page.keyboard.press("Escape");
    await expect(page.locator("textarea")).toHaveCount(0);
  },
};

for (const path of ["oplog", "archive"] as const) {
  test.describe(`a text box survives a reload by the ${path} path`, () => {
    for (const [name, act] of Object.entries(ACTIONS)) {
      test(`after ${name}`, async ({ page }) => {
        await open(page);
        const placed = await placeBoxedText(page);
        await act(page, placed);
        const beforeLast = await layer(page);
        await lastEdit(page);
        const after = await layer(page);
        const afterPx = await pixels(page);

        await reloadAndResume(page, path);
        await expect.poll(() => layer(page)).toEqual(after);
        expect(await pixels(page), "the pixels are the same after the reload").toBe(afterPx);

        // One Ctrl+Z takes the last edit and leaves the box alone. Ids are left
        // out here: a text restored from the archive is given a fresh id, and
        // a history snapshot's copy of it a different one. Every other field,
        // the box included, has to match.
        await key(page, "Control+z");
        await expect.poll(async () => withoutIds(await layer(page))).toEqual(withoutIds(beforeLast));
      });
    }
  });
}

test("undo and redo across the box drag keep the box", async ({ page }) => {
  await open(page);
  await placeBoxedText(page);
  const placed = await layer(page);
  await lastEdit(page);
  const after = await layer(page);
  await key(page, "Control+z");
  await expect.poll(() => layer(page)).toEqual(placed);
  await key(page, "Control+Shift+z");
  await expect.poll(() => layer(page)).toEqual(after);
});
