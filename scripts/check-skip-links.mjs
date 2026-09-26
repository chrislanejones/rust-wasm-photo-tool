#!/usr/bin/env node
// Every page's skip link, checked the way a keyboard user meets it.
//
//   node scripts/check-skip-links.mjs                 # live: sitemap + a 404 + the editor
//   node scripts/check-skip-links.mjs <url> [<url>…]  # just these (a local preview, say)
//
// Part of the git routine's hosting check (step 5), after the deploy is live.
//
// Per page, four things, all required:
//   1. the FIRST Tab lands on a skip link (an in-page `#` link),
//   2. it is visible when focused (on screen, not 0×0),
//   3. its target id exists,
//   4. Enter moves focus to the target, or the next Tab lands inside it.
//
// Why 4 is "or": the editor's target is `<main id="main-canvas" tabindex="-1">`
// and holds nothing tabbable, so Enter correctly focuses <main> itself and the
// next Tab leaves it. The marketing pages' `#main` holds links, so the next Tab
// lands inside. Both are a working skip link; requiring only the second failed
// the editor falsely (09-25-2026).
//
// A link whose target is missing is the failure this exists for: it looks
// fine, it is announced, and it goes nowhere. Nothing else in the repo would
// notice — tsc, lint, the build and guardrails all pass on a dead `href`.
//
// Exit 1 on any failure, and on zero pages checked: a check that checked
// nothing has not passed.
import { chromium } from "@playwright/test";

const SITE = "https://imagehorse.app";
const EDITOR = "https://edit.imagehorse.app/";

async function defaultUrls() {
  const xml = await (await fetch(`${SITE}/sitemap.xml`)).text();
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  return [...locs, `${SITE}/skip-link-check-404`, EDITOR];
}

const urls = process.argv.length > 2 ? process.argv.slice(2) : await defaultUrls();
const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
);

const rows = [];
for (const url of urls) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto(url, { waitUntil: "networkidle" }).catch(() => {});
  await page.waitForTimeout(1000);
  await page.keyboard.press("Tab");
  const link = await page.evaluate(() => {
    const a = document.activeElement;
    const r = a?.getBoundingClientRect();
    return {
      text: a?.textContent?.trim().slice(0, 40) ?? "",
      href: a?.getAttribute("href") ?? "",
      visible: !!r && r.width > 1 && r.height > 1 && r.bottom > 0 && r.top < innerHeight,
    };
  });
  const id = link.href.startsWith("#") && link.href.length > 1 ? link.href.slice(1) : null;
  const inTarget = (tid) => {
    const t = document.getElementById(tid);
    const a = document.activeElement;
    return !!t && (t === a || t.contains(a));
  };
  const exists = id ? await page.evaluate((tid) => !!document.getElementById(tid), id) : false;
  let reaches = false;
  if (exists) {
    await page.keyboard.press("Enter");
    await page.waitForTimeout(200);
    reaches = await page.evaluate(inTarget, id);
    if (!reaches) {
      await page.keyboard.press("Tab");
      reaches = await page.evaluate(inTarget, id);
    }
  }
  const ok = !!id && link.visible && exists && reaches;
  rows.push({ url, ok, link: link.text, target: id, visible: link.visible, exists, reaches });
  await page.close();
}
await browser.close();

for (const r of rows) {
  const why = r.ok
    ? ""
    : `  ← ${!r.target ? `first Tab is not a skip link ("${r.link}")` : !r.visible ? "not visible on focus" : !r.exists ? `#${r.target} does not exist` : `focus never reaches #${r.target}`}`;
  console.log(`${r.ok ? "  ok  " : "  FAIL"}  ${r.url}  → ${r.target ? `#${r.target}` : "-"}${why}`);
}
const failed = rows.filter((r) => !r.ok).length;
console.log(`\n${rows.length} pages, ${rows.length - failed} ok, ${failed} failed.`);
process.exit(rows.length === 0 || failed > 0 ? 1 : 0);
