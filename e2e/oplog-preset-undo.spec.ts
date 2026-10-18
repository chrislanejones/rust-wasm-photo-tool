import { test, expect } from "./guard/test";
import type { Page } from "@playwright/test";
import { join } from "node:path";

// ─────────────────────────────────────────────────────────────────────────────
// Enhance › Presets is RECORDED in the op log (op-log v13, issue #37, ADR-090).
//
// Before v13 a preset snapped and wrote pixels with no op, so the first Ctrl+Z
// found a log that disagreed with the engine, marked it broken ("broken —
// snapshot undo has taken over") and fell back to whole-image snapshots for the
// rest of the session (ADR-052, ADR-055). Undo still LOOKED right, which is why
// the observation has to come from the engine, not the canvas.
//
// The path is the real one a user clicks:
//   PresetsSettings `onClick={() => void commit(p)}` → `presets.apply(stackOf(p))`
//   (useTransforms) → `t.preset_apply(...)` → `Op::TonalStack` via `oplog_record`.
// Shipped defaults throughout: no flag is set.
//
// What "on the op-log path" means, read off the engine (`window.__ihTool`):
//   • `oplog_is_broken()` false after the undo and the redo;
//   • `oplog_cursor()` moves 1 → 0 → 1 with `oplog_op_count()` still 1;
//   • `composite_hash_hex()` is back to the exact pre-preset value.
// ─────────────────────────────────────────────────────────────────────────────

const FIXTURE = join(__dirname, "fixtures", "checker.png"); // 256×256
const VIVID = /^Apply Vivid —/;
const FADE = /^Apply Fade —/;

interface Probe {
  broken: boolean;
  status: string;
  cursor: number;
  ops: number;
  undo: number;
  hash: string;
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

async function waitForCanvas(page: Page): Promise<void> {
  await page.locator("canvas.main-canvas").waitFor({ state: "visible", timeout: 30_000 });
  await expect
    .poll(
      () => page.evaluate(() => document.querySelector<HTMLCanvasElement>("canvas.main-canvas")?.width ?? 0),
      { timeout: 30_000 },
    )
    .toBeGreaterThan(0);
}

/** The engine through the React fiber tree, parked on `window.__ihTool`
 *  (same technique as oplog-undo-through-ui.spec.ts). Re-run after a reload. */
async function exposeEngine(page: Page): Promise<void> {
  const found = () => page.evaluate(() => {
    const root = document.querySelector("#root") as unknown as Record<string, unknown>;
    const key = Object.keys(root).find((k) => k.startsWith("__reactContainer"))!;
    type Fiber = { child?: Fiber; sibling?: Fiber; memoizedState?: unknown };
    const isTool = (v: unknown) =>
      !!v && typeof (v as { add_layer_mask_from?: unknown }).add_layer_mask_from === "function";
    let tool: unknown = null;
    const walk = (f: Fiber | undefined, d: number) => {
      if (!f || tool || d > 600) return;
      let s = f.memoizedState as { memoizedState?: unknown; next?: unknown } | null;
      while (s && !tool) {
        const v = s.memoizedState as { current?: unknown } | undefined;
        if (isTool(v)) tool = v;
        else if (v && isTool(v.current)) tool = v.current;
        s = s.next as typeof s;
      }
      walk(f.child, d + 1);
      walk(f.sibling, d + 1);
    };
    walk(root[key] as Fiber, 0);
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
      undo_count: () => Promise<number>;
      composite_hash_hex: () => Promise<string>;
    };
    const t = (window as unknown as { __ihTool: T }).__ihTool;
    return {
      broken: await t.oplog_is_broken(),
      status: await t.oplog_status(),
      cursor: await t.oplog_cursor(),
      ops: await t.oplog_op_count(),
      undo: await t.undo_count(),
      hash: await t.composite_hash_hex(),
    };
  });
}

/** The recorded frame, decoded by hand: `[u32 len][version][variant][5 × f64 LE]`. */
async function recordedFrame(page: Page): Promise<{ version: number; variant: number; values: number[] }> {
  return page.evaluate(async () => {
    type T = { oplog_encoded_ops: (from: number, to: number) => Promise<Uint8Array> };
    const t = (window as unknown as { __ihTool: T }).__ihTool;
    const b = await t.oplog_encoded_ops(0, 1);
    const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
    const values = [0, 1, 2, 3, 4].map((i) => dv.getFloat64(6 + i * 8, true));
    return { version: b[4], variant: b[5], values };
  });
}

/** Keys the way a user presses them; a focused control can swallow shortcuts. */
async function key(page: Page, combo: string): Promise<void> {
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press(combo);
}

async function settled(page: Page, undo: number): Promise<Probe> {
  await expect.poll(async () => (await probe(page)).undo, { timeout: 15_000 }).toBe(undo);
  return probe(page);
}

async function openPresets(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Enhance", exact: true }).first().click();
  await page.getByRole("button", { name: "Presets", exact: true }).first().click();
}

test.beforeEach(async ({ page }) => {
  await blockExternalNetwork(page);
  await page.goto("/");
  const input = page.locator('input[type="file"]').first();
  await input.waitFor({ state: "attached" });
  await input.setInputFiles(FIXTURE);
  await waitForCanvas(page);
  await exposeEngine(page);
  await openPresets(page);
});

test("a preset clicked in the panel is one recorded op, and undo/redo stay on the op log", async ({ page }) => {
  const before = await settled(page, 0);

  // Hover another preset first, the way a user browses: the preview slot
  // records nothing and must not disturb the log.
  await page.getByRole("button", { name: FADE }).first().hover();
  await page.getByRole("button", { name: VIVID }).first().hover();
  await page.getByRole("button", { name: VIVID }).first().click();

  const applied = await settled(page, 1);
  expect(applied.hash, "the preset changed the photo").not.toBe(before.hash);
  expect(applied.broken, "recording leaves the log healthy").toBe(false);
  expect(applied.status).toBe("recording");
  expect(applied.ops, "hover recorded nothing; the click recorded one").toBe(1);
  expect(applied.cursor).toBe(1);

  // The UI's values reach the op untouched, in the ADR-055 units
  // (PresetsSettings: Vivid = brightness 0, contrast 1.5, saturation 1.35,
  // shadows 0, highlights 10 — absolute 8-bit levels, not a fraction).
  const frame = await recordedFrame(page);
  expect(frame.version, "written as op-log v14; preset payload unchanged").toBe(14);
  expect(frame.variant, "Op::TonalStack is index 23").toBe(23);
  expect(frame.values, "brightness, contrast, highlights, shadows, saturation").toEqual([0, 1.5, 10, 0, 1.35]);

  await key(page, "Control+z");
  const undone = await settled(page, 0);
  expect(undone.broken, "oplog_is_broken() after Ctrl+Z").toBe(false);
  expect(undone.status).toBe("recording");
  expect(undone.cursor, "the undo seeked the log").toBe(0);
  expect(undone.ops, "the op stays as the redo tail").toBe(1);
  expect(undone.hash, "undo is byte-exact").toBe(before.hash);

  // Redo is Ctrl+Shift+Z in this app (useKeyboardShortcuts.ts); there is no Ctrl+Y.
  await key(page, "Control+Shift+z");
  const redone = await settled(page, 1);
  expect(redone.broken, "oplog_is_broken() after Ctrl+Shift+Z").toBe(false);
  expect(redone.cursor).toBe(1);
  expect(redone.hash, "redo is byte-exact").toBe(applied.hash);
});

test("after a reload, the preset is still there and still one undo away on the op log", async ({ page }) => {
  const before = await settled(page, 0);
  await page.getByRole("button", { name: VIVID }).first().click();
  const applied = await settled(page, 1);
  expect(applied.broken).toBe(false);

  // Past the op-log persistence debounce (2 s) and the working-copy autosave.
  await page.waitForTimeout(6_000);
  await page.reload();
  await page.getByRole("button", { name: /Resume editing/i }).click({ timeout: 30_000 });
  await waitForCanvas(page);
  await exposeEngine(page);

  const resumed = await settled(page, 1);
  expect(resumed.hash, "the resumed document wears the preset, byte-exact").toBe(applied.hash);
  expect(resumed.broken).toBe(false);
  expect(resumed.ops, "the log came back with its one op").toBe(1);

  await key(page, "Control+z");
  const undone = await settled(page, 0);
  expect(undone.broken, "post-reload undo stayed on the op-log path").toBe(false);
  expect(undone.cursor).toBe(0);
  expect(undone.hash, "post-reload undo is byte-exact").toBe(before.hash);
});
