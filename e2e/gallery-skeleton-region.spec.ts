import { test, expect } from "./guard/test";
import type { Page } from "@playwright/test";
import { join } from "node:path";
import {
  blockExternalNetwork,
  installHarness,
  probe,
  readWatch,
  releaseBlobs,
  resetWatch,
  setHold,
  type HoldMode,
} from "./gallery-skeleton-harness";

// UI Night 8 §1 — the gallery loads like Tools.
//
// The card goes skeleton as ONE piece, in place, and comes back as one piece:
// past 300 ms with a tile in view still empty (or an import in flight) the
// chrome — count, Compress, the action buttons, both chevrons — becomes muted
// blocks of its own size and goes inert, empty tiles in view are skeletons,
// one `role="status"` says how many, and nothing moves when it ends.
//
// Every test here was broken once on purpose and seen red (SESSION_LOG.md /
// the PR description list the break for each).

test.setTimeout(180_000);

const fx = (p: string) => join(__dirname, "fixtures", p);
/** Twelve photos — the logged-out cap — so the 1280 strip overflows: about
 *  nine tiles in view, three past the right chevron. */
const TWELVE = [0, 1, 2, 3, 4, 5, 6, 7, 8]
  .map((n) => fx(`phone/p${n}.png`))
  .concat([fx("sky-building.png"), fx("checker.png"), fx("paper-1200x900.png")]);

const SHAPES = [
  { name: "horizontal bar (1280)", width: 1280, height: 800 },
  { name: "docked vertical gallery (1000)", width: 1000, height: 800 },
  { name: "phone grid (390)", width: 390, height: 844 },
] as const;

/** Close the Compact ("Continue") / Mobile ("Got it") notices — they come
 *  back on every reload. */
async function dismissNotices(page: Page): Promise<void> {
  for (let i = 0; i < 6; i++) {
    const ok = page.getByRole("dialog").getByRole("button", { name: /^(Got it|Continue)$/ });
    if (!(await ok.isVisible().catch(() => false))) {
      if (i > 0) return;
      await page.waitForTimeout(300);
      continue;
    }
    await ok.click();
    await page.waitForTimeout(300);
  }
}

/** The docked layout only shows the gallery on its own tab. */
async function showGallery(page: Page, width: number): Promise<void> {
  if (width > 1000 || width < 600) return;
  const shown = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>("[data-gallery-card]")].some((e) => e.offsetParent !== null && !e.closest("[inert]")),
  );
  for (let i = 0; !shown && i < 4; i++) {
    await dismissNotices(page);
    const ok = await page
      .getByRole("button", { name: "Gallery", exact: true })
      .first()
      .click({ timeout: 5_000 })
      .then(() => true)
      .catch(() => false);
    if (ok) break;
  }
  await expect(page.locator("[data-gallery-card]:visible").first()).toBeVisible();
}

/** Every tile in the reachable gallery has its picture. */
const allDrawn = async (page: Page) => {
  const p = await probe(page);
  return p.tiles.length > 0 && p.tiles.every((t) => t.hasImg);
};

async function importTwelve(page: Page, width: number, height: number): Promise<void> {
  await page.setViewportSize({ width, height });
  await blockExternalNetwork(page);
  await installHarness(page);
  await page.goto("/");
  const input = page.locator('input[type="file"]').first();
  await input.waitFor({ state: "attached" });
  await input.setInputFiles(TWELVE);
  await dismissNotices(page);
  await showGallery(page, width);
  await expect.poll(async () => (await probe(page)).tiles.length, { timeout: 60_000 }).toBe(12);
  await expect.poll(() => allDrawn(page), { timeout: 60_000 }).toBe(true);
  // Let the gallery manifest reach IndexedDB before the reload reads it.
  await page.waitForTimeout(2500);
}

/** Reload and Resume (logged-out restore), with thumbnail decodes per `hold`. */
async function restore(page: Page, width: number, hold: HoldMode): Promise<void> {
  await setHold(page, hold);
  await page.reload();
  if (width >= 600) {
    // The Compact notice can open over the welcome screen, and a modal hides
    // everything else from the accessibility tree — so clear it, then look.
    const resume = page.getByRole("button", { name: /Resume editing/ });
    for (let i = 0; i < 60; i++) {
      await dismissNotices(page);
      if (await resume.isVisible().catch(() => false)) break;
      await page.waitForTimeout(500);
    }
    await resume.click();
  }
  await dismissNotices(page);
  // Off the bar: hovering it reveals every tile's Remove/Select (group-hover).
  await page.mouse.move(2, 2);
  await showGallery(page, width);
}

for (const shape of SHAPES) {
  test(`${shape.name}: slow thumbnails skeleton the card in place, one voice, unlock on the last tile, nothing moves`, async ({ page }) => {
    await importTwelve(page, shape.width, shape.height);
    const before = await probe(page);
    expect(before.loading, "at rest the card is not loading").toBe(false);
    expect(before.chromeCount, "the chrome pieces are found").toBeGreaterThan(0);

    await restore(page, shape.width, { mode: "hold" });
    await expect.poll(async () => (await probe(page)).loading, { timeout: 30_000 }).toBe(true);
    // The bar mounts with a slide and a margin spring; the hold keeps it
    // loading, so wait for the box to stop moving before calling it "during".
    let during = await probe(page);
    for (let i = 0; i < 20; i++) {
      await page.waitForTimeout(300);
      const next = await probe(page);
      const same = JSON.stringify(next.card) === JSON.stringify(during.card) && JSON.stringify(next.tiles.map((t) => t.box)) === JSON.stringify(during.tiles.map((t) => t.box));
      during = next;
      if (same) break;
    }
    expect(during.loading, "still loading once settled").toBe(true);

    // The chrome is skeleton (region attribute) AND inert.
    expect(during.chromeInert, "every chrome piece is inert while it lasts").toBe(true);
    // Every empty tile in view is a skeleton — not ragged, not blank.
    const emptyInView = during.tiles.filter((t) => t.inView && !t.hasImg);
    expect(emptyInView.length, "the hold left tiles in view empty").toBeGreaterThan(0);
    for (const t of emptyInView) expect(t.skeleton, `tile ${t.id} is a skeleton`).toBe(true);
    // ONE voice for the card, ONE busy flag.
    expect(during.statuses, "one role=status on the card").toHaveLength(1);
    expect(during.statuses[0]).toMatch(/^Loading \d+ photos?…$/);
    expect(during.busy, "the strip's aria-busy is the only busy flag").toBe(1);
    // The one shimmer.
    const shimmer = await page.evaluate(() => {
      const r = document.querySelector('[data-skeleton-region="gallery"]:not([inert] *)');
      return r ? getComputedStyle(r, "::after").animationName : null;
    });
    expect(shimmer, "the card carries the one shimmer").toBe("skeleton-shimmer");

    // Let every held decode land: the card comes back as one piece.
    await releaseBlobs(page);
    await expect.poll(async () => (await probe(page)).loading, { timeout: 30_000 }).toBe(false);
    await expect.poll(() => allDrawn(page), { timeout: 30_000 }).toBe(true);
    const after = await probe(page);
    expect(after.chromeInert, "unlocked").toBe(false);
    expect(after.statuses, "and silent").toHaveLength(0);

    // ⚠️ NOTHING MOVES. Card box and every chrome piece, before/during/after.
    console.log(`layout ${shape.name}: card before ${before.card} during ${during.card} after ${after.card}`);
    console.log(`chrome ${shape.name}: before ${JSON.stringify(before.chromeBoxes)} during ${JSON.stringify(during.chromeBoxes)}`);
    expect(during.card, "card box during = before").toEqual(before.card);
    expect(after.card, "card box after = before").toEqual(before.card);
    expect(during.chromeBoxes, "chrome boxes during = before").toEqual(before.chromeBoxes);
    expect(after.chromeBoxes, "chrome boxes after = before").toEqual(before.chromeBoxes);
    for (let i = 0; i < before.tiles.length; i++) {
      expect(during.tiles[i]!.box, `tile ${i} box during`).toEqual(before.tiles[i]!.box);
    }
  });
}

test("a restore whose thumbnails decode in under 300 ms shows no skeleton anywhere — watched every frame", async ({ page }) => {
  await importTwelve(page, 1280, 800);
  await restore(page, 1280, { mode: "off" });
  await expect.poll(async () => (await probe(page)).tiles.length, { timeout: 30_000 }).toBe(12);
  await expect.poll(() => allDrawn(page), { timeout: 30_000 }).toBe(true);
  await page.waitForTimeout(1500);
  const w = await readWatch(page);
  console.log("cached restore watch: " + JSON.stringify(w));
  // The control: a watcher that never ran would also report zero.
  expect(w.frames, "the frame watcher ran").toBeGreaterThan(60);
  expect(w.region, "the card never went skeleton").toBe(0);
  expect(w.tiles, "no tile flashed a skeleton").toBe(0);
});

test("an off-screen tile still empty does not keep the card loading", async ({ page }) => {
  await importTwelve(page, 1280, 800);
  await restore(page, 1280, { mode: "hold" });
  await expect.poll(async () => (await probe(page)).loading, { timeout: 30_000 }).toBe(true);
  // Release every held decode except the last one asked for — the last tile,
  // past the right chevron.
  await releaseBlobs(page, 1);
  await expect.poll(async () => (await probe(page)).loading, { timeout: 30_000 }).toBe(false);
  const p = await probe(page);
  const empty = p.tiles.filter((t) => !t.hasImg);
  // ⚠️ THE CONTROL. If the held decode were not a tile's, or the tile were in
  // view, this test would prove nothing.
  expect(empty.length, "one tile is still empty").toBe(1);
  expect(empty[0]!.inView, "and it is off screen").toBe(false);
  expect(p.chromeInert, "the chrome is unlocked anyway").toBe(false);
  expect(p.busy, "the strip still says busy — honestly").toBe(1);
  await releaseBlobs(page);
  await expect.poll(() => allDrawn(page), { timeout: 30_000 }).toBe(true);
});

test("an edit's thumbnail regeneration never puts the card into loading", async ({ page }) => {
  await importTwelve(page, 1280, 800);
  // Every new decode now takes 1.5 s — well past the grace — so an edit that
  // counted as "loading" could not hide inside 300 ms.
  await setHold(page, { mode: "delay", ms: 1500 });
  await resetWatch(page);
  // Apply Resize re-encodes the photo and regenerates its thumbnail (the
  // Resize & Compress panel is open by default at 1280). Five edits, each
  // checked to have produced a NEW decoded thumbnail — the control, because an
  // edit that never regenerated would pass this test for the wrong reason.
  const active = page.locator('[data-gallery-card] [data-id][aria-pressed="true"] img').first();
  const width = page.getByLabel("width", { exact: true });
  for (const w of [800, 700, 600, 500, 400]) {
    const src = await active.getAttribute("src");
    await width.fill(String(w));
    await page.getByRole("button", { name: /^Apply Resize$/ }).click();
    await page.mouse.move(2, 2);
    await expect.poll(() => active.getAttribute("src"), { timeout: 30_000 }).not.toBe(src);
  }
  await page.waitForTimeout(2000);
  const w = await readWatch(page);
  console.log("edit watch: " + JSON.stringify(w));
  expect(w.frames).toBeGreaterThan(60);
  expect(w.region, "five edits, no skeleton on the card").toBe(0);
  expect(w.tiles, "and none on a tile").toBe(0);
});

test("an import of 10 files puts the card into loading until they land", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await blockExternalNetwork(page);
  await installHarness(page);
  await page.goto("/");
  // Two photos first: the gallery only exists once it has a photo, so an
  // import into an EMPTY gallery has no card to put into loading.
  const input0 = page.locator('input[type="file"]').first();
  await input0.waitFor({ state: "attached" });
  await input0.setInputFiles(TWELVE.slice(10, 12));
  await expect.poll(async () => (await probe(page)).tiles.length, { timeout: 60_000 }).toBe(2);
  await expect.poll(() => allDrawn(page), { timeout: 60_000 }).toBe(true);
  // While import placeholders exist and every real tile HAS its picture, is
  // the card loading? Then only the import can be the reason. Recorded every
  // frame in the page: a polling driver could miss it.
  await page.evaluate(() => {
    const w = window as unknown as { __importOnly: { seen: number; loading: number } };
    w.__importOnly = { seen: 0, loading: 0 };
    const tick = () => {
      const pend = document.querySelectorAll('[data-testid="pending-import"]').length;
      const tiles = [...document.querySelectorAll("[data-gallery-card] [data-id]")];
      if (pend > 0 && tiles.length > 0 && tiles.every((t) => t.querySelector("img"))) {
        w.__importOnly.seen++;
        if (document.querySelector('[data-skeleton-region="gallery"]')) w.__importOnly.loading++;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  // With photos open the picker lives behind New.
  await page.getByRole("button", { name: "New", exact: true }).first().click();
  const input = page.locator('input[type="file"]').first();
  await input.waitFor({ state: "attached" });
  const cdp = await page.context().newCDPSession(page);
  await input.setInputFiles(TWELVE.slice(0, 10));
  // Slow the import itself (thumbnails stay un-held): the loading must come
  // from the import, not from a tile.
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 20 });
  await expect(page.locator('[data-testid="pending-import"]').first()).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('[data-skeleton-region="gallery"]')).toHaveCount(1, { timeout: 60_000 });
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
  await expect(page.locator('[data-testid="pending-import"]')).toHaveCount(0, { timeout: 120_000 });
  await expect(page.locator('[data-skeleton-region="gallery"]')).toHaveCount(0, { timeout: 30_000 });
  await expect.poll(async () => (await probe(page)).tiles.length).toBe(12);
  const r = await page.evaluate(() => (window as unknown as { __importOnly: { seen: number; loading: number } }).__importOnly);
  console.log("import-only frames: " + JSON.stringify(r));
  expect(r.seen, "there were frames where only the import was pending").toBeGreaterThan(0);
  expect(r.loading, "the card was loading during them").toBeGreaterThan(0);
});

test("the 15 s cap unlocks the chrome, logs, and a lost decode shows its error", async ({ page }) => {
  await importTwelve(page, 1280, 800);
  const warnings: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "warning") warnings.push(m.text());
  });
  await restore(page, 1280, { mode: "hold" });
  await expect.poll(async () => (await probe(page)).loading, { timeout: 30_000 }).toBe(true);
  // Never released: a decode that is lost for good.
  await expect.poll(async () => (await probe(page)).loading, { timeout: 25_000 }).toBe(false);
  const p = await probe(page);
  expect(p.chromeInert, "unlocked").toBe(false);
  expect(warnings.some((w) => /did not finish loading in 15s/.test(w)), "and logged").toBe(true);
  const errors = await page.locator('[data-gallery-card] [role="img"][aria-label$="could not be displayed"]').count();
  expect(errors, "lost tiles say so instead of shimmering for ever").toBeGreaterThan(0);
  await releaseBlobs(page);
});

test("one rule for Tools and the gallery: the alias still skeletons, the strip opts out", async ({ page }) => {
  await page.goto("/");
  const r = await page.evaluate(() => {
    const make = (attr: string, value = "") => {
      const region = document.createElement("div");
      region.setAttribute(attr, value);
      region.innerHTML = '<div><button>Chrome</button><div data-skeleton-skip><button>Tile</button><svg width="4" height="4"></svg></div></div>';
      document.body.appendChild(region);
      const [chrome, tile] = [...region.querySelectorAll("button")];
      const out = {
        chromeColor: getComputedStyle(chrome!).color,
        tileColor: getComputedStyle(tile!).color,
        tileSvg: getComputedStyle(region.querySelector("svg")!).opacity,
      };
      region.remove();
      return out;
    };
    return { region: make("data-skeleton-region", "gallery"), alias: make("data-switch-skeleton") };
  });
  // Tools' old attribute still mutes in place (PerPhotoRegion emits both).
  expect(r.alias.chromeColor, "alias mutes a control").toBe("rgba(0, 0, 0, 0)");
  expect(r.region.chromeColor, "the new name mutes a control").toBe("rgba(0, 0, 0, 0)");
  // The strip keeps its own rule: a tile is a skeleton or the photo.
  expect(r.region.tileColor, "the strip opts out").not.toBe("rgba(0, 0, 0, 0)");
  expect(r.region.tileSvg, "the strip's icons stay").toBe("1");
});

test("reduced motion: the card does not shimmer", async ({ page }) => {
  await page.goto("/");
  const shimmer = () =>
    page.evaluate(() => {
      const d = document.createElement("div");
      d.setAttribute("data-skeleton-region", "gallery");
      document.body.appendChild(d);
      const v = getComputedStyle(d, "::after").display;
      d.remove();
      return v;
    });
  // The control: with motion allowed the sweep exists.
  expect(await shimmer(), "the sweep exists with motion on").not.toBe("none");
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(await shimmer(), "and is gone under reduced motion").toBe("none");
});
