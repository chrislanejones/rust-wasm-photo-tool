import { test, expect } from "./guard/test";
import type { Page } from "@playwright/test";
import { join } from "node:path";
import { installAnnotationProbe, screenPoint } from "./annotation-benchmark-harness";
import { findCallouts, leaderFor, type CalloutShape, type CalloutText } from "../app/src/lib/callouts";

// ─────────────────────────────────────────────────────────────────────────────
// Smart Callout leaders (Night 10-23).
//
// §4 — a callout's label moved by Align ▾
// (one object, and inside a multi-select group), by Placement, or by an
// arrow-key nudge keeps its leader joined to pin and label, and ONE Ctrl+Z
// puts all of it back — before a reload and after one, when only the op log's
// gesture markers say where the step began. Until now only a Text tool drag
// was tested (e2e/smart-callout.spec.ts).
//
// §5 — the leader can be a plain line: the Pins panel's Leader: Line · Arrow
// toggle (Line by default) picks the kind a NEW callout's leader gets; an
// arrow callout keeps its head. Placing either is one undo, and a reload
// keeps it, still joined and still following.
//
// "Joined" is the app's own rule (lib/callouts `findCallouts`) AND the leader
// sitting exactly where `leaderFor` would draw it now — the edge of the label
// nearest the pin, so a label moved past the pin swaps edges.
// ─────────────────────────────────────────────────────────────────────────────

const FIXTURE_PNG = join(__dirname, "fixtures", "paper-1200x900.png");
const PIN_AT = { x: 300, y: 450 };

type Shape = CalloutShape & { arrow_style: number };
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
  await expect.poll(async () => findCallouts((await layer(page)).shapes, (await layer(page)).texts).length).toBe(1);
  await page.getByRole("radio", { name: "Pin", exact: true }).click();
}

/** The one callout, or a reason it is not joined. */
function joined(l: Layer) {
  const found = findCallouts(l.shapes, l.texts);
  if (found.length !== 1) return `expected one callout, found ${found.length}`;
  const pin = l.shapes.find((s) => s.id === found[0].pin)!;
  const label = l.texts.find((t) => t.id === found[0].label)!;
  const leader = l.shapes.find((s) => s.id === found[0].leader)!;
  const want = leaderFor(pin, label);
  const off = Math.max(
    Math.abs(leader.x0 - want.x0), Math.abs(leader.y0 - want.y0),
    Math.abs(leader.x1 - want.x1), Math.abs(leader.y1 - want.y1),
  );
  return off <= 0.75 ? { pin, label, leader } : `leader is ${off.toFixed(1)} px off where it should be`;
}

const labelOf = (l: Layer) => {
  const j = joined(l);
  if (typeof j === "string") throw new Error(j);
  return j.label;
};

/** Wait out the autosave, reload, resume — the op log is all undo has left. */
async function reloadAndResume(page: Page) {
  await page.waitForTimeout(6000);
  await page.reload();
  await page.getByRole("button", { name: /Resume editing/i }).click();
  await expect.poll(() => page.locator("canvas.main-canvas").getAttribute("width")).toBe("1200");
  // The app drops an undo press until the resumed photo stops loading.
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
  await installAnnotationProbe(page);
}

/** `act` moves the label (`moved` says how we know), the leader follows, and
 *  it is all ONE undo step, before a reload and after one. */
async function followsInOneStep(
  page: Page,
  act: () => Promise<void>,
  moved: (before: Text, now: Text) => boolean,
) {
  const before = await layer(page);
  const was = labelOf(before);
  await act();
  await expect.poll(async () => {
    const l = await layer(page);
    const label = l.texts.find((t) => t.id === was.id);
    if (!label || !moved(was, label)) return "the label has not moved";
    const j = joined(l);
    return typeof j === "string" ? j : "joined";
  }).toBe("joined");
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

const bar = (page: Page) => page.getByTestId("multi-select-bar");

/** Pick the callout by clicking its label with Select objects. */
async function pickLabel(page: Page) {
  const t = labelOf(await layer(page));
  await createTool(page, "Select objects");
  const p = await screenPoint(page, t.x + t.tile_offset_x + t.tile_w / 2, t.y + t.tile_offset_y + t.tile_h / 2);
  await page.mouse.click(p.x, p.y);
  await expect(bar(page)).toContainText("3 selected");
}

async function alignMenu(page: Page, item: string) {
  await bar(page).getByRole("button", { name: "Align", exact: true }).click();
  await page.getByRole("menuitem", { name: item, exact: true }).click();
}

test.describe("§4 a callout's label moved without the Text tool drags its leader along", () => {
  test("Align ▾ on the callout alone (to the canvas)", async ({ page }) => {
    await open(page);
    await placeCallout(page, "Crack");
    await pickLabel(page);
    await followsInOneStep(page, () => alignMenu(page, "Align bottom"), (was, now) => now.y > was.y + 100);
  });

  test("Align ▾ in a multi-select group", async ({ page }) => {
    await open(page);
    await placeCallout(page, "Crack");
    // A box below and left of the callout: Align left drags the callout's
    // box to the box's left edge. Kept high enough that the Align menu, which
    // opens under the selection, stays on screen.
    await page.evaluate(async () => {
      const t = window.__annotationTool;
      await t.add_shape_annotation(0, 60, 520, 200, 600, "#e02020", 4, 0, 0, "#000000", "#000000", 0, 0, 0, 0, 0, new Uint16Array(4));
      await t.recomposite();
    });
    await pickLabel(page);
    const r = await screenPoint(page, 60, 560);
    await page.keyboard.down("Shift");
    await page.mouse.click(r.x, r.y);
    await page.keyboard.up("Shift");
    await expect(bar(page)).toContainText("4 selected");
    await followsInOneStep(page, () => alignMenu(page, "Align left"), (was, now) => now.x < was.x - 100);
  });

  test("Placement (the Text tool's grid)", async ({ page }) => {
    await open(page);
    await placeCallout(page, "Crack");
    const t = labelOf(await layer(page));
    await createTool(page, "Text");
    const at = await screenPoint(page, t.x + 10, t.y + 8);
    await page.mouse.click(at.x, at.y);
    await expect(page.locator("textarea").first()).toHaveValue("Crack");
    const panel = page.getByRole("region", { name: "Tool options" });
    await panel.getByRole("button", { name: "Placement", exact: true }).click();
    // The undo after the reload is asserted too since Night 10-24: undoing a
    // Placement with the editor still open used to break the op log, and the
    // snapshot steps a reload brings back then dropped the pin and leader
    // (e2e/text-placement-undo.spec.ts).
    await followsInOneStep(page, async () => {
      await panel.getByRole("radio", { name: "Bottom right", exact: true }).or(
        panel.getByRole("button", { name: "Bottom right", exact: true })).click();
      // Escape with focus outside the editor: the text stays open.
      await key(page, "Escape");
    }, (was, now) => now.x > was.x + 300 && now.y > was.y + 200);
  });

  test("an arrow-key nudge", async ({ page }) => {
    await open(page);
    await placeCallout(page, "Crack");
    await pickLabel(page);
    await followsInOneStep(page, () => key(page, "Shift+ArrowDown"), (was, now) => now.y === was.y + 10);
  });
});

/** Is there leader ink `off` px to the side of the leader, `back` px behind
 *  its pin end? An arrowhead (20 px long, ~12 px half-width at its base) puts
 *  ink there; a 3 px line does not. Read from the engine's own composite. */
async function inkBesideTip(page: Page, back: number, off: number) {
  const l = await layer(page);
  const j = joined(l);
  if (typeof j === "string") throw new Error(j);
  const { x0, y0, x1, y1 } = j.leader;
  const len = Math.hypot(x1 - x0, y1 - y0);
  const [ux, uy] = [(x1 - x0) / len, (y1 - y0) / len];
  const pts = [1, -1].map((side) => ({
    x: Math.round(x1 - ux * back - uy * off * side),
    y: Math.round(y1 - uy * back + ux * off * side),
  }));
  return page.evaluate(async (pts) => {
    const t = window.__annotationTool;
    const w = await t.width();
    const px = await t.get_image_data();
    // The leader is the pin's red: well redder than the paper.
    return pts.map(({ x, y }) => {
      const i = (y * w + x) * 4;
      return px[i] - px[i + 1] > 60;
    });
  }, pts);
}

/** Drag the pin's edit box body by (dx, dy) canvas px, then Apply. */
async function dragPin(page: Page, from: { x: number; y: number }, dx: number, dy: number) {
  const a = await screenPoint(page, from.x, from.y);
  await page.mouse.click(a.x, a.y);
  await expect(page.locator("svg[data-draw-overlay]")).toBeVisible();
  const b = await screenPoint(page, from.x + dx, from.y + dy);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 8 });
  await page.mouse.up();
  await key(page, "Enter");
  await expect(page.locator("svg[data-draw-overlay]")).toHaveCount(0);
}

const leaderToggle = (page: Page) =>
  page.getByRole("region", { name: "Tool options" }).getByRole("radiogroup", { name: "Leader" });

test.describe("§5 the leader can be a plain line", () => {
  test("Leader shows only with Drop: Callout, and Line is the default", async ({ page }) => {
    await open(page);
    await createTool(page, "Pins");
    await expect(leaderToggle(page)).toHaveCount(0);
    await page.getByRole("radio", { name: "Callout", exact: true }).click();
    await expect(leaderToggle(page).getByRole("radio", { name: "Line", exact: true })).toBeChecked();
    await expect(leaderToggle(page).getByRole("radio", { name: "Arrow", exact: true })).not.toBeChecked();
  });

  test("a new callout's leader is a plain line: no head; one undo; a reload keeps it, and it still follows", async ({ page }) => {
    await open(page);
    const steps = await page.evaluate(async () => await window.__annotationTool.undo_count());
    await placeCallout(page, "Crack");
    expect(await page.evaluate(async () => await window.__annotationTool.undo_count())).toBe(steps + 1);
    const placed = joined(await layer(page));
    if (typeof placed === "string") throw new Error(placed);
    expect(placed.leader.kind).toBe(2);
    expect(await inkBesideTip(page, 10, 6)).toEqual([false, false]);

    // One Ctrl+Z takes all three; one redo brings them back.
    await key(page, "Control+z");
    await expect.poll(() => layer(page).then((l) => [l.shapes.length, l.texts.length])).toEqual([0, 0]);
    await key(page, "Control+Shift+z");
    await expect.poll(() => layer(page).then((l) => typeof joined(l) === "string" ? "unjoined" : "joined")).toBe("joined");

    // A line leader follows its pin, in the pin drag's own step.
    const before = await layer(page);
    await dragPin(page, PIN_AT, 0, 150);
    await expect.poll(async () => {
      const j = joined(await layer(page));
      return typeof j === "string" ? j : [Math.round((j.pin.y0 + j.pin.y1) / 2), j.leader.kind];
    }).toEqual([PIN_AT.y + 150, 2]);
    const after = await layer(page);
    await key(page, "Control+z");
    await expect.poll(() => layer(page)).toEqual(before);
    await key(page, "Control+Shift+z");
    await expect.poll(() => layer(page)).toEqual(after);

    // Reload: still a line, still joined, the drag still one undo.
    await reloadAndResume(page);
    await expect.poll(() => layer(page)).toEqual(after);
    await key(page, "Control+z");
    await expect.poll(() => layer(page)).toEqual(before);
  });

  test("Leader: Arrow gives the leader a head, and it keeps it when the toggle goes back to Line", async ({ page }) => {
    await open(page);
    await createTool(page, "Pins");
    await page.getByRole("radio", { name: "Callout", exact: true }).click();
    await leaderToggle(page).getByRole("radio", { name: "Arrow", exact: true }).click();
    await placeCallout(page, "Crack");
    const placed = joined(await layer(page));
    if (typeof placed === "string") throw new Error(placed);
    expect([placed.leader.kind, placed.leader.arrow_style]).toEqual([4, 0]);
    expect(await inkBesideTip(page, 10, 6)).toEqual([true, true]);
    // One Ctrl+Z takes all three.
    await key(page, "Control+z");
    await expect.poll(() => layer(page).then((l) => [l.shapes.length, l.texts.length])).toEqual([0, 0]);
    await key(page, "Control+Shift+z");
    await expect.poll(() => layer(page).then((l) => typeof joined(l) === "string" ? "unjoined" : "joined")).toBe("joined");

    // The toggle picks the NEXT callout's leader; this one keeps its arrow,
    // through a follow and a reload.
    await page.getByRole("radio", { name: "Callout", exact: true }).click();
    await leaderToggle(page).getByRole("radio", { name: "Line", exact: true }).click();
    await page.getByRole("radio", { name: "Pin", exact: true }).click();
    await dragPin(page, PIN_AT, 0, 150);
    await expect.poll(async () => {
      const j = joined(await layer(page));
      return typeof j === "string" ? j : [Math.round((j.pin.y0 + j.pin.y1) / 2), j.leader.kind];
    }).toEqual([PIN_AT.y + 150, 4]);
    const after = await layer(page);
    await reloadAndResume(page);
    await expect.poll(() => layer(page)).toEqual(after);
    expect(await inkBesideTip(page, 10, 6)).toEqual([true, true]);
  });
});
