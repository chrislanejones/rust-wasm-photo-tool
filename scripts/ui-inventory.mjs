#!/usr/bin/env node
// What visual values does this app actually use?
//
// The design vocabulary — spacing, control heights, radii, icon sizes, type,
// z-layers — was never measured, only asserted. A plan can propose "spacing is
// 4 6 8 12 16 20 24 32"; this prints what the code does, so a canonical set is
// chosen from evidence and every value in it can name the count that earned it.
//
// READ-ONLY. It greps and counts. Night 7 turns these counts into a ratchet the
// way `raw-colors` already is in guardrails.sh; tonight it is the instrument,
// not the gate.
//
// ── WHY THE SELF-TESTS ──────────────────────────────────────────────────────
// A zero from a broken regex looks exactly like a zero from clean code, and
// this repo has been bitten by that shape more than once (guardrails.sh opens
// with two paragraphs about an `rg` that could not see anything and reported
// every check green). So:
//
//   1. rg must exist AND find a token in a file we just wrote.
//   2. Every family carries a PROBE — a string known to be in the codebase —
//      and a family whose probe finds nothing prints VACUOUS and exits 1.
//
// ── WHAT IT CANNOT DO ───────────────────────────────────────────────────────
// It reads TEXT, so it cannot tell a class from prose about a class — the same
// limit `scripts/inert-class-audit.mjs` carries, and the same one that turned
// guardrails red on a comment once. Two of the values in the first run were
// comments: `rounded-square` (GalleryBar, describing a shape) and `z-1`
// (PenOverlay, naming the layer below it). Neither is a utility and neither
// emits CSS. A value with a count of 1 is worth opening before it is worth
// believing. This is also why the counts here are an INSTRUMENT and not a gate:
// a ratchet that goes red on a sentence is the failure mode, not the feature.
//
// Usage:
//   node scripts/ui-inventory.mjs            histograms, human readable
//   node scripts/ui-inventory.mjs --json     the same numbers, machine readable
//   node scripts/ui-inventory.mjs --raw hgt  every matching line for one family
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const SRC = "app/src";
const JSON_OUT = process.argv.includes("--json");
const RAW_FAMILY = (() => {
  const i = process.argv.indexOf("--raw");
  return i === -1 ? null : process.argv[i + 1];
})();

/** rg exits 0 on match, 1 on no match, >=2 on error. Only >=2 is a problem —
 *  and it is the one that must never be read as "zero violations". */
function rg(args) {
  try {
    const out = execFileSync("rg", args, { cwd: ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
    return out.split("\n").filter(Boolean);
  } catch (err) {
    if (err.status === 1) return [];
    console.error(`FATAL: rg failed (exit ${err.status}) on: rg ${args.join(" ")}`);
    console.error(String(err.stderr || err.message).slice(0, 400));
    process.exit(1);
  }
}

function assertRipgrepWorks() {
  const dir = mkdtempSync(join(tmpdir(), "ui-inv-"));
  const file = join(dir, "probe.txt");
  writeFileSync(file, "ui-inventory-selftest-token\n");
  let ok = false;
  try {
    ok = execFileSync("rg", ["-c", "ui-inventory-selftest-token", file], { encoding: "utf8" }).trim() === "1";
  } catch {
    ok = false;
  }
  rmSync(dir, { recursive: true, force: true });
  if (!ok) {
    console.error("FATAL: ripgrep is missing or not functioning. Refusing to report counts I cannot substantiate.");
    process.exit(1);
  }
}

/**
 * A family of visual values.
 *
 * `pattern`   what to look for (rg regex)
 * `extract`   pull the VALUE out of a matching line, for the histogram
 * `probe`     a literal known to exist in the repo; if it is not found, the
 *             pattern is broken and the family reports VACUOUS
 * `globs`     extra rg globs, e.g. excluding the token files themselves
 */
const FAMILIES = [
  {
    id: "hgt",
    title: "Control heights",
    pattern: String.raw`\b(h|min-h|max-h)-(\[[0-9.]+px\]|[0-9]+(\.[0-9]+)?)\b`,
    extract: (s) => s.match(/\b(?:h|min-h|max-h)-(?:\[[0-9.]+px\]|[0-9]+(?:\.[0-9]+)?)\b/g) ?? [],
    probe: "min-h-11",
  },
  {
    id: "pad",
    title: "Padding and gaps",
    pattern: String.raw`\b(p|px|py|pt|pb|pl|pr|gap|gap-x|gap-y|space-x|space-y)-(\[[0-9.]+px\]|[0-9]+(\.[0-9]+)?)\b`,
    extract: (s) =>
      s.match(/\b(?:p|px|py|pt|pb|pl|pr|gap|gap-x|gap-y|space-x|space-y)-(?:\[[0-9.]+px\]|[0-9]+(?:\.[0-9]+)?)\b/g) ?? [],
    probe: "gap-2",
  },
  {
    id: "rad",
    title: "Radii",
    pattern: String.raw`\brounded(-[a-z]+)?(-\[[^\]]+\])?\b`,
    extract: (s) => s.match(/\brounded(?:-[a-z]+)?(?:-\[[^\]]+\])?\b/g) ?? [],
    probe: "rounded-lg",
  },
  {
    id: "icon",
    title: "Icon sizes",
    pattern: String.raw`\bsize-[0-9]+\b|\bsize=\{[0-9]+\}|\bh-[0-9]+ w-[0-9]+\b`,
    extract: (s) => s.match(/\bsize-[0-9]+\b|\bsize=\{[0-9]+\}|\bh-[0-9]+ w-[0-9]+\b/g) ?? [],
    probe: "size-4",
  },
  {
    id: "text",
    title: "Text sizes",
    pattern: String.raw`\btext-(\[[0-9.]+px\]|2xs|xs|sm|base|lg|xl|[0-9]xl)\b`,
    extract: (s) => s.match(/\btext-(?:\[[0-9.]+px\]|2xs|xs|sm|base|lg|xl|[0-9]xl)\b/g) ?? [],
    probe: "text-xs",
  },
  {
    id: "z",
    title: "Z-layers",
    pattern: String.raw`\bz-(\[[^\]]+\]|[0-9]+)\b`,
    extract: (s) => s.match(/\bz-(?:\[[^\]]+\]|[0-9]+)\b/g) ?? [],
    probe: "z-[var(--z-mobile)]",
  },
  {
    id: "color",
    title: "Raw colors (outside the token files)",
    // Mirrors guardrails' raw-colors question, widened to hex and rgba so the
    // inventory sees literals the palette check does not.
    pattern: String.raw`#[0-9a-fA-F]{3,8}\b|\brgba?\(`,
    extract: (s) => s.match(/#[0-9a-fA-F]{3,8}\b|\brgba?\(/g) ?? [],
    probe: "rgba(",
    globs: ["-g", "!**/colors.ts", "-g", "!**/styles.ts"],
  },
  {
    id: "arb",
    title: "Arbitrary pixel values (the entropy score)",
    pattern: String.raw`\[[0-9.]+px\]`,
    extract: (s) => s.match(/\[[0-9.]+px\]/g) ?? [],
    probe: "[58px]",
  },
];

function measure(family) {
  const globs = ["-g", "*.tsx", "-g", "*.ts", ...(family.globs ?? [])];
  const lines = rg(["-n", "--no-heading", family.pattern, SRC, ...globs]);
  const counts = new Map();
  let total = 0;
  const files = new Set();
  for (const line of lines) {
    const [file, , ...rest] = line.split(":");
    files.add(file);
    for (const value of family.extract(rest.join(":"))) {
      counts.set(value, (counts.get(value) ?? 0) + 1);
      total += 1;
    }
  }
  // Anti-vacuity: a family that cannot find its own probe is not "clean".
  const probeHits = rg(["-c", "--no-heading", "-F", family.probe, SRC, ...globs]).length;
  return {
    id: family.id,
    title: family.title,
    total,
    fileCount: files.size,
    distinct: counts.size,
    vacuous: probeHits === 0,
    probe: family.probe,
    values: [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])),
    lines,
  };
}

assertRipgrepWorks();

if (RAW_FAMILY) {
  const family = FAMILIES.find((f) => f.id === RAW_FAMILY);
  if (!family) {
    console.error(`no family "${RAW_FAMILY}". Known: ${FAMILIES.map((f) => f.id).join(", ")}`);
    process.exit(1);
  }
  for (const line of measure(family).lines) console.log(line);
  process.exit(0);
}

const results = FAMILIES.map(measure);
const vacuous = results.filter((r) => r.vacuous);

if (JSON_OUT) {
  console.log(
    JSON.stringify(
      {
        measuredAt: new Date().toISOString().slice(0, 10),
        families: results.map(({ lines, ...rest }) => rest),
      },
      null,
      2,
    ),
  );
} else {
  console.log(`UI inventory — ${SRC}, ${new Date().toISOString().slice(0, 10)}\n`);
  for (const r of results) {
    const head = `${r.title}: ${r.total} uses, ${r.distinct} distinct, ${r.fileCount} files`;
    console.log(r.vacuous ? `${head}   ⚠️ VACUOUS (probe "${r.probe}" not found)` : head);
    // Long tails are the point, but a 90-value dump is unreadable: show the top
    // 18 and say how many are left. `--raw <id>` prints everything.
    const shown = r.values.slice(0, 18);
    for (const [value, n] of shown) {
      const bar = "█".repeat(Math.max(1, Math.round((n / r.values[0][1]) * 28)));
      console.log(`   ${String(n).padStart(4)}  ${value.padEnd(22)} ${bar}`);
    }
    if (r.values.length > shown.length) {
      const rest = r.values.slice(shown.length);
      const restTotal = rest.reduce((a, [, n]) => a + n, 0);
      const once = rest.filter(([, n]) => n === 1).length;
      console.log(`   … ${rest.length} more values, ${restTotal} uses, of which ${once} used exactly once`);
    }
    console.log("");
  }
  const singles = results.reduce((a, r) => a + r.values.filter(([, n]) => n === 1).length, 0);
  console.log(`Values used exactly once, across every family: ${singles}`);
  console.log("A value used three times is a candidate token; a value used once is an exception or a deletion.");
}

if (vacuous.length) {
  console.error(`\nFATAL: ${vacuous.length} family/families found nothing for a probe that exists. A zero from a broken regex is not a clean result.`);
  process.exit(1);
}
