#!/usr/bin/env node
// Find utility classes referenced in source that emit NO CSS rule at all.
//
// THE BUG THIS EXISTS FOR. Tailwind v4 mints a utility only from a token that
// exists. Write `bg-theme-nope` and you get no rule, no warning, and an element
// with no background. Nothing in this repo can see it: tsc does not read class
// strings, eslint does not either, the build succeeds, and the deploy sentinel
// only weighs the wasm. It was found by hand in 2026-09-09 (#96) because a
// source comment happened to name four suspects — thirteen inert class
// references across five files, one of them an input that had silently had no
// fill for weeks.
//
// A colour utility is the dangerous kind. A missing SPACING utility is obvious
// the moment you look at the page; a missing COLOUR utility inherits something
// plausible in one theme and reads as a deliberate choice in the other. That is
// why this only checks colour-carrying prefixes.
//
// ⚠️ NOT WIRED INTO CI, deliberately. It needs a production build to read the
// emitted CSS, which `guardrails.sh` (a fast grep ratchet) is not allowed to
// depend on. It also cannot tell a class from prose — see ALLOW below — and a
// blocking gate that goes red on a comment is the exact failure CLAUDE.md
// already documents for guardrails. Run it by hand after `pnpm run build`.
//
// ⚠️ THE MISTAKE THAT MAKES THIS SCRIPT WRONG. The first version stripped
// variants (`dark:`, `hover:`, `focus:`) before looking for a rule, and
// reported 24 findings of which 21 were the stripping. Tailwind emits
// `dark:bg-zinc-700` as `.dark\:bg-zinc-700`; the BARE `.bg-zinc-700` is
// correctly absent when nothing uses the bare form. Keep variants intact and
// escape the selector the way Tailwind escapes it.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, extname } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const SRC = join(ROOT, "app/src");
const ASSETS = join(ROOT, "www-dist/assets");

// Colour-carrying utilities only. See the header for why.
const PREFIXES = new Set([
  "bg", "text", "border", "ring", "fill", "stroke", "outline",
  "decoration", "placeholder", "caret", "accent", "shadow",
  "divide", "from", "via", "to",
]);

// Strings that look like a utility class but are prose or an identifier. Each
// entry must say WHY, so the list cannot quietly become a place to hide real
// findings. This is the script's one unavoidable weakness: it reads text.
const ALLOW = new Map([
  ["border-carries-state", "prose — a comment explaining that the border carries selection state"],
  ["ring-vs-box", "prose — a comment contrasting ring hit-testing with box hit-testing"],
  ["text-annotations-changed", "a window CustomEvent name (CLAUDE.md Stage 3 is removing it)"],
  ["text-to-image", "prose — the job type the AI dialog does not have yet"],
]);

function sourceFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...sourceFiles(p));
    else if ([".ts", ".tsx"].includes(extname(p))) out.push(p);
  }
  return out;
}

let css;
try {
  const sheets = readdirSync(ASSETS)
    .filter((f) => f.endsWith(".css"))
    .map((f) => join(ASSETS, f));
  if (!sheets.length) throw new Error("no .css in www-dist/assets");
  // Newest wins — a stale sheet would report phantom findings.
  sheets.sort((a, b) => statSync(a).mtimeMs - statSync(b).mtimeMs);
  css = readFileSync(sheets.at(-1), "utf8");
} catch (e) {
  // FAIL CLOSED. Reporting "0 inert classes" because the build is missing is
  // worse than reporting nothing — it is a green that means nothing.
  console.error(`inert-class-audit: cannot read the built CSS (${e.message}).`);
  console.error("Run `pnpm run build` first — this audit reads the EMITTED css.");
  process.exit(2);
}

const CANDIDATE = /[A-Za-z][A-Za-z0-9:_./-]*/g;
const files = sourceFiles(SRC);
const seen = new Map();

for (const f of files) {
  const text = readFileSync(f, "utf8");
  for (const raw of text.match(CANDIDATE) ?? []) {
    const base = raw.split(":").at(-1);
    const head = base.split("-")[0];
    if (!PREFIXES.has(head)) continue;
    const rest = base.slice(head.length + 1);
    // A single-word utility (bg-white, text-sm) is a Tailwind built-in; the
    // interesting case is <prefix>-<token>, which is where a token can be absent.
    if (!rest || !rest.split("/")[0].includes("-")) continue;
    if (!seen.has(raw)) seen.set(raw, new Set());
    seen.get(raw).add(relative(SRC, f));
  }
}

const escapeSel = (c) => c.replace(/[:/.]/g, (m) => "\\" + m);
const emitted = (cls) =>
  new RegExp("\\." + escapeSel(cls).replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?![\\w\\\\-])").test(css);

const inert = [...seen.entries()]
  .filter(([c]) => !emitted(c) && !ALLOW.has(c))
  .sort(([a], [b]) => a.localeCompare(b));

console.log(`scanned ${files.length} source files`);
console.log(`colour-utility candidates: ${seen.size}  ·  allowlisted: ${ALLOW.size}`);

if (!inert.length) {
  console.log("\nNo inert colour utilities. TOTAL: 0");
  process.exit(0);
}

console.log(`\nREFERENCED BUT NO CSS RULE EMITTED — these render nothing:`);
for (const [cls, fs] of inert) {
  console.log(`  ${cls}`);
  for (const f of [...fs].slice(0, 4)) console.log(`      ${f}`);
}
console.log(`\nTOTAL: ${inert.length}`);
console.log("If one is prose rather than a class, add it to ALLOW with a reason.");
process.exit(1);
