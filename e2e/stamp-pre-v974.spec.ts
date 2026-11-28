import { test, expect } from "./guard/test";
import type { Page } from "@playwright/test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { installAnnotationProbe } from "./annotation-benchmark-harness";
import { fillPaperHash, restoreIdb, type DumpedDb } from "./fixtures/pre-v974/idb-dump";
import { PLACEHOLDER_CONVEX_URL } from "./guard/backend";

// ─────────────────────────────────────────────────────────────────────────────
// QC 11-26's one "Not covered" line: a project saved BEFORE v9.74, with a
// stamp in it, opened in today's build.
//
// Until v9.73 a stamp was burned into the pixels (`commit_red_stamp`); v9.74
// made stamps texts (ADR-109) and retired that call. Nothing changed the saved
// edit's format, so an old project should open as it was: the stamp in the
// pixels, one undo step that takes it off, nothing in the console.
//
// The fixture is a real v9.73 save: its three IndexedDB databases, dumped by
// fixtures/pre-v974/make-fixtures.mjs from a v9.73 build (see that file).
// ─────────────────────────────────────────────────────────────────────────────

const FIXTURE = JSON.parse(
  fillPaperHash(
    readFileSync(join(__dirname, "fixtures/pre-v974/v973-stamp.json"), "utf8"),
    createHash("sha256").update(readFileSync(join(__dirname, "fixtures/paper-1200x900.png"))).digest("hex"),
  ),
) as {
  madeBy: string;
  dbs: DumpedDb[];
};

/** The saved edit record in the fixture. */
function savedEdit() {
  const edits = FIXTURE.dbs.find((d) => d.name === "image-horse-edits")!.stores.find((s) => s.name === "edits")!;
  return edits.rows[0]!.value as {
    canvasW: number;
    canvasH: number;
    canvasPng: { $u8: string };
    undoStack: { label: string; png: { $u8: string } }[];
  };
}

/** How many bytes of the engine's composite differ from a PNG's pixels. */
const diffFromPng = (page: Page, pngB64: string) =>
  page.evaluate(async (b64) => {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const bmp = await createImageBitmap(new Blob([bytes], { type: "image/png" }), {
      colorSpaceConversion: "none",
      premultiplyAlpha: "none",
    });
    const c = new OffscreenCanvas(bmp.width, bmp.height);
    const ctx = c.getContext("2d")!;
    ctx.drawImage(bmp, 0, 0);
    const want = ctx.getImageData(0, 0, bmp.width, bmp.height).data;
    const got = (await window.__annotationTool.get_image_data()) as Uint8Array;
    if (got.length !== want.length) return Number.POSITIVE_INFINITY;
    let n = 0;
    for (let i = 0; i < got.length; i++) if (got[i] !== want[i]) n++;
    return n;
  }, pngB64);

test(`a project with a stamp saved by ${FIXTURE.madeBy} opens: pixels, undo, no console error`, async ({ page }) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  // Two lines are the test's own setup, not the app: a request this spec
  // blocks on purpose, and the Convex client dialing the build's PLACEHOLDER
  // deployment over a WebSocket (page.route does not see WebSockets; the same
  // reconnect pair-send.spec.ts already allows). Anything else counts.
  const placeholderSocket = `WebSocket connection to 'wss://${new URL(PLACEHOLDER_CONVEX_URL).host}/`;
  page.on("console", (m) => {
    const text = m.text();
    if (m.type() !== "error" || /Failed to load resource/.test(text) || text.startsWith(placeholderSocket)) return;
    errors.push(text);
  });
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));

  await page.setViewportSize({ width: 1600, height: 1100 });
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    return ["localhost", "127.0.0.1"].includes(url.hostname) || ["blob:", "data:"].includes(url.protocol)
      ? route.continue()
      : route.abort();
  });
  await page.addInitScript(() =>
    localStorage.setItem("image-horse-prefs", JSON.stringify({ canvasArtboard: false })));
  await page.goto("/");
  await page.locator('input[type="file"]').first().waitFor({ state: "attached" });

  // Put the v9.73 save where v9.73 left it, then come back to it.
  await page.evaluate(restoreIdb, FIXTURE.dbs);
  await page.reload();
  await page.getByRole("button", { name: /Resume editing/i }).click({ timeout: 30_000 });
  const saved = savedEdit();
  await expect
    .poll(() => page.locator("canvas.main-canvas").getAttribute("width"), { timeout: 30_000 })
    .toBe(String(saved.canvasW));
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
  await installAnnotationProbe(page);

  // The stamp is in the pixels, exactly as saved.
  expect(await diffFromPng(page, saved.canvasPng.$u8), "the saved picture, byte for byte").toBe(0);

  // Undo works: one step, and it takes the stamp off.
  expect(saved.undoStack, "the fixture holds the stamp's one undo step").toHaveLength(1);
  expect(await page.evaluate(() => window.__annotationTool.undo_count())).toBe(1);
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press("Control+z");
  await expect.poll(() => diffFromPng(page, saved.undoStack[0]!.png.$u8), { message: "before the stamp" }).toBe(0);
  await page.keyboard.press("Control+Shift+z");
  await expect.poll(() => diffFromPng(page, saved.canvasPng.$u8), { message: "the stamp again" }).toBe(0);

  expect(errors, "no console error").toEqual([]);
});
