import { test, expect, type Page } from "@playwright/test";
import { join } from "node:path";

// Plan C §1 point 10 — the phone grid at 390px, MEASURED.
//
// The jsdom tests pin the rule (`MobileShell.thumbs.test.ts`); they cannot see
// layout, and §1's stop condition is about layout: "the skeleton shifts layout
// anywhere → fix the sizing before shipping. A jumping skeleton is worse than
// none."
//
// The grid is `grid-cols-3 content-start items-start`, so a tile's row height
// comes from its in-flow child. Nine photos with nine different aspect ratios
// — portrait, landscape and square — must all produce the same square tile,
// because the thumbnail is `object-fit: cover` inside `aspect-square`. A tile
// that took its height from the photo would make three ragged rows.

const FIX = (n: number) => join(__dirname, "fixtures", "phone", `p${n}.png`);
const ALL = [0, 1, 2, 3, 4, 5, 6, 7, 8].map(FIX);

async function blockExternalNetwork(page: Page): Promise<void> {
  await page.route("**/*", (route) => {
    const url = route.request().url();
    if (/^https?:\/\/(localhost|127\.0\.0\.1)[:/]/.test(url) || url.startsWith("blob:") || url.startsWith("data:")) {
      return route.continue();
    }
    return route.abort();
  });
}

/** Every phone tile's box, plus what it is currently drawing. */
const measure = (page: Page) =>
  page.evaluate(() => {
    const grid = document.querySelector<HTMLElement>(".grid.grid-cols-3");
    const tiles = [...document.querySelectorAll<HTMLElement>("button.photo-thumb-grid")];
    return {
      busy: grid?.getAttribute("aria-busy") ?? null,
      // How many elements in the whole document claim to be busy. One is the
      // grid; the tiles must not each add their own.
      busyCount: document.querySelectorAll('[aria-busy="true"]').length,
      placeholders: document.querySelectorAll(".skeleton").length,
      tiles: tiles.map((el) => {
        const r = el.getBoundingClientRect();
        const img = el.querySelector("img");
        const ir = img?.getBoundingClientRect();
        // `.photo-thumb` carries a 2px transparent border that the ring
        // vocabulary colours in, so the image fills the CONTENT box, not the
        // border box. Measured rather than assumed: hard-coding 4 here would
        // make the test a restatement of the stylesheet.
        const cs = getComputedStyle(el);
        const border = Math.round(parseFloat(cs.borderTopWidth) || 0);
        return {
          border,
          w: Math.round(r.width),
          h: Math.round(r.height),
          top: Math.round(r.top),
          left: Math.round(r.left),
          hasImg: Boolean(img),
          imgW: ir ? Math.round(ir.width) : null,
          imgH: ir ? Math.round(ir.height) : null,
        };
      }),
    };
  });

test.setTimeout(180_000);

test("nine photos of nine shapes make one uniform 3-column grid, and the grid says busy once", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await blockExternalNetwork(page);
  await page.goto("/");

  const input = page.locator('input[type="file"]').first();
  await input.waitFor({ state: "attached" });
  await input.setInputFiles(ALL);

  // Wait for all nine tiles, then for the grid to stop reporting itself busy —
  // which is the thing under test, so it is also the wait condition.
  await expect(page.locator("button.photo-thumb-grid")).toHaveCount(9, { timeout: 60_000 });
  await expect(page.locator(".grid.grid-cols-3")).toHaveAttribute("aria-busy", "false", { timeout: 60_000 });

  const m = await measure(page);
  console.log("phone grid: " + JSON.stringify(m));

  // Settled: a picture in every tile, nothing waiting, nothing announcing.
  expect(m.placeholders, "no placeholder left on screen").toBe(0);
  expect(m.busyCount, "nothing claims to be busy once every tile has pixels").toBe(0);
  for (const t of m.tiles) expect(t.hasImg, "every tile drew its photo").toBe(true);

  // ⚠️ THE LAYOUT CLAIM. Nine different source aspect ratios, one tile size.
  expect(new Set(m.tiles.map((t) => `${t.w}x${t.h}`)).size, "every tile the same box").toBe(1);
  expect(m.tiles[0]!.w, "a tile is square").toBe(m.tiles[0]!.h);

  // Three columns, three rows, and rows that line up — a tile sized from its
  // photo instead of its box would stagger these.
  expect(new Set(m.tiles.map((t) => t.left)).size, "exactly three columns").toBe(3);
  expect(new Set(m.tiles.map((t) => t.top)).size, "exactly three rows").toBe(3);

  // The image fills its tile's content box rather than letterboxing inside it.
  // Measured 117x117 outer, 113x113 image, 2px border: the first run of this
  // test asserted `imgW === w` and failed at 113 vs 117 — the assertion was
  // wrong, not the layout.
  for (const t of m.tiles) {
    expect(t.imgW, "the photo fills the tile's content width").toBe(t.w - 2 * t.border);
    expect(t.imgH, "the photo fills the tile's content height").toBe(t.h - 2 * t.border);
  }
});

test("a placeholder occupies exactly the box its photo will take — zero shift", async ({ page }) => {
  // §1's stop condition: "the skeleton shifts layout anywhere → fix the sizing
  // before shipping. A jumping skeleton is worse than none."
  //
  // ⚠️ THE PLACEHOLDER CANNOT BE CAUGHT BY WAITING. The first version of this
  // test polled at 100x CPU throttle for 90 seconds and never saw one, which
  // is a finding rather than a failure: a tile only mounts once its thumbnail
  // blob exists, the blob is a small WebP, and a small WebP decodes far inside
  // the 300 ms grace period. On the phone the placeholder is reachable only
  // when one decode genuinely stalls.
  //
  // So the decode is held open ON PURPOSE. `window.Image` is wrapped to delay
  // `blob:` loads, which puts every tile in the placeholder state for a known
  // window, in a real layout engine. Then the delay expires and the same nine
  // tiles are measured again. Same boxes = no shift. A poll that never catches
  // the state proves nothing; this does.
  await page.setViewportSize({ width: 390, height: 844 });
  await blockExternalNetwork(page);

  const HOLD_MS = 2500;
  await page.addInitScript((hold) => {
    const Native = window.Image;
    // Blanket on `blob:` rather than scoped to the gallery probe: the
    // discriminator would have to be the probe's own property order, and a
    // test that depends on that breaks the moment the hook is tidied. The
    // other `new Image()` callers in the app are the canvas loader and the SVG
    // rasteriser, and both merely finish later — the phone layer covers the
    // canvas at this width, and these fixtures are PNG.
    function Delayed(this: unknown, ...args: unknown[]) {
      const img = new (Native as unknown as new (...a: unknown[]) => HTMLImageElement)(...args);
      const proto = Object.getPrototypeOf(img) as HTMLImageElement;
      const srcDesc = Object.getOwnPropertyDescriptor(
        Object.getPrototypeOf(proto) === null ? proto : HTMLImageElement.prototype,
        "src",
      )!;
      Object.defineProperty(img, "src", {
        configurable: true,
        get() {
          return srcDesc.get!.call(img);
        },
        set(v: string) {
          if (typeof v === "string" && v.startsWith("blob:")) {
            window.setTimeout(() => srcDesc.set!.call(img, v), hold);
            return;
          }
          srcDesc.set!.call(img, v);
        },
      });
      return img;
    }
    Delayed.prototype = Native.prototype;
    (window as unknown as { Image: unknown }).Image = Delayed;
  }, HOLD_MS);

  await page.goto("/");
  const input = page.locator('input[type="file"]').first();
  await input.waitFor({ state: "attached" });
  await input.setInputFiles(ALL);

  await expect(page.locator("button.photo-thumb-grid")).toHaveCount(9, { timeout: 60_000 });
  // Past the 300 ms grace with nothing decoded: placeholders, by construction.
  await expect(page.locator(".skeleton")).toHaveCount(9, { timeout: 30_000 });

  const waiting = await measure(page);
  console.log("all nine waiting: " + JSON.stringify(waiting));

  // ⚠️ THE CONTROL. If the delay silently did nothing, the assertions below
  // would compare nine settled tiles with nine settled tiles and pass for the
  // wrong reason. A waiting tile has no `<img>` at all.
  expect(waiting.placeholders, "every tile is waiting").toBe(9);
  for (const t of waiting.tiles) expect(t.hasImg, "a waiting tile draws no photo").toBe(false);
  expect(waiting.busyCount, "the grid announces once, the tiles not at all").toBe(1);
  expect(waiting.busy, "and it is the grid that announces").toBe("true");
  for (const el of await page.locator(".skeleton").all()) {
    expect(await el.getAttribute("aria-hidden"), "tile placeholders are decorative").toBe("true");
  }

  // Now let them land.
  await expect(page.locator(".grid.grid-cols-3")).toHaveAttribute("aria-busy", "false", { timeout: 60_000 });
  const settled = await measure(page);
  console.log("all nine settled: " + JSON.stringify(settled));
  expect(settled.placeholders).toBe(0);
  for (const t of settled.tiles) expect(t.hasImg).toBe(true);

  // THE CLAIM: nine boxes, unchanged, to the pixel.
  expect(settled.tiles.map((t) => [t.w, t.h, t.top, t.left])).toEqual(
    waiting.tiles.map((t) => [t.w, t.h, t.top, t.left]),
  );
});

test("an ordinary open flashes no placeholder at all — watched every frame", async ({ page }) => {
  // The defect this change actually removes, and the one worth a permanent
  // test: master's `MobileThumb` started at `useState(true)`, so every tile
  // drew a placeholder on every open and then threw it away milliseconds
  // later. Measured at 390px with nine photos, unthrottled, watching from
  // inside the page every frame:
  //
  //   master  peak 9 of 9 placeholders across 226 frames
  //   now     peak 0          across 223 frames
  //
  // ⚠️ Polled from a rAF loop INSIDE the page, not by round-tripping. A flash
  // that lasts two frames is invisible to a polling test driver, and "I did
  // not see one" would then be the same answer whether or not there was one.
  await page.setViewportSize({ width: 390, height: 844 });
  await blockExternalNetwork(page);
  await page.goto("/");

  await page.evaluate(() => {
    const w = window as unknown as { __peak: number; __frames: number };
    w.__peak = 0;
    w.__frames = 0;
    const tick = () => {
      w.__peak = Math.max(w.__peak, document.querySelectorAll(".skeleton").length);
      w.__frames++;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });

  const input = page.locator('input[type="file"]').first();
  await input.waitFor({ state: "attached" });
  await input.setInputFiles(ALL);
  await expect(page.locator("button.photo-thumb-grid")).toHaveCount(9, { timeout: 60_000 });
  await page.waitForTimeout(2500);

  const r = await page.evaluate(() => {
    const w = window as unknown as { __peak: number; __frames: number };
    return { peak: w.__peak, frames: w.__frames };
  });
  console.log("flash watch: " + JSON.stringify(r));

  // The control: a watcher that never ran would also report a peak of 0.
  expect(r.frames, "the frame watcher actually ran").toBeGreaterThan(60);
  expect(r.peak, "no placeholder is drawn on an ordinary open").toBe(0);
});
