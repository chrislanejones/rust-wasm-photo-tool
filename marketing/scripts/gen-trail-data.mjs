#!/usr/bin/env node
// Regenerates the marketing site's DERIVED data from the repo itself.
//
//   src/data/commits.ts   ← `git log master`             (the Trail Log squares)
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
//
// Counted from RELEASE_REF, never from bare HEAD. The squares record what
// shipped, and shipped means merged. Reading HEAD made the output depend on
// which working tree the script happened to run in: from a feature worktree it
// counted unmerged commits as shipped; from the main tree mid-release it missed
// the very commits being released. Both fail silently — the graph draws a wrong
// number, and a wrong number looks exactly like a right one. An explicit ref
// gives the same answer from every worktree.
const RELEASE_REF = (() => {
  for (const ref of ["master", "main"]) {
    try {
      execFileSync("git", ["rev-parse", "--verify", "--quiet", `${ref}^{commit}`], {
        cwd: root,
        stdio: "ignore",
      });
      return ref;
    } catch {
      // not this one — try the next
    }
  }
  return "HEAD"; // detached head, or a clone with neither branch: count what's here
})();

const log = execFileSync(
  "git",
  ["log", RELEASE_REF, "--date=format:%Y-%m-%d", "--pretty=format:%ad"],
  { cwd: root, encoding: "utf8" },
);

// Running before the merge is legitimate — the release routine regenerates
// while the release commit is still on a branch. But the output lags until the
// merge lands, so say so out loud. The whole reason this file is generated is
// that staleness must not be able to hide.
const unmerged = Number(
  execFileSync("git", ["rev-list", "--count", `${RELEASE_REF}..HEAD`], {
    cwd: root,
    encoding: "utf8",
  }).trim(),
);
if (unmerged > 0) {
  console.warn(
    `gen-trail-data: WARNING — ${unmerged} commit(s) on HEAD are not in ${RELEASE_REF}.\n` +
      `  They will not appear as squares until merged. Re-run after the merge.`,
  );
}

const perDay = {};
for (const day of log.split("\n").filter(Boolean)) {
  perDay[day] = (perDay[day] || 0) + 1;
}

const days = Object.keys(perDay).sort();
const total = days.reduce((n, d) => n + perDay[d], 0);

let c = `// GENERATED — do not edit. Run: node marketing/scripts/gen-trail-data.mjs
//
// Commits per day, from \`git log ${RELEASE_REF}\` — the merged history, not the
// current worktree's HEAD. This is what draws the contribution squares on
// /trail-log: the release log counts releases, git counts the work that went
// into them.
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

// ── app/src/lib/celebrationStats.ts ─────────────────────────────────────
// The in-app celebration popper (Ctrl/Cmd + \) counts what shipped this
// month. Those numbers were hard-coded in the component and drifted a full
// month — July's figures were still showing on 2026-08-30, five releases and
// 96 August releases later.
//
// The component's own header comment had already predicted it: "re-derive
// rather than guess", and "the release being cut has to be IN releases.ts
// before these are counted, or the popper ships a release behind its own
// changelog". It was never automated, so the warning aged into the bug it
// described. Deriving it here rather than adding a step to the git routine is
// deliberate: a routine step is a rule that depends on someone following it,
// and this repo already has several documented-rule-vs-reality drifts.
//
// This is the ONLY output that leaves the marketing package. It reads
// releases.ts (hand-written prose, the changelog) and writes a small typed
// constant into the app — the app must not import across the package
// boundary, so the numbers are copied at generate time instead.
const releasesSrc = readFileSync(resolve(here, "..", "src", "data", "releases.ts"), "utf8");

// Split on the release-object boundary. Each block starts at `version:`.
const relBlocks = releasesSrc.split(/\n  \{\n    version: /).slice(1);
const releases = relBlocks
  .map((b) => {
    const version = (b.match(/^"([^"]+)"/) || [])[1];
    const date = (b.match(/date: "([\d-]+)"/) || [])[1];
    const headline = (b.match(/headline: "((?:[^"\\]|\\.)*)"/) || [])[1];
    const tags = [...b.matchAll(/tag: "(\w+)"/g)].map((m) => m[1]);
    return version && date ? { version, date, headline, tags } : null;
  })
  .filter(Boolean);

if (releases.length === 0) {
  throw new Error(
    "gen-trail-data: parsed 0 releases out of releases.ts — the object shape changed. " +
      "Fix the parser rather than shipping a zeroed popper.",
  );
}

const allTime = releases.reduce((n, r) => n + r.tags.length, 0);
// Newest release wins the month — the popper is about what just shipped.
const latest = releases.reduce((a, b) => (a.date >= b.date ? a : b));
const monthKey = latest.date.slice(0, 7);
const monthRels = releases.filter((r) => r.date.startsWith(monthKey));
const monthEntries = monthRels.reduce((n, r) => n + r.tags.length, 0);
const monthTags = {};
for (const r of monthRels) for (const t of r.tags) monthTags[t] = (monthTags[t] ?? 0) + 1;

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const monthName = MONTH_NAMES[parseInt(monthKey.slice(5, 7), 10) - 1];

let s = `// GENERATED — do not edit. Run: node marketing/scripts/gen-trail-data.mjs
//
// Shipping stats for the in-app celebration popper (Ctrl/Cmd + \\), derived
// from marketing/src/data/releases.ts — the hand-written trail log.
//
// ${monthName} ${monthKey.slice(0, 4)}: ${monthEntries} entries across ${monthRels.length} releases,
// against ${allTime} all-time. Latest release ${latest.version} (${latest.date}).
//
// The headline numbers are ENTRIES and RELEASES, never the feature count. A
// month can ship more than the one before it and carry fewer \`feature\` tags —
// ${monthName} did exactly that, because the work landed as infrastructure and
// fixes. Leading with features would have made the busiest month in the log
// read as the quietest.

export interface CelebrationStats {
  /** Month the newest release falls in, e.g. "August". */
  month: string;
  /** Trail-log entries logged this month — the headline number. */
  monthShipped: number;
  /** Releases cut this month. */
  releases: number;
  /** Trail-log entries all time. */
  allTime: number;
  /** This month as a whole-number percentage of all time. */
  monthPct: number;
  /** \`tag: "feature"\` entries this month — a secondary chip, not the headline. */
  features: number;
  /** \`tag: "fix"\` entries this month. */
  fixes: number;
  /** Newest release in the log, e.g. "v8.57". */
  latestVersion: string;
}

export const CELEBRATION_STATS: CelebrationStats = {
  month: ${q(monthName)},
  monthShipped: ${monthEntries},
  releases: ${monthRels.length},
  allTime: ${allTime},
  monthPct: ${Math.round((monthEntries / allTime) * 100)},
  features: ${monthTags.feature ?? 0},
  fixes: ${monthTags.fix ?? 0},
  latestVersion: ${q(latest.version)},
};
`;
writeFileSync(resolve(root, "app", "src", "lib", "celebrationStats.ts"), s);
console.log(
  `celebrationStats.ts  ${monthName} ${monthEntries} entries · ${monthRels.length} releases · ` +
    `${allTime} all-time · feature ${monthTags.feature ?? 0} · fix ${monthTags.fix ?? 0} · latest ${latest.version}`,
);
