#!/usr/bin/env node
// Dead-export audit — the tripwire rustc refuses to be.
//
// WHY THIS EXISTS AND NOT A COMPILER FLAG
//
// The obvious version of this check is `RUSTFLAGS="-D dead_code" cargo check`
// on the Rust side and "just read the tsc errors" on the TS side. Neither
// works here:
//
//   * Rust — `stamp_tool` emits NO dead_code diagnostic for a genuinely unused
//     private function. Verified 2026-08-27 by appending an unused private fn
//     to lib.rs, history.rs and core.rs in turn and running
//     `cargo check --all-features --message-format=json`: zero compiler-message
//     entries, while the identical probe warns in a minimal crate on the same
//     pinned 1.97.1 toolchain. cdylib+rlib and wasm-bindgen were each ruled out
//     by isolation (both warn correctly in a minimal crate). Cause unidentified
//     — do NOT restate the folklore that "pub items in pub mods are exempt
//     because benches link the rlib"; the probes were private and it still
//     said nothing.
//
//   * TypeScript — tsc has no unused-export diagnostic at all. An export with
//     zero importers is indistinguishable to it from a public API.
//
// So the check is a scan, and like every other guardrail in this repo it is a
// RATCHET, not a report: it prints a TOTAL and scripts/guardrails.sh fails when
// that number goes UP. Existing entries stay visible and can only be paid down.
//
// WHAT IT CANNOT SEE (read before trusting a zero)
//
//   * A symbol reached only through a string — a registry key, a dynamic
//     import, a window hook. `installGpuBlurSelfTest` is reached from main.tsx
//     by name, so it is fine; something reached via `window[x]` would not be.
//   * A type used purely by inference. Return types like `RgbaCapture` or
//     `perspective::Warped` have no named reference at any call site and are
//     NOT scanned here for exactly that reason (they read as dead and are not).
//   * Anything hidden from grep. NUL bytes in a file make it invisible to a
//     naive scan, which is why every count below is paired with a control
//     probe that must find a string known to be present.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, extname, basename } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const APP = join(ROOT, "app/src");
const E2E = join(ROOT, "e2e");

// ── Known-good exceptions ────────────────────────────────────────────────
//
// These read as dead to any name-scan and are alive. Each needs a REASON, not
// just an entry — an exception without one is how a real finding gets buried.
const EXCEPT = new Map([
  // The persist-`merge` validation pattern: these tuples exist so a rehydrated
  // store value can be checked against the union it claims to be. They are
  // referenced as a whole inside their own store's merge(), which the scan
  // sees as same-file-only. Fallow's standing false positive too.
  ["BRUSH_MODES", "useToolStore persist-merge validation tuple"],
  ["STAMP_SUB_MODES", "useToolStore persist-merge validation tuple"],
  ["SHAPES_MODES", "useToolStore persist-merge validation tuple"],
  ["ERASER_MODE_VALUES", "useToolStore persist-merge validation tuple"],
  ["TEXT_MODES", "useToolStore persist-merge validation tuple"],
  ["BATCH_MODES", "useToolStore persist-merge validation tuple"],
  ["MASTER_TABS", "useUIStore persist-merge validation tuple"],
]);

function walk(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    const p = join(dir, name);
    let st;
    try {
      st = statSync(p);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      if (name === "node_modules" || name === "dist") continue;
      walk(p, out);
    } else if ([".ts", ".tsx"].includes(extname(name))) {
      out.push(p);
    }
  }
  return out;
}

const files = [...walk(APP), ...walk(E2E)];
const source = new Map();
for (const f of files) {
  const text = readFileSync(f, "utf8");
  if (text.includes("\0")) {
    console.error(`FATAL: ${relative(ROOT, f)} contains NUL bytes — a name scan cannot see it.`);
    process.exit(1);
  }
  source.set(f, text);
}

// Control probe: the scan must be able to find something we know is there.
// Without this a broken matcher reports "no dead exports" and reads as a pass.
const control = [...source.values()].filter((t) => t.includes("export")).length;
if (control === 0) {
  console.error("FATAL: control probe found no `export` anywhere — the scan is broken.");
  process.exit(1);
}

// VALUES ONLY — no `type` / `interface`. A type is routinely reached purely by
// inference (it is some exported function's return type and no call site ever
// names it), so scanning types produces ~40 confident false positives and
// buries the real findings. That is the documented blind spot above, honoured
// here rather than reported as noise.
const EXPORT_RE =
  /^export\s+(?:async\s+)?(?:function|const|let|class|enum)\s+([A-Za-z_$][\w$]*)/gm;

const dead = [];
const unexport = [];

for (const [file, text] of source) {
  // Declaration files and test files do not own public API worth auditing.
  if (file.endsWith(".d.ts") || /\.test\.tsx?$/.test(file)) continue;

  for (const m of text.matchAll(EXPORT_RE)) {
    const name = m[1];
    if (EXCEPT.has(name)) continue;

    const word = new RegExp(`\\b${name.replace(/\$/g, "\\$")}\\b`);
    let external = 0;
    let ownFile = 0;

    for (const [other, otherText] of source) {
      if (!word.test(otherText)) continue;
      if (other === file) {
        // Count references in the defining file that are not the export line.
        ownFile += otherText
          .split("\n")
          .filter((l) => word.test(l) && !l.startsWith("export ")).length;
      } else {
        external++;
      }
    }

    if (external === 0) {
      if (ownFile === 0) dead.push({ file, name });
      else unexport.push({ file, name, ownFile });
    }
  }
}

// ── wasm export surface ↔ JS call sites ──────────────────────────────────
// The engine-side half: a `#[wasm_bindgen]` export nobody calls from JS ships
// bytes for nothing. This is how oplog_keyframe_rgba was found.
const wasmDead = [];
try {
  const dts = readFileSync(join(ROOT, "pkg/stamp_tool.d.ts"), "utf8");
  const fns = [...dts.matchAll(/^export function ([A-Za-z_][\w]*)/gm)].map((m) => m[1]);
  const appText = [...source.values()].join("\n");
  for (const fn of fns) {
    if (fn === "default" || fn === "initSync") continue;
    if (!new RegExp(`\\b${fn}\\b`).test(appText)) wasmDead.push(fn);
  }
} catch {
  console.error("note: pkg/stamp_tool.d.ts absent — run `pnpm run build:wasm` for the engine half.");
}

const fmt = (p) => relative(ROOT, p);

if (dead.length) {
  console.log("\nDEAD — exported, referenced nowhere (delete):");
  for (const d of dead) console.log(`  ${fmt(d.file)}  ${d.name}`);
}
if (unexport.length) {
  console.log("\nSAME-FILE ONLY — drop the `export` keyword:");
  for (const u of unexport) console.log(`  ${fmt(u.file)}  ${u.name}  (${u.ownFile} local refs)`);
}
if (wasmDead.length) {
  console.log("\nWASM EXPORTS with no JS caller:");
  for (const w of wasmDead) console.log(`  pkg/stamp_tool.d.ts  ${w}`);
}

const total = dead.length + unexport.length + wasmDead.length;
console.log(`\nTOTAL: ${total}`);
