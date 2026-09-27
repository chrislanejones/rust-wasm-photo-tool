#!/usr/bin/env node
/**
 * Every link and button on the marketing site, measured against WCAG 2.1 AA
 * from COMPUTED styles in a real browser.
 *
 * ── why this exists ──────────────────────────────────────────────────────
 * Two specificity traps shipped, and neither was visible to anything we run.
 * The shape:
 *
 *     .post a       { color: var(--color-accent); }   (0,1,1)  ← a class + an element
 *     .cta--fill    { color: var(--color-accent-ink); } (0,1,0) ← a lone class
 *
 * The container rule WINS. So a filled amber button dropped inside `.post`
 * inherited the link's amber and rendered amber-on-amber: "Open the beta" at
 * the foot of both blog posts, at a contrast ratio of **1.00** — text that is
 * exactly as visible as the button behind it.
 *
 * Nothing caught it. tsc does not read CSS. eslint does not read CSS.
 * `guardrails.sh` greps for raw hex, and every colour here is a token. The
 * `inert-class-audit` asks whether a class emits any rule at all — this one
 * emitted a rule and lost a cascade fight. The bug is not in any file: it is
 * in the RELATIONSHIP between two files, and only the rendered page has it.
 *
 * So the check has to be a browser, and it has to be every page: the same
 * button is fine on /pricing and invisible inside `.post`.
 *
 * ── what it does NOT do ──────────────────────────────────────────────────
 * It does not look for the specificity pattern. Searching for a known shape
 * only finds that shape; measuring the result finds whatever actually went
 * wrong, including causes nobody has thought of yet.
 *
 * Usage:
 *   node scripts/check-contrast.mjs                     # against the live site
 *   node scripts/check-contrast.mjs http://127.0.0.1:N  # against a local preview
 *
 * Exits 1 on any failure. Read its own exit code — never through a pipe.
 */
import { chromium } from "@playwright/test";

const BASE = process.argv[2] || "https://imagehorse.app";

/** Every page in the sitemap, plus the two posts. Kept as a literal list so a
 *  page that stops being generated shows up as a load failure rather than
 *  silently dropping out of the sweep. */
const PAGES = [
  "/", "/architecture", "/blog", "/features", "/openraster", "/what-is-ora",
  "/ora-to-png", "/ora-to-psd", "/pricing", "/about", "/trail-log", "/contact",
  "/privacy-policy", "/terms-of-service", "/in-the-works", "/photo-editor",
  "/image-compressor", "/background-remover", "/remove-object-from-photo",
  "/annotate-image", "/clone-stamp", "/pixelate-image", "/blur-image",
  "/batch-image-editor", "/image-editor-no-upload",
  "/blog/offline-by-construction", "/blog/engine-in-a-worker",
];

/* Runs in the page. Resolves colours through a canvas so oklch(), color-mix()
   and every other modern syntax arrive as sRGB — reading the token text and
   doing the maths here would just reimplement the browser, badly. */
const AUDIT = `(() => {
  const srgb = (css) => {
    const c = document.createElement("canvas"); c.width = c.height = 1;
    const x = c.getContext("2d");
    x.clearRect(0, 0, 1, 1); x.fillStyle = css; x.fillRect(0, 0, 1, 1);
    const d = x.getImageData(0, 0, 1, 1).data;
    return { r: d[0], g: d[1], b: d[2], a: d[3] / 255 };
  };
  const lum = ({ r, g, b }) => {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const out = [];
  for (const el of document.querySelectorAll("a, button")) {
    const rect = el.getBoundingClientRect();
    if (rect.width < 4 || rect.height < 4) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.display === "none") continue;
    // Hidden-until-hover controls are measured when they are shown, not here.
    if (parseFloat(cs.opacity) < 0.5) continue;
    if (!el.textContent.trim()) continue;

    // The first ANCESTOR with an opaque background is what the text sits on —
    // the element's own background is usually transparent.
    let bgEl = el, bg = null;
    while (bgEl) { const c = srgb(getComputedStyle(bgEl).backgroundColor); if (c.a > 0.5) { bg = c; break; } bgEl = bgEl.parentElement; }
    if (!bg) bg = { r: 255, g: 255, b: 255, a: 1 };

    const fg = srgb(cs.color);
    const mix = { r: fg.r * fg.a + bg.r * (1 - fg.a), g: fg.g * fg.a + bg.g * (1 - fg.a), b: fg.b * fg.a + bg.b * (1 - fg.a) };
    const L1 = lum(mix), L2 = lum(bg);
    const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);

    // AA: 4.5:1, or 3:1 for large text (>=24px, or >=18.66px bold).
    const px = parseFloat(cs.fontSize);
    const large = px >= 24 || (parseInt(cs.fontWeight, 10) >= 700 && px >= 18.66);
    const floor = large ? 3 : 4.5;
    if (ratio < floor) {
      out.push({ text: el.textContent.trim().replace(/\\s+/g, " ").slice(0, 40),
                 cls: el.className.toString().slice(0, 44),
                 ratio: Math.round(ratio * 100) / 100, floor,
                 fg: cs.color, bg: getComputedStyle(bgEl).backgroundColor });
    }
  }
  return out;
})()`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

let failed = 0, checked = 0;
for (const path of PAGES) {
  const url = BASE + path;
  try {
    const res = await page.goto(url, { waitUntil: "load", timeout: 30000 });
    if (!res || res.status() >= 400) {
      console.log(`  FAIL  ${url} — HTTP ${res ? res.status() : "no response"}`);
      failed++; continue;
    }
  } catch (err) {
    console.log(`  FAIL  ${url} — ${err.message.split("\n")[0]}`);
    failed++; continue;
  }
  await page.waitForTimeout(300);
  const bad = await page.evaluate(AUDIT);
  checked++;
  if (bad.length === 0) {
    console.log(`  ok    ${path}`);
  } else {
    failed++;
    console.log(`  FAIL  ${path} — ${bad.length} under AA`);
    for (const b of bad) {
      console.log(`          "${b.text}"  ${b.ratio}:1 (needs ${b.floor})  .${b.cls}`);
      console.log(`          ${b.fg} on ${b.bg}`);
    }
  }
}

await browser.close();
console.log(`\n${checked} pages checked, ${failed} failed.`);
process.exit(failed ? 1 : 0);
