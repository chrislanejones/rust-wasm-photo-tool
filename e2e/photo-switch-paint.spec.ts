import { test, expect } from "./guard/test";
import type { Page } from "@playwright/test";
import { join } from "node:path";

// Plan A §3, last row: "Paint during a switch → nothing is painted."
//
// The other four rows of that table were already proved by
// photo-switch-state.spec.ts (§0.1–§0.4) when v9.5 shipped. This is the one
// that was not.
//
// ⚠️ THE WHOLE DIFFICULTY IS NOT PROVING A NEGATIVE BY ACCIDENT. "No pixels
// changed" passes for a brush that cannot paint at all, for a stroke that
// missed the canvas, and for a stroke that happened to land after the switch
// had already finished. So there are two guards:
//
//   P0 is a CONTROL: the same gesture, with no switch in flight, must change
//      pixels. If the brush or the stroke helper ever breaks, P0 goes red and
//      P1's silence stops being evidence.
//   P1 asserts the stroke actually OVERLAPPED the switch — aria-busy was true
//      when the stroke began and still true when it ended. A stroke that
//      slipped in after the switch completed fails the test rather than
//      passing it.

const FIXTURES = [
  join(__dirname, "fixtures", "checker.png"),
  join(__dirname, "fixtures", "sky-building.png"),
];

type Print = { w: number; h: number; rgb: [number, number, number] };

async function blockExternalNetwork(page: Page): Promise<void> {
  await page.route("**/*", (route) => {
    const url = route.request().url();
    if (/^https?:\/\/(localhost|127\.0\.0\.1)[:/]/.test(url) || url.startsWith("blob:") || url.startsWith("data:")) {
      return route.continue();
    }
    return route.abort();
  });
}

/** Size + mean colour of the main canvas — same fingerprint the §0 specs use. */
const print = (page: Page): Promise<Print | null> =>
  page.evaluate(() => {
    const c = document.querySelector<HTMLCanvasElement>("canvas.main-canvas");
    if (!c || c.width === 0) return null;
    const o = document.createElement("canvas");
    o.width = 16;
    o.height = 16;
    const ctx = o.getContext("2d")!;
    ctx.drawImage(c, 0, 0, 16, 16);
    const d = ctx.getImageData(0, 0, 16, 16).data;
    const s = [0, 0, 0];
    for (let i = 0; i < d.length; i += 4) {
      s[0] += d[i]!;
      s[1] += d[i + 1]!;
      s[2] += d[i + 2]!;
    }
    const n = d.length / 4;
    return { w: c.width, h: c.height, rgb: [s[0] / n, s[1] / n, s[2] / n] as [number, number, number] };
  });

/**
 * The 16×16 downsample as a flat RGB array — a PER-CELL fingerprint.
 *
 * ⚠️ THE MEAN IS NOT SENSITIVE ENOUGH FOR A STROKE, measured: a real brush
 * stroke across photo B (1220×820) moves the mean of its 16×16 downsample by
 * **0.66** per channel, and the §0 specs' `same()` tolerance is 2. So a
 * mean-based "B is untouched" assertion passes whether or not B took the
 * stroke — it is vacuous for a localized edit. (It is fine for the §0 tests,
 * whose edit is Brightness +40 applied to every pixel.)
 *
 * A stroke is local, so it shows up as a large delta in the few cells it
 * crosses. Compare cells, not the average.
 */
const grid = (page: Page): Promise<number[] | null> =>
  page.evaluate(() => {
    const c = document.querySelector<HTMLCanvasElement>("canvas.main-canvas");
    if (!c || c.width === 0) return null;
    const o = document.createElement("canvas");
    o.width = 16;
    o.height = 16;
    const ctx = o.getContext("2d")!;
    ctx.drawImage(c, 0, 0, 16, 16);
    const d = ctx.getImageData(0, 0, 16, 16).data;
    const out: number[] = [];
    for (let i = 0; i < d.length; i += 4) {
      out.push(d[i]!, d[i + 1]!, d[i + 2]!);
    }
    return out;
  });

/** Largest single-channel difference between two cell grids. */
const maxCellDelta = (a: number[] | null, b: number[] | null): number => {
  if (!a || !b || a.length !== b.length) return Number.POSITIVE_INFINITY;
  let m = 0;
  for (let i = 0; i < a.length; i++) m = Math.max(m, Math.abs(a[i]! - b[i]!));
  return m;
};

const same = (a: Print | null, b: Print | null, tol = 2) =>
  !!a && !!b && a.w === b.w && a.h === b.h && a.rgb.every((v, i) => Math.abs(v - b.rgb[i]!) <= tol);

const fmt = (p: Print | null) => (p ? `${p.w}x${p.h} rgb(${p.rgb.map((v) => v.toFixed(1)).join(",")})` : "none");

/** Wait until the canvas stops changing: three equal reads 300 ms apart. */
async function settled(page: Page): Promise<Print | null> {
  let last: Print | null = null;
  let stable = 0;
  for (let i = 0; i < 60 && stable < 3; i++) {
    await page.waitForTimeout(300);
    const p = await print(page);
    stable = same(p, last, 0.01) ? stable + 1 : 0;
    last = p;
  }
  return last;
}

async function key(page: Page, k: "PageDown" | "PageUp") {
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press(k);
}

async function open(page: Page, group: string, tool: string) {
  await page.getByRole("button", { name: group, exact: true }).first().click();
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: tool, exact: true }).first().click();
  await page.waitForTimeout(500);
}

/**
 * A real-mouse brush stroke, deliberately kept to THREE round trips.
 *
 * ⚠️ Two cheaper-looking approaches were tried and rejected, both caught by P0
 * rather than by reasoning:
 *
 *  - A ten-move `page.mouse` stroke is ten CDP round trips, and at 40×
 *    throttling the switch finished before the stroke ended. P1's overlap
 *    assertion failed, which is the guard working.
 *  - Dispatching the whole PointerEvent sequence inside one `page.evaluate`
 *    is one round trip, and PAINTS NOTHING — P0 went red and P1 went green,
 *    i.e. precisely the vacuous pass the control exists to expose. Untrusted
 *    pointer events do not drive the brush.
 *
 * So: a real mouse, pre-positioned before the clock starts, with the fewest
 * events that still make a visible mark.
 */
async function preposition(page: Page): Promise<{ to: [number, number] }> {
  const box = (await page.locator("canvas.main-canvas").boundingBox())!;
  const px = (f: number) => box.x + box.width * f;
  const py = (f: number) => box.y + box.height * f;
  await page.mouse.move(px(0.3), py(0.35));
  return { to: [px(0.72), py(0.62)] };
}

async function stroke(page: Page, to: [number, number]): Promise<void> {
  await page.mouse.down();
  await page.mouse.move(to[0], to[1], { steps: 6 });
  await page.mouse.up();
}

/** The canvas's own dimensions — the only in-flight signal that does not
 *  depend on which panel is open.
 *
 *  `.per-photo-region[aria-busy]` was the obvious choice and is wrong here:
 *  that element exists only while a per-PHOTO panel is open, and this test
 *  needs Brush, which is a per-TOOL panel with no region at all (see C2 in
 *  photo-switch-cue.spec.ts). Polling for it waited the full 60 s.
 *
 *  The two fixtures differ in size, so "the canvas still measures A" is
 *  exactly "B's pixels are not in yet" — and that window is precisely where a
 *  stray stroke could land on the wrong photo. */
const canvasSize = (page: Page): Promise<string> =>
  page.evaluate(() => {
    const c = document.querySelector<HTMLCanvasElement>("canvas.main-canvas");
    return c ? `${c.width}x${c.height}` : "none";
  });

async function setup(page: Page) {
  await blockExternalNetwork(page);
  await page.goto("/");
  const input = page.locator('input[type="file"]').first();
  await input.waitFor({ state: "attached" });
  await input.setInputFiles(FIXTURES);
  await page.locator("canvas.main-canvas").waitFor({ state: "visible", timeout: 30_000 });
  const a0 = await settled(page);
  await key(page, "PageDown");
  const b0 = await settled(page);
  await key(page, "PageUp");
  const back = await settled(page);
  expect(a0 && b0 && (a0.w !== b0.w || a0.h !== b0.h), "the two fixtures are told apart by size").toBeTruthy();
  expect(same(back, a0), "a plain round trip returns to A untouched").toBe(true);
  // Per-cell baselines too — the mean alone cannot see a stroke (see `grid`).
  const gA0 = await grid(page);
  await key(page, "PageDown");
  await settled(page);
  const gB0 = await grid(page);
  await key(page, "PageUp");
  await settled(page);
  return { a0: a0!, b0: b0!, gA0: gA0!, gB0: gB0! };
}

test.describe.configure({ mode: "parallel" });
test.setTimeout(180_000);

test("P0 CONTROL: the same brush stroke, with no switch in flight, does change pixels", async ({ page }) => {
  const { a0 } = await setup(page);
  await open(page, "Create", "Brush");
  const { to } = await preposition(page);
  await stroke(page, to);
  const painted = await settled(page);
  console.log(`control: before ${fmt(a0)} after ${fmt(painted)}`);
  expect(
    same(painted, a0),
    "the brush must be able to paint, or P1's 'nothing was painted' proves nothing",
  ).toBe(false);
});

test("P1 a stroke in flight across a switch never lands on the next photo", async ({ page }) => {
  const { a0, b0, gA0, gB0 } = await setup(page);
  await open(page, "Create", "Brush");

  // ⚠️ WHY THE STROKE STARTS BEFORE THE SWITCH, not inside it.
  //
  // The plan's row reads "paint during a switch → nothing is painted", and the
  // literal reading — begin a stroke while a switch is in flight — could not be
  // exercised: the switch between these two fixtures completes faster than
  // `mouse.down` + one move + `mouse.up`, measured at 40× AND 100× CPU
  // throttling (B's dimensions were already on the canvas by the end of the
  // stroke both times). There is no window to start a stroke in, which is
  // itself a good result and is why this is not written as a flaky poll.
  //
  // So the overlap is made structural instead: the stroke is already down and
  // moving when PageDown fires, and keeps moving afterwards. That is a real
  // gesture spanning a real switch, and it is deterministic.
  //
  // What it proves is the half that matters and the half §0.3 proves for a
  // slider: the paint lands on A or is dropped, NEVER on B.
  const box = (await page.locator("canvas.main-canvas").boundingBox())!;
  const px = (f: number) => box.x + box.width * f;
  const py = (f: number) => box.y + box.height * f;

  await page.mouse.move(px(0.3), py(0.35));
  await page.mouse.down();
  await page.mouse.move(px(0.42), py(0.43), { steps: 4 });

  const sizeMidStroke = await canvasSize(page);
  await key(page, "PageDown");

  // The rest of the gesture happens with a switch in flight.
  await page.mouse.move(px(0.58), py(0.52), { steps: 4 });
  await page.mouse.move(px(0.72), py(0.62), { steps: 4 });
  await page.mouse.up();

  expect(sizeMidStroke, "the stroke was on A when the switch was asked for").toBe(`${a0.w}x${a0.h}`);

  const onB = await settled(page);
  const dB = maxCellDelta(await grid(page), gB0);
  console.log(`stroke-across-switch: B ${fmt(onB)} maxCellDelta=${dB}`);
  expect(onB?.w, "the switch completed — we are looking at B").toBe(b0.w);
  // Threshold from measurement, not taste: two reads of an untouched canvas
  // differ by 0, and a real stroke on B differs by 126. 2 leaves a 60× margin
  // and still fails loudly if any paint reached B.
  expect(dB, "B took no paint from a stroke in flight across the switch").toBeLessThanOrEqual(2);

  await key(page, "PageUp");
  const onA = await settled(page);
  const dA = maxCellDelta(await grid(page), gA0);
  console.log(`stroke-across-switch: A ${fmt(onA)} maxCellDelta=${dA}`);
  expect(onA?.w, "back on A").toBe(a0.w);
  // Either outcome is correct per the plan's sibling row — "lands on A or is
  // cancelled, never on B". What would be wrong is A carrying B's pixels, or
  // B carrying the stroke, and both are pinned above.
  console.log(`stroke-across-switch: A kept the paint = ${dA > 2}`);
});
