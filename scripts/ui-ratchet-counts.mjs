#!/usr/bin/env node
// The three UI rules a machine can check without reading a sentence as code.
//
// UI Night 7 (docs/UI_CONSISTENCY.md §6): R1 (spacing off the scale), R3 (radius
// that routes around the house tokens) and raw <button> elements outside
// components/ui/. guardrails.sh ratchets the numbers this prints.
//
// ── WHY THIS PARSES INSTEAD OF GREPPING ────────────────────────────────────
// guardrails.sh has gone red twice on PROSE: `role="button"` inside a comment
// explaining the role="button" rule, and the phrase "as any other dependency".
// scripts/ui-inventory.mjs has the same limit and says so — `rounded-square`
// and `z-1` were comments in its first run. A ratchet built on text would
// punish the person who writes the explanation. So this reads the TypeScript
// syntax tree:
//
//   - comments are not nodes, so they cannot be counted at all;
//   - only string literals and template chunks are read for classes, and only
//     the ones that look like a CLASS LIST (see `isClassList`) — a tooltip
//     saying "the rounded shape" is a string, but it is not a class list;
//   - <button> is counted as a JSX element, never as text.
//
// ── WHY THE SELF-TEST ──────────────────────────────────────────────────────
// A zero from a broken counter looks exactly like a zero from clean code. So
// before touching the repo it counts a planted snippet whose answer is known
// (a comment full of violations, a prose string, one real class list, one
// button) and exits 1 if the answer is wrong.
//
// Usage:
//   node scripts/ui-ratchet-counts.mjs           counts, one per line (for guardrails.sh)
//   node scripts/ui-ratchet-counts.mjs --json    the same, machine readable
//   node scripts/ui-ratchet-counts.mjs --list    every hit, file:line and token
import { readdirSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { join, relative } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
// typescript is an app dependency; resolve it the way the app does, so this
// works in a fresh worktree where only app-level install exists.
const ts = createRequire(join(ROOT, "app", "package.json"))("typescript");

const SRC = join(ROOT, "app", "src");
const UI_DIR = join(SRC, "components", "ui");

// R1 — the eight steps of docs/UI_CONSISTENCY.md, plus 0.
const SPACING_SCALE = new Set(["0", "0.5", "1", "1.5", "2", "3", "4", "6", "8"]);
// The same prefixes scripts/ui-inventory.mjs measures, so the two agree.
const SPACING = /^(p|px|py|pt|pb|pl|pr|gap|gap-x|gap-y|space-x|space-y)-(\[[0-9.]+px\]|[0-9]+(?:\.[0-9]+)?)$/;
// R3 — the house radii. Everything else that starts `rounded` routes around
// them: bare `rounded`, `rounded-xl`/`2xl`/`3xl`, arbitrary `rounded-[…]`.
const RADIUS = /^rounded(?:-(?:t|b|l|r|s|e|tl|tr|bl|br|ss|se|es|ee))?(?:-(.+))?$/;
const HOUSE_RADII = new Set(["sm", "md", "lg", "full", "none"]);

// Utilities that carry no dash. Used only to decide whether a string is a
// class list at all; a missing one just makes a string look less class-like.
const BARE_UTILITIES = new Set(
  ("flex grid block inline hidden contents relative absolute fixed sticky static " +
    "truncate italic underline uppercase lowercase capitalize border rounded shadow " +
    "ring outline grow shrink transition transform isolate invisible visible " +
    "container prose group peer antialiased").split(" "),
);

/** Drop variant prefixes (`md:`, `hover:`, `[&>svg]:`), `!important` and a
 *  leading negative, leaving the utility itself. */
function bareUtility(token) {
  let depth = 0;
  let cut = 0;
  for (let i = 0; i < token.length; i++) {
    const c = token[i];
    if (c === "[") depth++;
    else if (c === "]") depth--;
    else if (c === ":" && depth === 0) cut = i + 1;
  }
  return token.slice(cut).replace(/^!/, "").replace(/^-/, "");
}

const CLASS_TOKEN = /^[!a-z0-9:\[\]\-_.\/%()#,=&>*+~@'"]+$/;
/** A class list: every token is class-shaped, and most of them are utilities.
 *  "rounded p-3 bg-card" is one; "the rounded shape" is not (1 of 3). */
export function isClassList(s) {
  const tokens = s.trim().split(/\s+/).filter(Boolean);
  if (!tokens.length) return false;
  if (!tokens.every((t) => CLASS_TOKEN.test(t))) return false;
  const util = tokens.filter((t) => {
    const u = bareUtility(t);
    return u.includes("-") || BARE_UTILITIES.has(u);
  }).length;
  return util / tokens.length >= 0.6;
}

/** Every violation in one source text. `file` is only used in reports. */
export function countSource(text, file, { isUi = false } = {}) {
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const hits = { spacing: [], radius: [], button: [] };
  const line = (pos) => sf.getLineAndCharacterOfPosition(pos).line + 1;

  const readClasses = (s, pos) => {
    if (!isClassList(s)) return;
    for (const token of s.trim().split(/\s+/)) {
      const u = bareUtility(token);
      const sp = SPACING.exec(u);
      if (sp && !SPACING_SCALE.has(sp[2])) hits.spacing.push({ file, line: line(pos), token });
      const r = RADIUS.exec(u);
      if (r && !HOUSE_RADII.has(r[1] ?? "")) hits.radius.push({ file, line: line(pos), token });
    }
  };

  // A one-word string can be a class list ("rounded") or a plain value that
  // happens to be spelled like one. UI Night 8 found six of the second kind,
  // all the Text tool's corner presets: `type CornerId = "circle" | "rounded"`,
  // `{ id: "rounded", label: "Rounded" }` and `r <= 0 ? "square" : "rounded"`.
  // Renaming them to `rounded-sm` would have broken the presets, and they are
  // not radius uses at all. Three contexts are values, never classes:
  //   - a string in a TYPE (a literal type),
  //   - the value of an `id:` / `key:` / `value:` property,
  //   - a branch of a ternary whose other string branch is not a class list.
  const isValueString = (node) => {
    const p = node.parent;
    if (!p) return false;
    if (ts.isLiteralTypeNode(p)) return true;
    if (ts.isPropertyAssignment(p) && p.initializer === node) {
      const name = p.name.getText().replace(/["']/g, "");
      if (name === "id" || name === "key" || name === "value") return true;
    }
    if (ts.isConditionalExpression(p)) {
      const other = p.whenTrue === node ? p.whenFalse : p.whenTrue;
      const sib = ts.isConditionalExpression(other) ? [other.whenTrue, other.whenFalse] : [other];
      if (sib.some((s) => ts.isStringLiteral(s) && s.text.trim() !== "" && !isClassList(s.text))) return true;
    }
    // The tail of a chained ternary: `a ? "square" : b ? "circle" : "rounded"`.
    if (ts.isConditionalExpression(p) && ts.isConditionalExpression(p.parent) && p.parent.whenFalse === p) {
      const head = p.parent.whenTrue;
      if (ts.isStringLiteral(head) && head.text.trim() !== "" && !isClassList(head.text)) return true;
    }
    return false;
  };

  const visit = (node) => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      if (!isValueString(node)) readClasses(node.text, node.getStart());
    } else if (ts.isTemplateExpression(node)) {
      readClasses(node.head.text, node.head.getStart());
      for (const span of node.templateSpans) readClasses(span.literal.text, span.literal.getStart());
    } else if (ts.isJsxText(node)) {
      // Visible copy, never classes.
    } else if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && !isUi) {
      if (node.tagName.getText() === "button") hits.button.push({ file, line: line(node.getStart()), token: "<button>" });
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return hits;
}

// ── self-test: a planted snippet with a known answer ─────────────────────────
{
  const planted = `
    // rounded p-5 rounded-xl <button> — a comment full of violations
    /* gap-7 rounded */
    const tip = "the rounded shape is a square";          // prose, not a class list
    const cls = "rounded p-5 gap-2 rounded-lg md:px-[13px]"; // 3 hits: rounded, p-5, px-[13px]
    export const A = () => <div className={\`flex \${cls} rounded-xl\`}><button>go</button></div>;
    type Corner = "circle" | "rounded" | "square";          // a type, not a class
    const OPTS = [{ id: "rounded", label: "Rounded" }];     // an id, not a class
    const pick = (r) => r <= 0 ? "square" : r >= 200 ? "circle" : "rounded"; // values
    const pick2 = (on) => on ? "rounded" : "square";        // value, head of the ternary
    const real = (on) => on ? "rounded" : "";              // a REAL class: counts (+1 radius)
  `;
  const h = countSource(planted, "planted.tsx");
  const got = { spacing: h.spacing.length, radius: h.radius.length, button: h.button.length };
  const want = { spacing: 2, radius: 3, button: 1 };
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    console.error(`FATAL: self-test failed — wanted ${JSON.stringify(want)}, got ${JSON.stringify(got)}`);
    console.error(JSON.stringify(h, null, 2));
    process.exit(1);
  }
}

// ── the repo ─────────────────────────────────────────────────────────────────
function* sources(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name === "node_modules" || name === "__fixtures__") continue;
      yield* sources(p);
    } else if (/\.(ts|tsx)$/.test(name) && !/\.(test|spec)\.tsx?$/.test(name) && !name.endsWith(".d.ts")) {
      yield p;
    }
  }
}

const all = { spacing: [], radius: [], button: [] };
let files = 0;
for (const p of sources(SRC)) {
  files++;
  const rel = relative(ROOT, p);
  const h = countSource(readFileSync(p, "utf8"), rel, { isUi: p.startsWith(UI_DIR + "/") });
  for (const k of Object.keys(all)) all[k].push(...h[k]);
}
if (files < 100) {
  console.error(`FATAL: only ${files} source files found under app/src — the walk is broken.`);
  process.exit(1);
}

const counts = { "ui-spacing": all.spacing.length, "ui-radius": all.radius.length, "ui-raw-button": all.button.length };
if (process.argv.includes("--json")) {
  console.log(JSON.stringify({ files, ...counts }, null, 2));
} else if (process.argv.includes("--list")) {
  for (const [k, list] of [["spacing", all.spacing], ["radius", all.radius], ["button", all.button]])
    for (const h of list) console.log(`${k}\t${h.file}:${h.line}\t${h.token}`);
} else {
  for (const [k, v] of Object.entries(counts)) console.log(`${k} ${v}`);
}
