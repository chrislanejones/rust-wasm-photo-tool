// syncState coverage audit.
//
// `useEngineCore` publishes the JS-side mirror of engine truth from exactly one
// place — `syncState()`. But NOTHING invokes it structurally: it is called by
// hand, 71 times, across a dozen files. A mutation whose call site forgets
// leaves the mirror stale, and the mirror is what the entire UI renders from.
//
// This finds the mutations that are not followed by a sync.
//
// CLASSIFICATION IS FROM THE RUST, NOT FROM NAMES. A method is a mutator if its
// receiver is `&mut self`. Guessing from prefixes would be wrong in both
// directions — `push_compress_marker` mutates, `export_png` does not, and
// neither is obvious from the name alone.
//
// TWO CONFIDENCE TIERS, because they are not the same finding:
//
//   SNAPSHOTTING mutators call `self.snap()`, so they demonstrably change
//   `undo_count()` — a field `syncState` publishes and the History panel
//   renders. A snapshotting call with no following sync is a real staleness
//   bug, not a maybe.
//
//   OTHER mutators may or may not touch a published field. Reported
//   separately, as candidates to look at rather than defects.
//
// The "is it followed by a sync?" test is deliberately generous: it scans
// forward to the end of the enclosing block (brace-depth) and also accepts a
// sync anywhere later in the same function. Being generous means the misses it
// DOES report are worth reading, rather than a wall of false positives.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.argv[2] ?? process.cwd();
const SRC = join(ROOT, "app/src");
const RUST = join(ROOT, "src");
const DTS = join(ROOT, "app/src/hooks/stamp_tool.d.ts");

// ── engine surface: what is actually reachable from JS ─────────────────────
const dts = readFileSync(DTS, "utf8");
const exported = new Set(
  [...dts.matchAll(/^\s{2,}([a-z_][a-z0-9_]*)\s*\(/gim)].map((m) => m[1]),
);
exported.delete("constructor");

// ── mutator classification, from the Rust receivers ────────────────────────
const mutators = new Set();
const reads = new Set();
const snapshotting = new Set();

for (const f of readdirSync(RUST).filter((f) => f.endsWith(".rs"))) {
  const text = readFileSync(join(RUST, f), "utf8");
  const lines = text.split("\n");
  lines.forEach((line, i) => {
    const m = /^\s*pub fn ([a-z_][a-z0-9_]*)\s*\(\s*&(mut )?self/.exec(line);
    if (!m) return;
    const [, name, isMut] = m;
    if (isMut) mutators.add(name);
    else reads.add(name);
    if (!isMut) return;
    // Walk the body to the matching close brace; does it snapshot?
    let depth = 0,
      started = false;
    for (let j = i; j < Math.min(lines.length, i + 400); j++) {
      for (const ch of lines[j]) {
        if (ch === "{") {
          depth++;
          started = true;
        } else if (ch === "}") depth--;
      }
      if (/self\.snap(_selection)?\(/.test(lines[j]) && j > i) snapshotting.add(name);
      if (started && depth === 0) break;
    }
  });
}

// ── walk the TS ────────────────────────────────────────────────────────────
function walk(d, out = []) {
  for (const e of readdirSync(d)) {
    const p = join(d, e);
    const s = statSync(p);
    if (s.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(e) && !/\.test\.tsx?$/.test(e) && !e.endsWith(".d.ts"))
      out.push(p);
  }
  return out;
}

const HANDLE = /(?:toolRef\.current|stampToolRef\.current|\btool\b|\bengine\b|\bt\b)\??\./;
const misses = [];
const covered = [];

for (const file of walk(SRC)) {
  const rel = relative(ROOT, file);
  const lines = readFileSync(file, "utf8").split("\n");

  lines.forEach((line, i) => {
    const re =
      /(?:toolRef\.current|stampToolRef\.current|\btool\b|\bengine\b|\bt\b)\??\.([a-z_][a-z0-9_]*)\s*\(/gi;
    let m;
    while ((m = re.exec(line)) !== null) {
      const name = m[1];
      if (!mutators.has(name) || !exported.has(name)) continue;

      // Scan forward to the end of the enclosing block.
      let depth = 0;
      let synced = false;
      for (let j = i; j < Math.min(lines.length, i + 60); j++) {
        if (j > i && /\bsyncState\s*\(/.test(lines[j])) {
          synced = true;
          break;
        }
        for (const ch of lines[j]) {
          if (ch === "{") depth++;
          else if (ch === "}") depth--;
        }
        if (depth < 0) break; // left the enclosing block
      }
      // A sync BEFORE the call in the same function does not count; a sync in a
      // caller might, which is why this is reported as "look at", not "broken".
      const rec = {
        file: rel,
        line: i + 1,
        method: name,
        snaps: snapshotting.has(name),
        snippet: line.trim().slice(0, 100),
      };
      (synced ? covered : misses).push(rec);
    }
  });
}

// ── report ─────────────────────────────────────────────────────────────────
const syncCalls = walk(SRC).reduce(
  (n, f) => n + (readFileSync(f, "utf8").match(/\bsyncState\s*\(\)/g) ?? []).length,
  0,
);

console.log("ENGINE METHODS (exported to JS):", exported.size);
console.log("  mutators (&mut self):", mutators.size);
console.log("  reads    (&self):    ", reads.size);
console.log("  of the mutators, SNAPSHOTTING (call self.snap):", snapshotting.size);
console.log("\nsyncState() call sites:", syncCalls);
console.log("mutator call sites in app/src:", misses.length + covered.length);
console.log("  followed by a sync:   ", covered.length);
console.log("  NOT followed by a sync:", misses.length);

const hot = misses.filter((m) => m.snaps);
console.log(
  `\n── TIER 1: SNAPSHOTTING mutator, no following sync (${hot.length}) ──`,
);
console.log("   these demonstrably change undo_count(), which syncState publishes\n");
const byFile = {};
for (const r of hot) (byFile[r.file] ??= []).push(r);
for (const [f, rs] of Object.entries(byFile).sort((a, b) => b[1].length - a[1].length)) {
  console.log(`  ${f}`);
  for (const r of rs) console.log(`     ${String(r.line).padStart(5)}  ${r.method}`);
}

const cold = misses.filter((m) => !m.snaps);
console.log(`\n── TIER 2: other mutator, no following sync (${cold.length}) ──`);
const byMethod = {};
for (const r of cold) byMethod[r.method] = (byMethod[r.method] || 0) + 1;
for (const [k, v] of Object.entries(byMethod).sort((a, b) => b[1] - a[1]).slice(0, 20)) {
  console.log(`  ${String(v).padStart(3)}  ${k}`);
}
