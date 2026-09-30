// The source-walking half of the ADR-024 contract tests, in one place.
//
// Three contract files (ownership, async-migration, canvas-surface-key) each
// carried their own copy of `walk` / `rel` / `code` and the same anchoring
// warning. One implementation now; a fix to how comments are stripped, or to
// which files count, lands once.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// ⚠️ ANCHORED ON THIS FILE, NEVER ON THE LAUNCH DIRECTORY (v8.30). A source-walking
// guard that resolves relative to the launch directory reads ZERO files when
// vitest is started from the repo root — `<repo>/src` is the Rust crate and has
// no `.ts` in it — so `walk()` returns an empty list and every assertion over it
// passes VACUOUSLY. Verified by planting a real violation: from the repo root
// the guard stayed green; from `app/` it caught it.
export const APP_ROOT = fileURLToPath(new URL("../../../", import.meta.url));
export const REPO = join(APP_ROOT, "..");
export const SRC = join(APP_ROOT, "src");

/** Every .ts/.tsx under app/src, excluding specs and .d.ts. */
export function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(e) && !/\.test\.tsx?$/.test(e) && !e.endsWith(".d.ts")) out.push(p);
  }
  return out;
}

export const rel = (f: string) => f.split("/src/")[1] ?? f;

/** Comments stripped — same reasoning as the ownership contract: a guard that
 *  matches the identifier inside the comment explaining it is satisfied by its
 *  own documentation. */
export const code = (f: string) =>
  readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

export const FILES = walk(SRC);
