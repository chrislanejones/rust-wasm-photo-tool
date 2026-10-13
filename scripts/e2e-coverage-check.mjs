#!/usr/bin/env node
// Every spec in e2e/ runs in CI (Night 10-07 §3.1).
//
// CI used to run a HAND-KEPT list of e2e files, and it fell behind: 23 of 49
// specs never ran, including the two that protect the saved format. CI now
// runs the whole directory under playwright.config.ts, so the remaining way
// for a spec to drop out silently is the config's `testIgnore` growing. This
// compares the files Playwright would run against the files on disk, minus
// the exclusions named below, and fails on any difference.
//
// The exclusions are listed HERE as well as in the config on purpose: adding
// one takes two edits, and the second is a reviewer's chance to ask why.
import { execFileSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(import.meta.url), "..", "..");
const E2E = join(ROOT, "e2e");
const EXCLUDED = [
  (p) => p.startsWith(`sw${sep}`), // playwright.sw.config.ts, its own build
  (p) => p.startsWith(`archive${sep}`), // one-off sweeps, kept to read
  (p) => p === "boot-no-keys.spec.ts", // playwright.nokeys.config.ts, a keyless build
];

function specs(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return specs(p);
    return name.endsWith(".spec.ts") ? [relative(E2E, p)] : [];
  });
}

const onDisk = specs(E2E).filter((p) => !EXCLUDED.some((x) => x(p))).sort();
const listed = execFileSync("pnpm", ["exec", "playwright", "test", "--list", "--reporter=json"], {
  cwd: ROOT,
  encoding: "utf8",
  maxBuffer: 64 * 1024 * 1024,
});
const report = JSON.parse(listed.slice(listed.indexOf("{")));
const files = new Set();
const walk = (suite) => {
  if (suite.file) files.add(suite.file.split("/").join(sep));
  (suite.suites ?? []).forEach(walk);
};
report.suites.forEach(walk);
const run = [...files].sort();

const missing = onDisk.filter((p) => !files.has(p));
const extra = run.filter((p) => !onDisk.includes(p));
if (missing.length || extra.length) {
  console.error(`FAIL e2e-coverage: ${onDisk.length} specs on disk, ${run.length} in the run`);
  for (const p of missing) console.error(`  not run: e2e/${p}`);
  for (const p of extra) console.error(`  run but excluded here: e2e/${p}`);
  console.error("Run it, or move it to e2e/archive/ and say why in the file.");
  process.exit(1);
}
console.log(`ok e2e-coverage: all ${run.length} specs in e2e/ run (excluded: sw/, archive/, boot-no-keys)`);
