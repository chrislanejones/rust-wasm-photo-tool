// OPEN-D — read-modify-write audit.
//
// ADR-024 asks what happens to the op log and undo ordering when engine calls
// become asynchronous. Two thirds of that question already have a structural
// answer and do not need measuring:
//
//   ORDER IS ARRIVAL ORDER. `OpLog::append` (src/ops.rs:1004) applies the op to
//   `live` and pushes it in one step. There is no caller-supplied sequence
//   number or timestamp — the log's order IS the order calls reach the engine.
//   A Worker's message port is FIFO, so as long as every mutation goes through
//   ONE port, postMessage order == append order and the log is unchanged.
//
//   EACH OP IS ATOMIC. `apply` (src/ops.rs:651) is a synchronous match that
//   mutates the document and returns. Nothing can interleave inside an op.
//
// So the danger is not ordering. It is READ-MODIFY-WRITE on the JS side: code
// that reads engine state, decides something from it, and then mutates. Today
// the read is synchronous, so nothing can change between the read and the
// write. Behind a worker the read resolves on a LATER TASK, and any mutation
// queued in the meantime lands first — the decision is then made on state that
// no longer exists.
//
// This script counts those sequences. Two shapes, in rising order of danger:
//
//   GUARD   a read feeds a condition that gates a later mutation
//             if (t.layer_count() > 1) t.merge_down();
//   FEED    a read's value is passed as an argument to a later mutation
//             const n = t.active_layer_id(); t.set_layer_opacity(n, 0.5);
//
// LIMITS — read these before quoting the number. This is a lexical scan, not a
// dataflow analysis. It works within a single brace-balanced function body and
// will miss a read and write split across functions, across an existing await,
// or threaded through a ref. It cannot see whether an interleaving is actually
// reachable. Treat the output as a WORK LIST to review by hand, not a verdict.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.argv[2] ?? process.cwd();
const DTS = join(ROOT, "app/src/hooks/stamp_tool.d.ts");
const SRC = join(ROOT, "app/src");

// --- engine surface, split into reads and mutations -----------------------
const dts = readFileSync(DTS, "utf8");
const reads = new Set();
const mutations = new Set();
for (const m of dts.matchAll(/^\s{4}([a-z_][a-z0-9_]*)\s*\(([^)]*)\)\s*:\s*([A-Za-z0-9_<>\[\]| ]+);/gim)) {
  const [, name, , ret] = m;
  if (name === "constructor" || name === "free") continue;
  if (/^\s*void\s*$/.test(ret)) mutations.add(name);
  else reads.add(name);
}
for (const m of dts.matchAll(/^\s{4}(?:readonly\s+)?([a-z_][a-z0-9_]*)\s*:/gim)) {
  if (m[1] !== "constructor") reads.add(m[1]);
}

function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(e) && !/\.test\.tsx?$/.test(e) && !e.endsWith(".d.ts")) out.push(p);
  }
  return out;
}

const HANDLE = String.raw`(?:toolRef\.current|\btool\b|\bengine\b|\bt\b)\??\.`;

/** Brace-balanced blocks that look like function bodies, as [startLine,endLine]. */
function bodies(lines) {
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    if (!/(function|=>|\)\s*\{)\s*$|=>\s*\{/.test(lines[i])) continue;
    let depth = 0, started = false;
    for (let j = i; j < Math.min(lines.length, i + 400); j++) {
      for (const ch of lines[j]) {
        if (ch === "{") { depth++; started = true; }
        else if (ch === "}") depth--;
      }
      if (started && depth <= 0) { out.push([i, j]); break; }
    }
  }
  return out;
}

const findings = [];
for (const file of walk(SRC)) {
  const rel = relative(ROOT, file);
  const lines = readFileSync(file, "utf8").split("\n");

  for (const [a, b] of bodies(lines)) {
    const span = lines.slice(a, b + 1);

    // reads in this body, with the variable they land in (if any)
    const readHits = [];
    span.forEach((line, k) => {
      const re = new RegExp(HANDLE + `([a-z_][a-z0-9_]*)\\s*\\(`, "gi");
      let m;
      while ((m = re.exec(line)) !== null) {
        if (!reads.has(m[1])) continue;
        const before = line.slice(0, m.index);
        if (/^\s*(?:void\s+)?$/.test(before)) continue;           // bare call, value unused
        if (/\bawait\b/.test(before)) continue;                    // already async here
        const assigned = before.match(/(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*$/);
        const inCond = /\bif\s*\($|\bwhile\s*\($|\?\s*$|&&\s*$|\|\|\s*$/.test(before.trim());
        readHits.push({ k, name: m[1], varName: assigned?.[1] ?? null, inCond });
      }
    });
    if (!readHits.length) continue;

    // mutations that occur AFTER a read in the same body
    span.forEach((line, k) => {
      const re = new RegExp(HANDLE + `([a-z_][a-z0-9_]*)\\s*\\(([^)]*)\\)`, "gi");
      let m;
      while ((m = re.exec(line)) !== null) {
        const name = m[1], args = m[2] ?? "";
        if (!mutations.has(name)) continue;
        for (const r of readHits) {
          if (r.k >= k) continue;
          // A re-declaration of the engine handle between the read and the
          // write means they are in DIFFERENT callbacks that the brace scan
          // lumped together. Hand-checking the first run found this is the
          // dominant false positive: useSelectionActions:115 and :263 are
          // separate callbacks, each opening with `const tool = ...`.
          const between = span.slice(r.k + 1, k);
          if (between.some((l) => /(?:const|let)\s+(?:tool|engine|t)\s*=/.test(l))) continue;
          // Second boundary, found the same way: useHistory's `undo` (:27) and
          // `clearHistory` (:67) are separate useCallbacks that both reach the
          // engine as `toolRef.current?.`, so no handle is re-declared between
          // them. A new callback/function assignment is the boundary.
          if (between.some((l) => /=\s*(?:async\s*)?(?:useCallback\s*\(|\([^)]*\)\s*=>|function\b)/.test(l))) continue;
          let shape = null;
          if (r.varName && new RegExp(`\\b${r.varName}\\b`).test(args)) shape = "FEED";
          else if (r.inCond || (r.varName && span.slice(r.k, k).some((l) => new RegExp(`if\\s*\\(.*\\b${r.varName}\\b`).test(l)))) shape = "GUARD";
          if (!shape) continue;
          findings.push({
            file: rel,
            readLine: a + r.k + 1, read: r.name,
            writeLine: a + k + 1, write: name,
            shape,
          });
        }
      }
    });
  }
}

// de-dupe identical (file, readLine, writeLine)
const seen = new Set();
const uniq = findings.filter((f) => {
  const key = `${f.file}:${f.readLine}:${f.writeLine}:${f.write}`;
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
});

const byShape = { GUARD: 0, FEED: 0 };
const byFile = new Map();
for (const f of uniq) {
  byShape[f.shape]++;
  byFile.set(f.file, (byFile.get(f.file) ?? 0) + 1);
}

console.log(`engine surface: ${reads.size} reads, ${mutations.size} mutations\n`);
console.log(`READ-MODIFY-WRITE SEQUENCES: ${uniq.length}`);
console.log(`  GUARD (read gates a later mutation) ${byShape.GUARD}`);
console.log(`  FEED  (read's value is an argument) ${byShape.FEED}\n`);
console.log("BY FILE");
for (const [f, n] of [...byFile].sort((x, y) => y[1] - x[1])) {
  console.log(`  ${String(n).padStart(3)}  ${f}`);
}
console.log("\nSITES");
for (const f of uniq.sort((x, y) => x.file.localeCompare(y.file) || x.readLine - y.readLine)) {
  console.log(`  ${f.shape.padEnd(5)} ${f.file}:${f.readLine} ${f.read}() → :${f.writeLine} ${f.write}()`);
}
