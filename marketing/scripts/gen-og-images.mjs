#!/usr/bin/env node
// Renders the raster brand assets that have to be PNG:
//
//   public/og/*.png            one social share card per route (1200×630)
//   public/og/blog/<slug>.png  one per post, over the post's header scene
//   public/apple-touch-icon.png    180×180, for an iOS home-screen bookmark
//   public/icon-192.png, icon-512.png    the PWA manifest icons
//
//   node marketing/scripts/gen-og-images.mjs      (needs playwright; see below)
//   node marketing/scripts/gen-og-images.mjs --posts    the post cards only
//   node marketing/scripts/gen-og-images.mjs --icons    the three icons only
//
// `--posts` exists because the other ten files are pixel-stable but not
// byte-stable: a newer Chromium encodes the same pixels into a different PNG,
// so a full run rewrites every route card and icon with no visible change,
// and a new post's card would arrive wrapped in ten binary diffs.
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

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, extname, resolve, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const marketing = resolve(here, "..");
const outDir = join(marketing, "public", "og");
const dist = join(marketing, "dist");

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
const { ROUTES, POSTS, postPath } = await import(join(marketing, "dist-ssr", "entry-server.js")).catch(() => {
  console.error("gen-og-images: run `pnpm build` first — it needs dist-ssr/entry-server.js.");
  process.exit(1);
});

/* The card. Deliberately plain: a wordmark, the page's own title, and the
 * domain. No screenshot — a 1200×630 crop of a dark editor UI reads as noise at
 * the size these actually appear, and it would go stale on every UI change.
 *
 * Colors are the literal oklch values from src/tokens.css rather than a second
 * palette. The face is Geist, fetched the same way the post cards fetch it.
 * These used to fall back to `system-ui`, which is a different font on every
 * machine that runs this — DejaVu on one, Helvetica on the next — so the same
 * card changed typeface depending on who generated it, and none of them was the
 * face the site is actually set in.
 *
 * The mark is the real horse, inlined as a data URI because `setContent` has no
 * base URL for a relative src to resolve against. It was a plain orange square.
 */
const LOGO = `data:image/svg+xml;base64,${readFileSync(
  join(marketing, "public", "Image-Horse-Logo.svg"),
).toString("base64")}`;

const card = (title, kicker) => `<!doctype html>
<html><head><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@500;700&display=block">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 1200px; height: 630px; }
  body {
    background: oklch(13% 0.018 35);
    color: oklch(95% 0.010 70);
    font-family: "Geist", system-ui, sans-serif;
    padding: 72px 80px;
    display: flex; flex-direction: column; justify-content: space-between;
    position: relative; overflow: hidden;
  }
  /* The accent bloom, same idea as the site's hero: a warm off-center glow so
     the card isn't a flat rectangle in a feed. */
  body::before {
    content: ""; position: absolute; inset: -30% -10% auto auto;
    width: 780px; height: 780px; border-radius: 50%;
    background: radial-gradient(circle, oklch(74% 0.220 50 / 0.28), transparent 68%);
  }
  .top { display: flex; align-items: center; gap: 20px; position: relative; }
  .logo { width: 60px; height: 60px; border-radius: 20%; display: block; }
  .mark { font-size: 30px; font-weight: 700; letter-spacing: -0.01em; }
  h1 {
    position: relative;
    font-size: ${title.length > 52 ? 68 : 80}px;
    font-weight: 700; line-height: 1.04; letter-spacing: -0.03em;
    max-width: 17ch;
    /* A headline that overruns a line by one word leaves that word alone on the
       last line, which at 80px is the loudest thing on the card. */
    text-wrap: balance;
  }
  .foot {
    position: relative; display: flex; align-items: baseline; gap: 18px;
    font-size: 25px; color: oklch(78% 0.015 60);
  }
  .url { color: oklch(74% 0.180 55); font-weight: 500; }
  .rule { height: 5px; width: 104px; background: oklch(74% 0.180 55); border-radius: 3px; margin-bottom: 28px; position: relative; }
</style></head>
<body>
  <div class="top"><img class="logo" src="${LOGO}" alt=""><div class="mark">Image Horse</div></div>
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
  "/features": ["Everything the editor does,\nin plain words.", "56 features"],
  "/pricing": ["Free with no account.\nPro at $10 a month.", "Pricing"],
  "/blog": ["The changelog says what.\nThis says why.", "The blog"],
  "/trail-log": ["Every release,\nin the open.", "The trail log"],
  "/about": ["One person,\nand a horse.", "About"],
  "/contact": ["One inbox. The person\nwho wrote the code.", "Contact"],
  "/privacy-policy": ["What stays,\nand what leaves.", "Privacy policy"],
  "/terms-of-service": ["Your pictures\nstay yours.", "Terms of service"],
  "/in-the-works": ["What's coming,\nand how sure we are.", "No dates"],
  "/openraster": ["Open a .ora file\nin your browser.", "OpenRaster viewer"],
  "/image-editor-no-upload": ["Your photos stay\non your computer.", "An editor with no upload"],
  "/photo-editor": ["A photo editor\nthat never uploads.", "Photo editor"],
  "/image-compressor": ["Compress to the size\nyou actually need.", "Image compressor"],
  "/background-remover": ["Cut the subject out,\nclean edge and all.", "Background remover"],
  "/remove-object-from-photo": ["Paint over it.\nIt's gone.", "Remove an object"],
  "/annotate-image": ["Arrows, pins and boxes\nthat stay editable.", "Annotate an image"],
  "/clone-stamp": ["Paint one part of a\nphoto over another.", "Clone stamp"],
  "/pixelate-image": ["Block it out.\nFlattened means gone.", "Pixelate an image"],
  "/blur-image": ["Soften a background,\nor hide a detail.", "Blur an image"],
  "/batch-image-editor": ["One pass over\na whole folder.", "Batch image editor"],
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

const postsOnly = process.argv.includes("--posts");
// The same reason `--posts` exists, the other way round: a new icon should not
// arrive wrapped in a dozen byte-churned share cards.
const iconsOnly = process.argv.includes("--icons");

for (const route of postsOnly || iconsOnly ? [] : ROUTES) {
  const [headline, kicker] = HEADLINE[route.to] ?? [route.title, ""];
  await page.setContent(card(headline.replace(/\n/g, "<br>"), kicker), {
    waitUntil: "load",
  });
  // Same check as the post cards below: ask for the faces by name, because
  // `fonts.ready` can resolve before layout has asked for them.
  const geist = await page.evaluate(async () => {
    const got = await Promise.all(
      ['700 80px "Geist"', '500 25px "Geist"'].map((f) => document.fonts.load(f).catch(() => [])),
    );
    return got.every((faces) => faces.length > 0 && faces.every((f) => f.status === "loaded"));
  });
  const name = route.to === "/" ? "default" : route.to.replace(/^\//, "");
  if (!geist) {
    console.warn(
      `  ⚠ og/${name}.png: Geist did not load (offline?). ` +
        `The card was drawn in the system fallback; re-run with a network before committing it.`,
    );
  }
  const file = join(outDir, `${name}.png`);
  writeFileSync(file, await page.screenshot({ type: "png" }));
  console.log(`  og/${name}.png`);
}

/* ── one card per post ────────────────────────────────────────────────────
 * A post gets its own card because its headline IS the pitch — falling back to
 * the site default would unfurl every article as the same generic tile, which
 * is the one case where a share card actively costs you the click.
 *
 * The card takes the post's on-page headline rather than its <title>, for the
 * same reason the routes above take HEADLINE: the brand is already the wordmark
 * at the top of the image.
 *
 * Written to og/blog/<slug>.png, mirroring the URL, so a post's card is
 * findable from its address without a lookup table.
 *
 * ── the scene behind it ──
 * A post with a header banner (posts/registry.tsx) gets that banner's scene
 * behind its card, the way the design draws it. The scene is NOT rebuilt here.
 * The script opens the BUILT post, lets the site's own code draw the banner,
 * and screenshots just the scene. A second copy of a three.js scene in a
 * build script would drift from the page on the first edit, and nothing would
 * notice.
 *
 * Reduced motion is emulated on purpose. Under it a scene draws one frame, the
 * one the design picked for the still, and stops. So the card is the same
 * picture on every run instead of whichever frame the timer landed on.
 *
 * The built site is served to the browser from dist/ by request interception,
 * so there is no server and no port. Every other request is refused, except
 * Google Fonts. That includes analytics: a render script must never count as
 * a visit.
 */
const ORIGIN = "http://og.localhost";
const MIME = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webp": "image/webp",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
};

const siteContext = await browser.newContext({
  viewport: { width: 1200, height: 630 },
  deviceScaleFactor: 1,
  reducedMotion: "reduce",
});
await siteContext.route("**/*", (route) => {
  const url = new URL(route.request().url());
  if (url.origin === ORIGIN) {
    // /blog/<slug> is a directory index in dist/, as it is on Vercel.
    let path = join(dist, decodeURIComponent(url.pathname));
    if (!extname(path)) path = join(path, "index.html");
    try {
      return route.fulfill({
        body: readFileSync(path),
        contentType: MIME[extname(path)] ?? "application/octet-stream",
      });
    } catch {
      return route.fulfill({ status: 404, body: "" });
    }
  }
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    return route.continue();
  }
  return route.abort();
});

/** The post's header scene as a transparent PNG data URL, at card size, or
 *  null for a post with no banner. */
async function scenePlate(post) {
  const site = await siteContext.newPage();
  try {
    await site.goto(`${ORIGIN}${postPath(post)}`, { waitUntil: "load" });
    if ((await site.locator(".post-head__scene .scene").count()) === 0) return null;
    // Everything but the scene goes invisible, and the scene's box becomes the
    // viewport. Its canvas bleeds past that box exactly as it does in the
    // header, so the crop is the one the design shows.
    //
    // ⚠️ The slot is pinned opaque with its fade switched off. The banner
    // fades in, and the site's reduced-motion rule does not remove fades, it
    // shortens every transition to 150ms. Two frames after "ready" the scene
    // was still at 35% opacity, and the first card came out a quarter darker
    // than the page with nothing to say why.
    await site.addStyleTag({
      content: `
        html, body { background: transparent !important; }
        body * { visibility: hidden !important; }
        .post-head__scene, .post-head__scene * { visibility: visible !important; }
        .post-head__scene { position: fixed !important; inset: 0 !important; opacity: 1 !important; }
        .post-head__scene .scene__slot { opacity: 1 !important; transition: none !important; }
      `,
    });
    await site.waitForSelector('.post-head__scene .scene[data-status="ready"]', { timeout: 30_000 });
    // Two frames: one for the resize to land, one for the redraw it triggers.
    await site.evaluate(
      () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
    );
    const png = await site.screenshot({ type: "png", omitBackground: true });
    return `data:image/png;base64,${png.toString("base64")}`;
  } finally {
    await site.close();
  }
}

const logo = `data:image/svg+xml;base64,${readFileSync(
  join(marketing, "public", "Image-Horse-Logo.svg"),
).toString("base64")}`;

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/* The post card, after the design's #og-card. Same tokens as the page, written
 * out as literal oklch like the route card above. Sizes are the design's
 * container units resolved at 1200px wide (1cqw = 12px).
 *
 * Unlike the route cards this one loads Geist and JetBrains Mono. The design
 * is set in them and the card is mostly type, so the system fallback reads
 * as a different card. The script warns if they did not load.
 *
 * The line under the headline is the deck's first clause, up to the em dash.
 * The whole deck runs to four lines of mono at this size and crowds the
 * headline up into the wordmark. */
const postCard = (post, plate) => `<!doctype html>
<html><head><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;700&family=JetBrains+Mono:wght@400;500&display=block">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 1200px; height: 630px; }
  body {
    position: relative; overflow: hidden;
    font-family: "Geist", system-ui, sans-serif;
    color: oklch(95% 0.010 70);
    background:
      radial-gradient(60% 80% at 82% 0%, color-mix(in oklch, oklch(74% 0.220 50) 32%, transparent), transparent 70%),
      radial-gradient(45% 70% at 0% 100%, color-mix(in oklch, oklch(60% 0.220 15) 22%, transparent), transparent 70%),
      oklch(13% 0.018 35);
  }
  .plate { position: absolute; inset: 0; width: 1200px; height: 630px; opacity: 0.9; }
  .scrim {
    position: absolute; inset: 0;
    background: linear-gradient(180deg,
      color-mix(in oklch, oklch(13% 0.018 35) 55%, transparent) 0%,
      transparent 35%, transparent 55%,
      color-mix(in oklch, oklch(13% 0.018 35) 92%, transparent) 100%);
  }
  .card {
    position: absolute; inset: 0;
    display: flex; flex-direction: column; justify-content: space-between;
    padding: 60px 66px;
  }
  .top { display: flex; align-items: center; gap: 14px; }
  .tile {
    display: grid; place-items: center;
    width: 55px; height: 55px; border-radius: 12px;
    background: oklch(95% 0.010 70);
  }
  .tile img { display: block; width: 43px; height: 43px; }
  .mark { font-size: 24px; font-weight: 700; letter-spacing: -0.02em; white-space: nowrap; }
  .pill {
    margin-left: 7px; padding: 4px 11px;
    border: 1px solid oklch(40% 0.025 40); border-radius: 999px;
    font-family: "JetBrains Mono", ui-monospace, monospace;
    font-size: 14px; letter-spacing: 0.1em; text-transform: uppercase;
    color: oklch(78% 0.015 60); white-space: nowrap;
  }
  .words { display: flex; flex-direction: column; gap: 17px; max-width: 78%; }
  h1 {
    font-size: 67px; line-height: 1.02; font-weight: 700; letter-spacing: -0.035em;
    text-wrap: balance;
    text-shadow: 0 2px 24px oklch(13% 0.018 35);
  }
  .dek {
    font-family: "JetBrains Mono", ui-monospace, monospace;
    font-size: 17px; line-height: 1.5; letter-spacing: 0.06em;
    color: oklch(78% 0.015 60);
  }
  .url { color: oklch(74% 0.180 55); }
</style></head>
<body>
  ${plate ? `<img class="plate" src="${plate}" alt="">` : ""}
  <div class="scrim"></div>
  <div class="card">
    <div class="top">
      <span class="tile"><img src="${logo}" alt=""></span>
      <span class="mark">Image Horse</span>
      <span class="pill">Engineering blog</span>
    </div>
    <div class="words">
      <h1>${esc(post.headline)}</h1>
      <p class="dek">${esc(post.deck.split(" — ")[0])} <span class="url">· imagehorse.app/blog</span></p>
    </div>
  </div>
</body></html>`;

mkdirSync(join(outDir, "blog"), { recursive: true });

for (const post of iconsOnly ? [] : POSTS) {
  const plate = await scenePlate(post);
  await page.setViewportSize({ width: 1200, height: 630 });
  await page.setContent(postCard(post, plate), { waitUntil: "load" });
  // Ask for the faces by name rather than trusting `fonts.ready` alone, which
  // can resolve before layout has asked for them. `load` resolves to the faces
  // it found, and to an empty list when the stylesheet never arrived. Not
  // `fonts.check()`: it answers true for a family with no faces at all.
  const fontsLoaded = await page.evaluate(async () => {
    const want = ['700 67px "Geist"', '700 24px "Geist"', '17px "JetBrains Mono"'];
    const got = await Promise.all(want.map((f) => document.fonts.load(f).catch(() => [])));
    return got.every((faces) => faces.length > 0 && faces.every((f) => f.status === "loaded"));
  });
  if (!fontsLoaded) {
    console.warn(
      `  ⚠ og/blog/${post.slug}.png: Geist or JetBrains Mono did not load (offline?). ` +
        `The card was drawn in the system fallback; re-run with a network before committing it.`,
    );
  }
  const file = join(outDir, "blog", `${post.slug}.png`);
  writeFileSync(file, await page.screenshot({ type: "png" }));
  console.log(`  og/blog/${post.slug}.png${plate ? "  (with its header scene)" : ""}`);
}

await siteContext.close();

/* ── icons ────────────────────────────────────────────────────────────────
 * public/favicon.svg stays the favicon — SVG is the better format there and
 * every browser that matters takes it. These PNGs exist for the two places that
 * still refuse SVG: iOS, which shows a blank tile for an SVG apple-touch-icon,
 * and the web app manifest, whose icons Chrome will not use as an install
 * prompt unless at least one is a 192px and one a 512px raster.
 *
 * They are favicon.svg ITSELF, rasterized — the horse on a rounded square of
 * the site's near-black — so the home-screen icon and the tab favicon cannot
 * drift into two designs. (Until 09-21-2026 these were a separately drawn
 * placeholder, a dark square with an orange tile, while the tab had already
 * moved to the horse.) The corners outside the rounded square stay transparent.
 */
const FAVICON_SVG = readFileSync(join(marketing, "public", "favicon.svg"), "utf8");
const icon = (px) => `<!doctype html>
<html><head><meta charset="utf-8"><style>
  * { margin: 0; padding: 0; }
  html, body { width: ${px}px; height: ${px}px; background: transparent; }
  img { display: block; width: ${px}px; height: ${px}px; }
</style></head><body><img src="data:image/svg+xml;base64,${Buffer.from(FAVICON_SVG).toString("base64")}"></body></html>`;

const ICONS = [
  ["apple-touch-icon", 180],
  ["icon-192", 192],
  ["icon-512", 512],
];

for (const [name, px] of postsOnly ? [] : ICONS) {
  await page.setViewportSize({ width: px, height: px });
  await page.setContent(icon(px), { waitUntil: "load" });
  writeFileSync(
    join(marketing, "public", `${name}.png`),
    await page.screenshot({ type: "png", omitBackground: true }),
  );
  console.log(`  ${name}.png`);
}

await browser.close();
