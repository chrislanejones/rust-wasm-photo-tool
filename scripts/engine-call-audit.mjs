// Phase 2 — sync→async audit.
//
// Enumerates every call into the wasm engine from app/src and categorises it by
// what a worker migration would cost:
//   (a) fire-and-forget          — return value unused; a postMessage suffices
//   (b) value-consumed-sync      — the HARD ones; each needs a Promise + rewrite
//   (c) per-frame hot path       — round-trip latency is a design problem
//
// Method names come from the engine's own .d.ts rather than a hand-written list,
// so a method added to the engine cannot silently escape the audit.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.argv[2] ?? process.cwd();
const DTS = join(ROOT, "app/src/hooks/stamp_tool.d.ts");
const SRC = join(ROOT, "app/src");

// --- engine surface -------------------------------------------------------
const dts = readFileSync(DTS, "utf8");
const methods = new Set(
  [...dts.matchAll(/^\s{4}([a-z_][a-z0-9_]*)\s*\(/gim)].map((m) => m[1]),
);
// getters/readonly props are reads too
for (const m of dts.matchAll(/^\s{4}(?:readonly\s+)?([a-z_][a-z0-9_]*)\s*:/gim)) {
  methods.add(m[1]);
}
methods.delete("constructor");

// --- files ----------------------------------------------------------------
function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    const s = statSync(p);
    if (s.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(e) && !/\.test\.tsx?$/.test(e) && !e.endsWith(".d.ts")) out.push(p);
  }
  return out;
}

// Files/functions where a round trip lands inside an interaction loop.
const HOT_FILE = /useDrawingTools|useCloneStamp|usePaintTool|useMagicEraser|CanvasArea|LassoOverlay|useMoveLayerTool|usePastePlacementTool|useColorPicker/;
const HOT_CTX = /pointermove|onPointerMove|requestAnimationFrame|flushToCanvas|hover|preview|stroke|drag/i;

const rows = [];
for (const file of walk(SRC)) {
  const rel = relative(ROOT, file);
  const lines = readFileSync(file, "utf8").split("\n");
  lines.forEach((line, i) => {
    // a call on the engine handle: tool.foo(  /  toolRef.current.foo(  /  engine.foo(
    const re = /(?:toolRef\.current|\btool\b|\bengine\b)\??\.([a-z_][a-z0-9_]*)\s*\(/gi;
    let m;
    while ((m = re.exec(line)) !== null) {
      const name = m[1];
      if (!methods.has(name)) continue;
      const before = line.slice(0, m.index);
      // Consumed if the call feeds an assignment, condition, return, arg, await,
      // property access, or template — i.e. anything but a bare statement.
      const bare = /^\s*(?:void\s+)?$/.test(before);
      const consumed = !bare;
      const ctx = lines.slice(Math.max(0, i - 6), i + 2).join("\n");
      const hot = HOT_FILE.test(rel) && HOT_CTX.test(ctx);
      rows.push({
        file: rel,
        line: i + 1,
        method: name,
        category: hot ? "c-hot-path" : consumed ? "b-value-consumed" : "a-fire-and-forget",
        snippet: line.trim().slice(0, 110),
      });
    }
  });
}

// --- report ---------------------------------------------------------------
const byCat = {};
const byFile = {};
for (const r of rows) {
  byCat[r.category] = (byCat[r.category] || 0) + 1;
  byFile[r.file] ??= { a: 0, b: 0, c: 0 };
  byFile[r.file][r.category[0]]++;
}

console.log("ENGINE METHODS DECLARED:", methods.size);
console.log("TOTAL CALL SITES:", rows.length);
console.log("\nBY CATEGORY:");
for (const [k, v] of Object.entries(byCat).sort()) console.log(`  ${k.padEnd(20)} ${v}`);

console.log("\nBY FILE (a=fire-and-forget, b=value-consumed, c=hot-path):");
const files = Object.entries(byFile).sort((x, y) => (y[1].a + y[1].b + y[1].c) - (x[1].a + x[1].b + x[1].c));
for (const [f, c] of files) {
  console.log(`  ${String(c.a + c.b + c.c).padStart(3)}  a=${String(c.a).padStart(3)} b=${String(c.b).padStart(3)} c=${String(c.c).padStart(2)}  ${f}`);
}

console.log("\nTOP METHODS IN CATEGORY B (each needs a Promise + call-site rewrite):");
const bMethods = {};
for (const r of rows.filter((r) => r.category === "b-value-consumed")) {
  bMethods[r.method] = (bMethods[r.method] || 0) + 1;
}
for (const [m, n] of Object.entries(bMethods).sort((a, b) => b[1] - a[1]).slice(0, 25)) {
  console.log(`  ${String(n).padStart(3)}  ${m}`);
}

console.log("\nCATEGORY C — HOT PATH SITES:");
for (const r of rows.filter((r) => r.category === "c-hot-path")) {
  console.log(`  ${r.file}:${r.line}  ${r.method}`);
}
