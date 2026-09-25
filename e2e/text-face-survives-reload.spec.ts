import { test, expect } from "./guard/test";
import type { Page } from "@playwright/test";
import { join } from "node:path";

// ─────────────────────────────────────────────────────────────────────────────
// A text committed in Liberation Mono is still Mono after a reload.
//
// F1 from the 09-19 QC, and still live after v8.82 claimed it fixed. #195 made
// the `font_id` survive the reload; the face was then lost one step later,
// because nothing on the resume path registered the runtime fonts (ADR-058)
// before the document was redrawn, and a `font_id` with no registered bytes is
// drawn in the embedded Sans.
//
// Measured on a v8.82 production build: glyph spacing 12.5–13 px when
// committed, i-stems 4.5–5 px after Resume. The reload test below is RED on
// v8.81 and on v8.82 and green with the fix; the sensitivity test proves the
// face shows in the pixels at all, without which the reload test could pass
// for the wrong reason.
//
// Vitest pins the ORDER (restoreLayerStack.fonts.test.ts and the op-log restore
// test). Only a browser can show the face actually reaching the pixels.
// ─────────────────────────────────────────────────────────────────────────────


const FIXTURE_PNG = join(__dirname, "fixtures", "checker.png"); // 256×256

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

async function waitForCanvas(page: Page): Promise<void> {
  await page.locator("canvas.main-canvas").waitFor({ state: "visible", timeout: 30_000 });
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

async function importViaPicker(page: Page): Promise<void> {
  const input = page.locator('input[type="file"]');
  await input.waitFor({ state: "attached" });
  await input.setInputFiles(FIXTURE_PNG);
  await waitForCanvas(page);
}

async function pickTool(page: Page, group: string, subTool: string): Promise<void> {
  await page.getByRole("button", { name: group, exact: true }).first().click();
  await page.getByRole("button", { name: subTool, exact: true }).first().click();
  await page.waitForTimeout(400);
}

async function canvasPng(page: Page): Promise<string> {
  await page.waitForTimeout(600);
  return page.evaluate(
    () =>
      document.querySelector<HTMLCanvasElement>("canvas.main-canvas")?.toDataURL("image/png") ??
      "",
  );
}

/** Place `text` in the chosen face and COMMIT it — click away, then Escape the
 *  fresh input the click opens (the recipe from qc-v841.spec.ts). Escape on
 *  its own, or a tool switch, DISCARDS an uncommitted annotation. */
async function commitText(page: Page, text: string, fontId: string): Promise<void> {
  await pickTool(page, "Create", "Text");
  const face = page.locator("select").filter({ has: page.locator(`option[value="${fontId}"]`) });
  await face.first().selectOption(fontId);
  const box = (await page.locator("canvas.main-canvas").boundingBox())!;
  await page.mouse.click(box.x + box.width * 0.2, box.y + box.height * 0.35);
  const textarea = page.locator("textarea").first();
  await expect(textarea, "the text input opened").toBeVisible({ timeout: 10_000 });
  await textarea.fill(text);
  await page.waitForTimeout(400);
  await page.mouse.click(box.x + box.width * 0.8, box.y + box.height * 0.85);
  await page.waitForTimeout(900);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(1200);
}

async function reloadAndResume(page: Page): Promise<void> {
  await page.reload();
  const resume = page.getByRole("button", { name: /Resume editing/ });
  await expect(resume, "the welcome-back screen offers Resume").toBeVisible({ timeout: 30_000 });
  await resume.click();
  await waitForCanvas(page);
}

test.beforeEach(async ({ page }) => {
  await blockExternalNetwork(page);
});

test("a committed Mono text is pixel-identical after a reload", async ({ page }) => {
  const errors = watchConsole(page);
  await page.goto("/");
  await importViaPicker(page);
  const untouched = await canvasPng(page);

  await commitText(page, "MMMM iiii MMMM", "liberation-mono");
  const committed = await canvasPng(page);
  expect(committed, "the committed text changed pixels").not.toBe(untouched);

  // Give the autosave time to write the archive and the op log.
  await page.waitForTimeout(10_000);
  await reloadAndResume(page);

  const resumed = await canvasPng(page);
  expect(resumed, "after Resume the text is still there").not.toBe(untouched);
  expect(resumed, "after Resume the text is PIXEL-IDENTICAL — same face, same box").toBe(committed);
  expect(errors, "no app console errors across commit + reload").toEqual([]);
});

test("the face really shows in the pixels (Sans ≠ Mono)", async ({ page }) => {
  await page.goto("/");
  await importViaPicker(page);
  await commitText(page, "MMMM iiii MMMM", "liberation-mono");
  const mono = await canvasPng(page);

  await page.keyboard.press("Control+z");
  await page.waitForTimeout(900);
  await commitText(page, "MMMM iiii MMMM", "");
  const sans = await canvasPng(page);

  expect(sans, "Sans and Mono commit to different pixels").not.toBe(mono);
});
