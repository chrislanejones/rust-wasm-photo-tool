// Ships the marketing site's FULL stylesheet set into the design bundle's CSS
// closure, in the site's own order.
//
// ── why this exists ───────────────────────────────────────────────────────
// Rendered designs receive only the transitive @import closure of the uploaded
// styles.css. The site does not have one: main.tsx imports SEVENTEEN
// stylesheets side by side, and the converter copies exactly one of them
// (cfg.cssEntry -> _ds_bundle.css). Everything else was missing from the
// closure, and the failure is quiet — the design renders, just unstyled in
// patches. Measured on the preview cards: NextCards came out as a bulleted
// list and Pager as "1. 2. 3." because .tp-next and .pager live in
// tool-page.css and pager.css. The same hole had already eaten tokens.css:
// 79 custom properties referenced and undefined, i.e. no color, type scale or
// spacing anywhere.
//
// cfg.tokensGlob cannot do this (copyTokens() returns early unless the tokens
// live in a node_modules PACKAGE, and ours are repo-local source), and
// pointing cfg.cssEntry at a wrapper is worse — the converter treats the entry
// as the sheet to COPY, so styles.css came out as the 28-byte wrapper and all
// 158 KB of real CSS vanished.
//
// So: read the list from main.tsx (the site's own source of truth, so a new
// stylesheet is picked up without editing this file), copy each one in, and
// write styles.css as a pure @import manifest in that same order. Order is
// load-bearing — animations.css is imported last on purpose so its
// reduced-motion overrides win the cascade.
//
// ── and the font urls ─────────────────────────────────────────────────────
// tokens.css holds all ten @font-face rules and every src is ABSOLUTE —
// url(/fonts/geist-latin-v5.woff2) — which is right for the site, where Vite
// serves public/ at the root. The bundle has no root: cfg.extraFonts copies
// the woff2 files to ds-bundle/fonts/, a sibling of the stylesheets, so an
// absolute url resolves to nothing on the design host. That is the
// FONT_DANGLING warning, and it too fails quietly — the design just renders in
// a system font. `./fonts/` resolves against the stylesheet's own URL, so it
// is correct wherever the bundle is mounted.
//
// RUN THIS AFTER EVERY package-build.mjs RUN — a rebuild overwrites styles.css.
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";

const OUT = process.argv[2] ?? "./ds-bundle";
const SRC = "marketing/src";
const MAIN = join(SRC, "main.tsx");

// The site's own import order, read from the file that defines it.
const order = [...readFileSync(MAIN, "utf8").matchAll(/^import\s+"\.\/([^"]+\.css)";/gm)].map((m) => m[1]);
if (order.length < 2) {
  console.error(`no css imports found in ${MAIN} — has the import style changed?`);
  process.exit(1);
}

// cfg.cssEntry is already copied by the converter, under its own name.
const ENTRY = "styles.css";
const entryAs = "./_ds_bundle.css";

let fontRefs = 0;
const imports = [];
for (const name of order) {
  if (name === ENTRY) { imports.push(entryAs); continue; }
  const from = join(SRC, name);
  if (!existsSync(from)) { console.error(`missing: ${from}`); process.exit(1); }
  let css = readFileSync(from, "utf8");
  const refs = [...css.matchAll(/url\(\/fonts\/([^)]+)\)/g)].map((m) => m[1]);
  fontRefs += refs.length;
  // A rewritten url that points at a file nobody copied is the same silent
  // failure with a different cause, so name the missing file instead.
  const missing = [...new Set(refs)].filter((f) => !existsSync(join(OUT, "fonts", basename(f))));
  if (missing.length) {
    console.error(`MISSING from ${OUT}/fonts/ — add to cfg.extraFonts: ${missing.join(", ")}`);
    process.exit(1);
  }
  css = css.replace(/url\(\/fonts\//g, "url(./fonts/");
  writeFileSync(join(OUT, name), css);
  imports.push(`./${name}`);
}

// The converter puts its own component CSS first; keep it in the closure even
// if main.tsx's list somehow loses the entry sheet.
if (!imports.includes(entryAs)) imports.unshift(entryAs);

writeFileSync(join(OUT, ENTRY), imports.map((p) => `@import "${p}";`).join("\n") + "\n");
console.log(`styles.css: ${imports.length} sheets in site order (${fontRefs} font urls made relative)`);
