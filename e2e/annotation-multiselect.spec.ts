import { test, expect } from "./guard/test";
import type { Page } from "@playwright/test";
import { join } from "node:path";
import { installAnnotationProbe, screenPoint } from "./annotation-benchmark-harness";
import { findCallouts, type CalloutShape, type CalloutText } from "../app/src/lib/callouts";

// ─────────────────────────────────────────────────────────────────────────────
// Multi-select (Night 10-22, §2), through the real UI and a real mouse:
// Shift-click and the Create › Select objects marquee pick several
// annotations; drag, Align, Distribute and Delete act on all of them; and
// every one of those is ONE Ctrl+Z — before a reload and after it, when only
// the op log's gesture markers can say where the step began.
//
// The objects are seeded straight into the engine (the same probe the drag
// benchmark uses), then picked and acted on through the UI.
// ─────────────────────────────────────────────────────────────────────────────

const FIXTURE_PNG = join(__dirname, "fixtures", "paper-1200x900.png");

type Shape = CalloutShape & { number: number; rotation: number };
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

const box = (s: Shape) => ({ x0: Math.min(s.x0, s.x1), y0: Math.min(s.y0, s.y1), x1: Math.max(s.x0, s.x1), y1: Math.max(s.y0, s.y1) });
const textBox = (t: Text) => {
  const x = t.x + t.tile_offset_x;
  const y = t.y + t.tile_offset_y;
  return { x0: x, y0: y, x1: x + t.tile_w, y1: y + t.tile_h };
};

type Seed =
  | { rect: [number, number, number, number] }
  | { arrow: [number, number, number, number] }
  | { pin: [number, number, number] }
  | { text: [string, number, number] };

/** Put objects in the engine, as one setup, and redraw. Returns ids in order. */
async function seed(page: Page, items: Seed[]): Promise<number[]> {
  return page.evaluate(async (items) => {
    const t = window.__annotationTool;
    const ids: number[] = [];
    for (const it of items) {
      if ("rect" in it) {
        const [x, y, w, h] = it.rect;
        ids.push(await t.add_shape_annotation(0, x, y, x + w, y + h, "#e02020", 4, 0, 0, "#000000", "#000000", 0, 0, 0, 0, 0, new Uint16Array(4)));
      } else if ("arrow" in it) {
        const [x0, y0, x1, y1] = it.arrow;
        ids.push(await t.add_shape_annotation(4, x0, y0, x1, y1, "#202020", 4, 0, 0, "#000000", "#000000", 0, 0, 0, 0, 0, new Uint16Array(4)));
      } else if ("pin" in it) {
        const [x, y, n] = it.pin;
        ids.push(await t.insert_pin_annotation(x - 20, y - 20, x + 20, y + 20, n, "#e03030", 0));
      } else {
        const [s, x, y] = it.text;
        ids.push(await t.add_text_annotation(s, 36, 20, 20, 20, false, x, y, 0, 0, 0, 0, 0, 0, 0, 0, 0, ""));
      }
    }
    await t.recomposite();
    return ids;
  }, items);
}

async function key(page: Page, combo: string) {
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press(combo);
}

async function createTool(page: Page, name: string) {
  await page.getByRole("button", { name: "Create", exact: true }).first().click();
  await page.getByRole("button", { name, exact: true }).first().click();
}

/** Drag a marquee over canvas rect (x0,y0)-(x1,y1) with Select objects. */
async function marquee(page: Page, x0: number, y0: number, x1: number, y1: number) {
  await createTool(page, "Select objects");
  const a = await screenPoint(page, x0, y0);
  const b = await screenPoint(page, x1, y1);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 6 });
  await page.mouse.up();
}

async function drag(page: Page, from: { x: number; y: number }, dx: number, dy: number) {
  const a = await screenPoint(page, from.x, from.y);
  const b = await screenPoint(page, from.x + dx, from.y + dy);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 8 });
  await page.mouse.up();
}

const bar = (page: Page) => page.getByTestId("multi-select-bar");
const picked = (page: Page) =>
  page.locator("[data-multi-select-item]").evaluateAll((els) =>
    els.map((e) => `${e.getAttribute("data-type")}${e.getAttribute("data-id")}`).sort());

async function barAction(page: Page, menu: string | null, item: string) {
  if (menu) await bar(page).getByRole("button", { name: menu, exact: true }).click();
  await (menu ? page.getByRole("menuitem", { name: item, exact: true }) : bar(page).getByRole("button", { name: item, exact: true })).click();
}

/** Wait out the autosave, reload, resume — the op log is all undo has left. */
async function reloadAndResume(page: Page) {
  await page.waitForTimeout(6000);
  await page.reload();
  await page.getByRole("button", { name: /Resume editing/i }).click();
  await expect.poll(() => page.locator("canvas.main-canvas").getAttribute("width")).toBe("1200");
  await installAnnotationProbe(page);
}

/** `act` is one undo step, before a reload and after one. */
async function oneStep(page: Page, act: () => Promise<void>, check: (l: Layer) => void) {
  const before = await layer(page);
  await act();
  // The engine call, the re-read and any connector follow land after the
  // mouse is up: wait for the result before taking it as "after".
  await expect.poll(async () => {
    try {
      check(await layer(page));
      return "ok";
    } catch (e) {
      return String(e);
    }
  }).toBe("ok");
  const after = await layer(page);
  await key(page, "Control+z");
  await expect.poll(() => layer(page)).toEqual(before);
  await key(page, "Control+Shift+z");
  await expect.poll(() => layer(page)).toEqual(after);
  await reloadAndResume(page);
  await expect.poll(() => layer(page)).toEqual(after);
  await key(page, "Control+z");
  await expect.poll(() => layer(page)).toEqual(before);
}

test("Shift-click three shapes, drag one: all three move, one Ctrl+Z puts them back", async ({ page }) => {
  await open(page);
  const ids = await seed(page, [{ rect: [100, 100, 120, 80] }, { rect: [400, 120, 100, 100] }, { rect: [700, 300, 80, 120] }]);
  await createTool(page, "Shapes");
  for (const at of [{ x: 100, y: 140 }, { x: 400, y: 170 }, { x: 700, y: 360 }]) {
    const p = await screenPoint(page, at.x, at.y);
    await page.keyboard.down("Shift");
    await page.mouse.click(p.x, p.y);
    await page.keyboard.up("Shift");
  }
  await expect(bar(page)).toContainText("3 selected");
  expect(await picked(page)).toEqual(ids.map((id) => `shape${id}`).sort());
  const start = await layer(page);
  await oneStep(page, () => drag(page, { x: 400, y: 120 }, 60, 90), (l) => {
    for (const id of ids) {
      const a = start.shapes.find((s) => s.id === id)!;
      const b = l.shapes.find((s) => s.id === id)!;
      expect([Math.round(b.x0 - a.x0), Math.round(b.y0 - a.y0)]).toEqual([60, 90]);
    }
  });
});

test("a marquee picks exactly what is inside it, and a callout's three parts", async ({ page }) => {
  await open(page);
  const [rect, , pin] = await seed(page, [
    { rect: [100, 100, 100, 80] },
    { text: ["Note", 300, 120] },
    { pin: [600, 160, 1] },
    { rect: [900, 600, 100, 100] }, // outside the marquee
  ]);
  // A callout through the real UI: pin, leader, label, all inside the box.
  await createTool(page, "Pins");
  await page.getByRole("radio", { name: "Callout", exact: true }).click();
  const c = await screenPoint(page, 760, 300);
  await page.mouse.click(c.x, c.y);
  const input = page.getByRole("textbox", { name: "Callout label" });
  await input.fill("Crack");
  await input.press("Enter");
  await page.getByRole("radio", { name: "Pin", exact: true }).click();
  const l = await layer(page);
  const callout = findCallouts(l.shapes, l.texts);
  expect(callout).toHaveLength(1);
  await marquee(page, 60, 60, 880, 420);
  const text = l.texts.find((t) => t.text === "Note")!.id;
  expect(await picked(page)).toEqual(
    [`shape${rect}`, `shape${pin}`, `text${text}`,
      `shape${callout[0].pin}`, `shape${callout[0].leader}`, `text${callout[0].label}`].sort(),
  );
  await expect(bar(page)).toContainText("6 selected");
  await key(page, "Escape");
  await expect(bar(page)).toHaveCount(0);
});

test("Align left on four mixed objects: every left edge on the leftmost, one undo", async ({ page }) => {
  await open(page);
  const [r, x, p, r2] = await seed(page, [
    { rect: [150, 100, 100, 60] },
    { text: ["Label", 400, 250] },
    { pin: [700, 420, 1] },
    { rect: [500, 560, 160, 80] },
  ]);
  await marquee(page, 100, 60, 900, 700);
  await expect(bar(page)).toContainText("4 selected");
  await oneStep(page, () => barAction(page, "Align", "Align left"), (l) => {
    const lefts = [
      box(l.shapes.find((s) => s.id === r)!).x0,
      textBox(l.texts.find((t) => t.id === x)!).x0,
      box(l.shapes.find((s) => s.id === p)!).x0,
      box(l.shapes.find((s) => s.id === r2)!).x0,
    ];
    for (const v of lefts) expect(Math.abs(v - 150)).toBeLessThanOrEqual(1);
  });
});

test("Distribute horizontally on five: equal gaps, one undo", async ({ page }) => {
  await open(page);
  const ids = await seed(page, [
    { rect: [100, 300, 60, 60] },
    { rect: [200, 300, 120, 60] },
    { rect: [340, 300, 40, 60] },
    { rect: [600, 300, 80, 60] },
    { rect: [1000, 300, 100, 60] },
  ]);
  await marquee(page, 60, 260, 1140, 400);
  await expect(bar(page)).toContainText("5 selected");
  await oneStep(page, () => barAction(page, "Distribute", "Distribute horizontally"), (l) => {
    const boxes = ids.map((id) => box(l.shapes.find((s) => s.id === id)!)).sort((a, b) => a.x0 - b.x0);
    const gaps = boxes.slice(1).map((b, i) => b.x0 - boxes[i].x1);
    for (const g of gaps) expect(Math.abs(g - gaps[0])).toBeLessThanOrEqual(1);
  });
});

test("Delete three pins of five: the rest read 1, 2; one undo restores all five numbers", async ({ page }) => {
  await open(page);
  await seed(page, [1, 2, 3, 4, 5].map((n) => ({ pin: [100 + n * 150, 400, n] as [number, number, number] })));
  // Pins 2, 3 and 4 sit between x 380 and 720.
  await marquee(page, 360, 340, 740, 460);
  await expect(bar(page)).toContainText("3 selected");
  const numbers = (l: Layer) => l.shapes.filter((s) => s.kind === 5).map((s) => s.number).sort();
  await oneStep(page, () => barAction(page, null, "Delete"), (l) => {
    expect(numbers(l)).toEqual([1, 2]);
  });
  expect(numbers(await layer(page))).toEqual([1, 2, 3, 4, 5]);
});

test("two connected boxes picked: the connector moves with them; one picked: it reroutes", async ({ page }) => {
  await open(page);
  // A box, a box, and an arrow from the first's right port to the second's left.
  const [a, b, arrow] = await seed(page, [
    { rect: [100, 300, 160, 100] },
    { rect: [600, 300, 160, 100] },
    { arrow: [260, 350, 600, 350] },
  ]);
  await marquee(page, 60, 260, 800, 440);
  await expect(bar(page)).toContainText("3 selected");
  await oneStep(page, () => drag(page, { x: 680, y: 300 }, 0, 120), (l) => {
    const s = l.shapes.find((x) => x.id === arrow)!;
    expect([s.x0, s.y0, s.x1, s.y1].map(Math.round)).toEqual([260, 470, 600, 470]);
  });
  // Now only the first box: its end of the connector follows, the other stays.
  await key(page, "Escape");
  await createTool(page, "Shapes");
  const p = await screenPoint(page, 100, 350);
  await page.keyboard.down("Shift");
  await page.mouse.click(p.x, p.y);
  await page.keyboard.up("Shift");
  await expect(bar(page)).toContainText("1 selected");
  await oneStep(page, () => drag(page, { x: 100, y: 330 }, 0, -150), (l) => {
    const s = l.shapes.find((x) => x.id === arrow)!;
    expect([s.x0, s.y0].map(Math.round)).toEqual([260, 200]);
    expect([s.x1, s.y1].map(Math.round)).toEqual([600, 350]);
    expect(box(l.shapes.find((x) => x.id === b)!).y0).toBe(300);
    expect(box(l.shapes.find((x) => x.id === a)!).y0).toBe(150);
  });
});

test("Ctrl+A picks the layer's annotations, arrows nudge them, Esc lets go", async ({ page }) => {
  await open(page);
  const ids = await seed(page, [{ rect: [100, 100, 80, 80] }, { text: ["Hi", 400, 100] }, { pin: [700, 140, 1] }]);
  await createTool(page, "Select objects");
  await key(page, "Control+a");
  await expect(bar(page)).toContainText("3 selected");
  const before = await layer(page);
  await key(page, "ArrowRight");
  await key(page, "Shift+ArrowDown");
  const after = await layer(page);
  const r0 = before.shapes.find((s) => s.id === ids[0])!;
  const r1 = after.shapes.find((s) => s.id === ids[0])!;
  expect([r1.x0 - r0.x0, r1.y0 - r0.y0]).toEqual([1, 10]);
  await key(page, "Escape");
  await expect(bar(page)).toHaveCount(0);
});
