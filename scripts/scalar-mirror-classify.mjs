// Classify every category-B scalar call site by whether a React-state mirror
// could actually replace it.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
const ROOT = process.argv[2];
const SRC = join(ROOT, "app/src");
const SCALARS = new Set(["width","height","layer_count","active_layer_id","content_layer_count"]);

function walk(d, out=[]) {
  for (const e of readdirSync(d)) {
    const p = join(d,e), s = statSync(p);
    if (s.isDirectory()) walk(p,out);
    else if (/\.(ts|tsx)$/.test(e) && !/\.test\.tsx?$/.test(e) && !e.endsWith(".d.ts")) out.push(p);
  }
  return out;
}
const rows = [];
for (const f of walk(SRC)) {
  const rel = relative(ROOT,f);
  const text = readFileSync(f,"utf8");
  // Does this file even have React state available?
  const isReact = /^import (?!type )[^;]*from "react"/m.test(text);
  const isPublisher = /useEngineCore\.ts$/.test(rel);
  text.split("\n").forEach((line,i) => {
    const re = /(?:toolRef\.current|\btool\b|\bengine\b|\bt\b|stampToolRef\.current)\??\.([a-z_][a-z0-9_]*)\s*\(/gi;
    let m;
    while ((m = re.exec(line)) !== null) {
      if (!SCALARS.has(m[1])) continue;
      const before = line.slice(0,m.index);
      if (/^\s*(?:void\s+)?$/.test(before)) continue; // fire-and-forget
      rows.push({
        file: rel, line: i+1, method: m[1],
        klass: isPublisher ? "publisher-internal" : isReact ? "react-reachable" : "plain-module",
      });
    }
  });
}
const by = {};
for (const r of rows) by[r.klass] = (by[r.klass]||0)+1;
console.log("SCALAR value-consumed sites:", rows.length);
for (const [k,v] of Object.entries(by).sort()) console.log(`  ${k.padEnd(20)} ${v}`);
console.log("\nPLAIN MODULES (no React state — a mirror cannot reach these):");
for (const r of rows.filter(r=>r.klass==="plain-module")) console.log(`  ${r.file}:${r.line}  ${r.method}`);
console.log("\nREACT-REACHABLE (the only genuinely repointable set):");
for (const r of rows.filter(r=>r.klass==="react-reachable")) console.log(`  ${r.file}:${r.line}  ${r.method}`);
