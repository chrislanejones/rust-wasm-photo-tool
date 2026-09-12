#!/usr/bin/env node
// Renders the raster brand assets that have to be PNG:
//
//   public/og/*.png            one social share card per route (1200×630)
//   public/apple-touch-icon.png    180×180, for an iOS home-screen bookmark
//   public/icon-192.png, icon-512.png    the PWA manifest icons
//
//   node marketing/scripts/gen-og-images.mjs      (needs playwright; see below)
//
// ── why these are committed, not built ───────────────────────────────────
// This script is NOT part of `pnpm build`. It needs a headless Chromium, and
// making every production deploy download a ~150 MB browser to re-render five
// images that change a few times a year is a bad trade: it is the slowest step
// in the pipeline and the most likely to fail for reasons unrelated to the site.
// So the PNGs are generated here, committed, and served as ordinary static
// assets. Re-run it when a title in src/seo.ts changes, or when the card design
// does — the route titles are read from seo.ts, so the text cannot drift from
// what the pages actually say, only the picture can go stale.
//
// ── why PNG at all ───────────────────────────────────────────────────────
// The obvious shortcut is to point og:image at the existing SVG logo. Every
// major scraper ignores SVG in og:image — X/Twitter, LinkedIn, Slack, iMessage
// and Facebook all skip it — and an ignored og:image is the same as none: the
// link unfurls as a bare text row. 1200×630 is the size those scrapers crop to,
// so rendering at exactly that avoids their crop deciding what gets cut off.

import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const marketing = resolve(here, "..");
const outDir = join(marketing, "public", "og");

// `@playwright/test` rather than a bare `playwright` dependency: the repo already
// has it at the root for the e2e suite, pinned to the version the installed
// browsers were downloaded for, and it re-exports the same `chromium` launcher.
// Adding `playwright` separately would mean two copies at two versions, with the
// browser download matching only one of them.
let chromium;
try {
  ({ chromium } = await import("@playwright/test"));
} catch {
  console.error(
    "gen-og-images needs the repo's dev dependencies. From the repo root:\n\n" +
      "  pnpm install\n" +
      "  pnpm build:marketing && node marketing/scripts/gen-og-images.mjs\n",
  );
  process.exit(1);
}

// The route table is the source for the card text, same as for the <head>. It is
// read from the SSR build so this script never needs its own TypeScript step.
const { ROUTES } = await import(join(marketing, "dist-ssr", "entry-server.js")).catch(() => {
  console.error("gen-og-images: run `pnpm build` first — it needs dist-ssr/entry-server.js.");
  process.exit(1);
});

/* The card. Deliberately plain: a wordmark, the page's own title, and the
 * domain. No screenshot — a 1200×630 crop of a dark editor UI reads as noise at
 * the size these actually appear, and it would go stale on every UI change.
 *
 * Colours are the literal oklch values from src/tokens.css rather than a second
 * palette. Fonts fall back to the system stack: Geist is not installed on the
 * machine running this, and a card is not worth a webfont fetch here — the
 * weight and size carry it.
 */
const card = (title, kicker) => `<!doctype html>
<html><head><meta charset="utf-8"><style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 1200px; height: 630px; }
  body {
    background: oklch(13% 0.018 35);
    color: oklch(95% 0.010 70);
    font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    padding: 72px 80px;
    display: flex; flex-direction: column; justify-content: space-between;
    position: relative; overflow: hidden;
  }
  /* The accent bloom, same idea as the site's hero: a warm off-centre glow so
     the card isn't a flat rectangle in a feed. */
  body::before {
    content: ""; position: absolute; inset: -30% -10% auto auto;
    width: 780px; height: 780px; border-radius: 50%;
    background: radial-gradient(circle, oklch(74% 0.220 50 / 0.28), transparent 68%);
  }
  .top { display: flex; align-items: center; gap: 20px; position: relative; }
  .dot {
    width: 56px; height: 56px; border-radius: 13px;
    background: oklch(74% 0.180 55);
  }
  .mark { font-size: 30px; font-weight: 700; letter-spacing: -0.01em; }
  h1 {
    position: relative;
    font-size: ${title.length > 52 ? 68 : 80}px;
    font-weight: 700; line-height: 1.04; letter-spacing: -0.03em;
    max-width: 17ch;
  }
  .foot {
    position: relative; display: flex; align-items: baseline; gap: 18px;
    font-size: 25px; color: oklch(78% 0.015 60);
  }
  .url { color: oklch(74% 0.180 55); font-weight: 500; }
  .rule { height: 5px; width: 104px; background: oklch(74% 0.180 55); border-radius: 3px; margin-bottom: 28px; position: relative; }
</style></head>
<body>
  <div class="top"><div class="dot"></div><div class="mark">Image Horse</div></div>
  <div>
    <div class="rule"></div>
    <h1>${title}</h1>
  </div>
  <div class="foot"><span class="url">imagehorse.app</span><span>${kicker}</span></div>
</body></html>`;

/** The card headline, which is NOT the <title>. A <title> is written for a
 *  search result — it repeats the brand and the qualifiers, because that is what
 *  a search result needs. On a share card the brand is already the wordmark at
 *  the top, so repeating it wastes the largest text on the image. */
const HEADLINE = {
  "/": ["Edit photos without uploading them", "Rust · WebAssembly · runs in your tab"],
  "/architecture": ["One plane is the editor.\nThe other is optional.", "How it fits together"],
  "/features": ["Every tool, and where it runs", "The full feature list"],
  "/pricing": ["Free with no account.\nPro at $10 a month.", "Pricing"],
  "/trail-log": ["Every release, dated", "The trail log"],
};

mkdirSync(outDir, { recursive: true });

// CHROMIUM_PATH lets a machine point at a browser Playwright did not download
// itself — a CI image with Chromium preinstalled, or a checkout whose
// @playwright/test has floated to a version newer than the browsers on disk
// (Playwright pins a build number, so a minor bump leaves it looking for a
// revision that was never fetched). Unset, Playwright resolves its own, which is
// the normal local path after `pnpm exec playwright install chromium`.
const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
);
const page = await browser.newPage({
  viewport: { width: 1200, height: 630 },
  // 1× — the OG spec size is the pixel size, and a 2× card is four times the
  // bytes for a picture that gets downscaled by every client that shows it.
  deviceScaleFactor: 1,
});

for (const route of ROUTES) {
  const [headline, kicker] = HEADLINE[route.to] ?? [route.title, ""];
  await page.setContent(card(headline.replace(/\n/g, "<br>"), kicker), {
    waitUntil: "load",
  });
  const name = route.to === "/" ? "default" : route.to.replace(/^\//, "");
  const file = join(outDir, `${name}.png`);
  writeFileSync(file, await page.screenshot({ type: "png" }));
  console.log(`  og/${name}.png`);
}

/* ── icons ────────────────────────────────────────────────────────────────
 * public/favicon.svg stays the favicon — SVG is the better format there and
 * every browser that matters takes it. These PNGs exist for the two places that
 * still refuse SVG: iOS, which shows a blank tile for an SVG apple-touch-icon,
 * and the web app manifest, whose icons Chrome will not use as an install
 * prompt unless at least one is a 192px and one a 512px raster.
 *
 * Same two shapes as favicon.svg, scaled — a rounded square of paper with an
 * accent tile inside — so the home-screen icon and the tab favicon are visibly
 * the same mark rather than two designs that happen to share a colour.
 */
const icon = (px) => `<!doctype html>
<html><head><meta charset="utf-8"><style>
  * { margin: 0; padding: 0; }
  html, body { width: ${px}px; height: ${px}px; }
  body { background: oklch(13% 0.018 35); display: grid; place-items: center; }
  .tile {
    width: ${Math.round(px * 0.5625)}px; height: ${Math.round(px * 0.5625)}px;
    border-radius: ${Math.round(px * 0.125)}px;
    background: oklch(74% 0.180 55);
  }
</style></head><body><div class="tile"></div></body></html>`;

for (const [name, px] of [
  ["apple-touch-icon", 180],
  ["icon-192", 192],
  ["icon-512", 512],
]) {
  await page.setViewportSize({ width: px, height: px });
  await page.setContent(icon(px), { waitUntil: "load" });
  writeFileSync(join(marketing, "public", `${name}.png`), await page.screenshot({ type: "png" }));
  console.log(`  ${name}.png`);
}

await browser.close();
