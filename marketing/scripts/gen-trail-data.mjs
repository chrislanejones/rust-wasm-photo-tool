#!/usr/bin/env node
// Regenerates the marketing site's DERIVED data from the repo itself.
//
//   src/data/commits.ts   ← `git log` at the repo root   (the Trail Log squares)
//   src/data/features.ts  ← docs/Features.md             (the /features list)
//
// Run it as part of the release routine, from anywhere:
//
//   node marketing/scripts/gen-trail-data.mjs
//
// Why this is a script and not a hand-edit: both files are counts and lists that
// exist somewhere else already. Typed by hand they go stale silently — the graph
// keeps drawing last month's squares and nobody notices, because a wrong number
// looks exactly like a right one. Generated, they can only ever be wrong if the
// source is wrong.
//
// src/data/releases.ts is NOT generated. It's the changelog — prose, written per
// release — so it stays hand-maintained. This script never touches it.

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..", "..");
const out = (p) => resolve(here, "..", "src", "data", p);
const q = (s) => JSON.stringify(s);

// ── commits.ts ──────────────────────────────────────────────────────────
// One line per commit, authored-date in the repo's own local calendar. %ad
// (author date) rather than %cd, so a rebase doesn't relocate a day's work.
const log = execFileSync(
  "git",
  ["log", "--date=format:%Y-%m-%d", "--pretty=format:%ad"],
  { cwd: root, encoding: "utf8" },
);

const perDay = {};
for (const day of log.split("\n").filter(Boolean)) {
  perDay[day] = (perDay[day] || 0) + 1;
}

const days = Object.keys(perDay).sort();
const total = days.reduce((n, d) => n + perDay[d], 0);

let c = `// GENERATED — do not edit. Run: node marketing/scripts/gen-trail-data.mjs
//
// Commits per day, from \`git log\` at the repo root. This is what draws the
// contribution squares on /trail-log: the release log counts releases, git
// counts the work that went into them.
//
// ${total} commits across ${days.length} active days, ${days[0]} → ${days[days.length - 1]}.

export const COMMITS: Record<string, number> = {
`;
for (const d of days) c += `  ${q(d)}: ${perDay[d]},\n`;
c += `};\n`;
writeFileSync(out("commits.ts"), c);
console.log(
  `commits.ts  ${total} commits · ${days.length} active days · ${days[0]} → ${days[days.length - 1]}`,
);

// ── features.ts ─────────────────────────────────────────────────────────
// docs/Features.md is "### Group" headings over "- **Name** — body" bullets.
const md = readFileSync(resolve(root, "docs", "Features.md"), "utf8");

// Rendered as text, so markdown emphasis has to come out or it shows literally.
const plain = (s) =>
  s
    .replace(/\*\*(.+?)\*\*/g, "$1") // bold
    .replace(/`(.+?)`/g, "$1") // code
    .replace(/\[(.+?)\]\((.+?)\)/g, "$1") // links → their text
    .trim();

const groups = [];
let group = null;
for (const line of md.split("\n")) {
  const head = line.match(/^###\s+(.+?)\s*$/);
  if (head) {
    group = { name: plain(head[1]), items: [] };
    groups.push(group);
    continue;
  }
  // The separator is an em dash, and only the FIRST one splits name from body —
  // bodies use em dashes as punctuation too.
  const item = line.match(/^-\s+\*\*(.+?)\*\*\s+—\s+(.+)$/);
  if (item && group) {
    group.items.push({ name: plain(item[1]), body: plain(item[2]) });
  }
}

const kept = groups.filter((g) => g.items.length);
if (!kept.length) {
  console.error("gen-trail-data: parsed 0 features from docs/Features.md — refusing to write an empty list.");
  process.exit(1);
}
const featureCount = kept.reduce((n, g) => n + g.items.length, 0);

let f = `// GENERATED — do not edit. Run: node marketing/scripts/gen-trail-data.mjs
//
// The feature list, from docs/Features.md — the repo's own canonical list.
// ${featureCount} features across ${kept.length} groups.

export interface Feature {
  name: string;
  body: string;
}

export interface FeatureGroup {
  name: string;
  items: Feature[];
}

export const FEATURES: FeatureGroup[] = [
`;
for (const g of kept) {
  f += `  {\n    name: ${q(g.name)},\n    items: [\n`;
  for (const i of g.items) f += `      { name: ${q(i.name)}, body: ${q(i.body)} },\n`;
  f += `    ],\n  },\n`;
}
f += `];\n`;
writeFileSync(out("features.ts"), f);
console.log(
  `features.ts ${featureCount} features · ${kept.map((g) => `${g.name} (${g.items.length})`).join(" · ")}`,
);
