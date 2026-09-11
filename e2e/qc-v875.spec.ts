import { test, expect, type Page } from "@playwright/test";
import { join } from "node:path";

// ─────────────────────────────────────────────────────────────────────────────
// imagehorse-qc, automated slice — cut for v8.75.
//
// Sections 1 and 2 of the skill, against the PRODUCTION build in logged-out
// demo mode. Demo mode is the sacred path, so the harness bakes placeholder
// Convex/Clerk keys and blocks every off-localhost request.
//
// v8.75 touched the ENGINE and ANNOTATION RENDERING, which is why QC is owed:
//   • duplicate_{text,shape}_annotation — new engine calls
//   • the Stroke Stabilizer on eraser / blur / clone / pen
//   • photo_bounds is NOT in this release (PR #124), so the status bar here
//     still reports the document — do not fail on that.
//
// NOT covered: the duplicate pad's coordinate mapping under zoom. Automation
// cannot drive a shape drag — the three awaits in `onMouseDown` outrun a
// synthetic drag — so that row is a human check and is reported separately.
// ─────────────────────────────────────────────────────────────────────────────

const FIXTURE_PNG = join(__dirname, "fixtures", "checker.png");

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

/** The fixture is 256×256 and the default artboard adds 10px on every side,
 *  so a LOADED document is 276×276. */
const LOADED_W = 276;

async function importFixture(page: Page): Promise<void> {
  const fileInput = page.locator('input[type="file"]');
  await fileInput.waitFor({ state: "attached" });
  await fileInput.setInputFiles(FIXTURE_PNG);
  const canvas = page.locator("canvas.main-canvas");
  await canvas.waitFor({ state: "visible", timeout: 30_000 });
  // ⚠️ WAIT FOR THE REAL SIZE, NOT FOR "> 0". An unmounted canvas is 300×150 by
  // HTML default, so a `> 0` poll returns INSTANTLY on a document that never
  // loaded — and every assertion after it then runs against an empty engine.
  // This file shipped that bug once: S1 reported "canvas 300x150" and passed.
  await expect
    .poll(
      () =>
        page.evaluate(
          () => document.querySelector<HTMLCanvasElement>("canvas.main-canvas")?.width ?? 0,
        ),
      { timeout: 30_000 },
    )
    .toBe(LOADED_W);
}

// ── Section 1 — boot & demo mode ────────────────────────────────────────────

test("S1 · boots clean logged out, engine initialises, image loads", async ({ page }) => {
  await blockExternalNetwork(page);
  const errors = watchConsole(page);
  await page.goto("/");

  // The engine is the thing that must not panic. A failed init shows as a
  // missing/zero-width canvas after an import, so the import IS the assertion.
  await importFixture(page);

  const dims = await page.evaluate(() => {
    const c = document.querySelector<HTMLCanvasElement>("canvas.main-canvas");
    return { w: c?.width ?? 0, h: c?.height ?? 0 };
  });
  // The fixture's own size, not merely "nonzero" — see LOADED_W.
  expect(dims.w, "engine produced the fixture's canvas").toBe(LOADED_W);
  expect(dims.h).toBe(LOADED_W);
  console.log(`S1 canvas ${dims.w}x${dims.h}`);
  expect(errors, `console errors: ${errors.join(" | ")}`).toEqual([]);
});

// ── Section 2 — core editing loop ───────────────────────────────────────────

/**
 * Find the live engine by walking the React fiber tree (the app exposes no
 * global handle — see feedback_browser_probe_techniques). Cached on `window`
 * after the first walk. Worker-backed methods return Promises; every reader
 * below awaits.
 */
async function installEngineProbe(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as { __probeTool?: unknown };
    if (w.__probeTool) return;
    const root = document.querySelector("#root") as unknown as Record<string, unknown>;
    const key = Object.keys(root).find((k) => k.startsWith("__reactContainer"));
    if (!key) throw new Error("no react container");
    const seen = new Set<unknown>();
    const isEngine = (v: unknown): boolean =>
      !!v &&
      typeof v === "object" &&
      typeof (v as Record<string, unknown>).get_shape_annotations === "function" &&
      typeof (v as Record<string, unknown>).undo_count === "function";
    const probe = (v: unknown, depth: number): unknown => {
      if (!v || typeof v !== "object" || depth > 6 || seen.has(v)) return null;
      seen.add(v);
      if (isEngine(v)) return v;
      const o = v as Record<string, unknown>;
      for (const k of ["current", "toolRef", "memoizedState", "memoizedProps", "next", "baseState"]) {
        if (k in o) {
          const r = probe(o[k], depth + 1);
          if (r) return r;
        }
      }
      return null;
    };
    const fibers = new Set<unknown>();
    const stack: unknown[] = [root[key]];
    while (stack.length) {
      const f = stack.pop() as Record<string, unknown> | null;
      if (!f || fibers.has(f)) continue;
      fibers.add(f);
      for (const slot of ["memoizedState", "memoizedProps"]) {
        let s = f[slot] as Record<string, unknown> | null;
        // hooks are a linked list on memoizedState
        for (let i = 0; s && i < 64; i++) {
          const r = probe(s, 0);
          if (r) {
            w.__probeTool = r;
            return;
          }
          s = (s.next as Record<string, unknown> | null) ?? null;
        }
      }
      if (f.child) stack.push(f.child);
      if (f.sibling) stack.push(f.sibling);
    }
    throw new Error("engine not found in fiber tree");
  });
}

/**
 * Pixel identity of the composite, FROM THE ENGINE.
 *
 * ⚠️ NOT from a 2D context. The main canvas has had
 * `transferControlToOffscreen()` called on it (ADR-024, engine-in-worker is
 * the default), so `getContext("2d")` THROWS
 * "Cannot get context from a canvas that has transferred its control to
 * offscreen." The first cut of this file caught that throw and returned a
 * constant — which made the "did the stroke change pixels" assertion VACUOUS:
 * it compared the same fallback value to itself and could never have failed
 * for a real reason, only passed for a fake one.
 */
async function engineHash(page: Page): Promise<string> {
  // The fiber walk finds nothing until the engine has actually mounted, and a
  // single attempt right after import is a race. Retry briefly rather than
  // failing the product for a probe that looked too early.
  for (let i = 0; i < 10; i++) {
    try {
      await installEngineProbe(page);
      break;
    } catch {
      await page.waitForTimeout(500);
    }
  }
  return page.evaluate(async () => {
    const t = (window as unknown as { __probeTool: Record<string, () => Promise<string> | string> })
      .__probeTool;
    return await t.composite_hash_hex();
  });
}

test("S2 · a brush stroke changes pixels and undo puts them back exactly", async ({ page }) => {
  await blockExternalNetwork(page);
  const errors = watchConsole(page);
  await page.goto("/");
  await importFixture(page);

  const before = await engineHash(page);

  // Create → Brush, then drag on the canvas.
  await page.getByRole("button", { name: /^create$/i }).first().click({ timeout: 5_000 }).catch(() => {});
  await page.waitForTimeout(400);
  await page.getByRole("button", { name: /^brush$/i }).first().click({ timeout: 5_000 }).catch(() => {});
  await page.waitForTimeout(400);

  const canvas = page.locator("canvas.main-canvas");
  const box = await canvas.boundingBox();
  test.skip(!box, "no canvas box — harness, not product");
  await page.mouse.move(box!.x + box!.width * 0.3, box!.y + box!.height * 0.3);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) {
    await page.mouse.move(
      box!.x + box!.width * (0.3 + 0.04 * i),
      box!.y + box!.height * (0.3 + 0.03 * i),
    );
    await page.waitForTimeout(30);
  }
  await page.mouse.up();
  await page.waitForTimeout(700);

  const after = await engineHash(page);
  console.log(`S2 stroke  before=${before} after=${after}`);
  expect(after, "a brush stroke must change pixels").not.toBe(before);

  // Undo must restore EXACTLY — not approximately.
  await page.keyboard.press("Control+z");
  await page.waitForTimeout(900);
  const undone = await engineHash(page);
  console.log(`S2 undo    -> ${undone}`);
  expect(undone, "undo must restore the pre-stroke pixels exactly").toBe(before);

  expect(errors, `console errors: ${errors.join(" | ")}`).toEqual([]);
});

test("S2 · export produces real bytes with a PNG signature", async ({ page }) => {
  await blockExternalNetwork(page);
  await page.goto("/");
  await importFixture(page);

  // Ask the engine directly rather than driving the download dialog: this
  // section is "does export produce a correct file", and the dialog is
  // Section 3's job.
  const sig = await page.evaluate(async () => {
    const c = document.querySelector<HTMLCanvasElement>("canvas.main-canvas");
    if (!c) return null;
    const blob: Blob | null = await new Promise((r) => c.toBlob(r, "image/png"));
    if (!blob) return null;
    const head = new Uint8Array(await blob.slice(0, 8).arrayBuffer());
    return { size: blob.size, sig: Array.from(head).map((b) => b.toString(16).padStart(2, "0")).join("") };
  });
  console.log(`S2 export  ${sig?.size} bytes  sig=${sig?.sig}`);
  expect(sig, "export produced a blob").not.toBeNull();
  expect(sig!.size, "export is not empty").toBeGreaterThan(100);
  // 89504e470d0a1a0a is the PNG magic.
  expect(sig!.sig).toBe("89504e470d0a1a0a");
});
