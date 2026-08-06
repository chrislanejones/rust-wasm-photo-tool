// Phase 1 — which engine operations have an undo that does not undo?
//
// `snap()` captures LAYER PIXELS. An operation that changes a non-pixel
// parameter and snaps therefore records a History entry whose restore is a
// no-op: undo consumes a step, puts back identical pixels, and the parameter
// stays where the user left it. Confirmed for export quality.
//
// The mirror image is a parameter setter that never snaps at all — the change
// is simply not undoable, and no History entry appears either.
//
// THREE BUCKETS, and only two are bugs:
//
//   A. snaps + writes pixels        → normal. Undo reverses it.
//   B. snaps + writes NO pixels     → the "undo that does not undo" class.
//   C. no snap + mutates state      → not undoable at all.
//
// CLASSIFICATION IS FROM THE RUST. A method is a mutator if its receiver is
// `&mut self`; it "writes pixels" if its body reaches layer buffer data or the
// pixel modules. Both are structural facts, not name heuristics — and the name
// heuristic would be wrong in both directions here (`push_compress_marker`
// mutates and writes no pixels; `set_artboard_border` sounds like a parameter
// and rewrites the whole document).
//
// THIS IS A SHORTLIST GENERATOR, NOT A VERDICT. The syncState audit this
// morning was 75% false-positive on its top tier because a static scan cannot
// see one hop of indirection — a helper that snaps, a caller that syncs. Expect
// the same here and hand-verify every hit before believing it.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.argv[2] ?? process.cwd();
const RUST = join(ROOT, "src");
const DTS = join(ROOT, "app/src/hooks/stamp_tool.d.ts");

// Only methods reachable from JS matter — an internal helper is not an
// operation a user can invoke.
const dts = readFileSync(DTS, "utf8");
const exported = new Set(
  [...dts.matchAll(/^\s{2,}([a-z_][a-z0-9_]*)\s*\(/gim)].map((m) => m[1]),
);
exported.delete("constructor");

// Reaching any of these means the body touched image data.
const PIXEL_WRITE =
  /\.buf\.data|\.data\[|copy_from_slice|fill\(|filters::|drawing::|paint::|transform::|stamp::|patchmatch::|effects::|edges::|blit|resize_pixels|composite|set_pixel|load_image|\bpixels\b/;

const rows = [];

for (const file of readdirSync(RUST).filter((f) => f.endsWith(".rs"))) {
  const lines = readFileSync(join(RUST, file), "utf8").split("\n");
  lines.forEach((line, i) => {
    const m = /^\s*pub fn ([a-z_][a-z0-9_]*)\s*\(\s*&mut self/.exec(line);
    if (!m) return;
    const name = m[1];
    if (!exported.has(name)) return;

    // Walk the body to its matching close brace.
    let depth = 0,
      started = false,
      snaps = false,
      pixels = false,
      end = i;
    for (let j = i; j < Math.min(lines.length, i + 500); j++) {
      const l = lines[j];
      if (j > i) {
        if (/self\.snap(_selection)?\s*\(/.test(l)) snaps = true;
        if (PIXEL_WRITE.test(l)) pixels = true;
      }
      for (const ch of l) {
        if (ch === "{") {
          depth++;
          started = true;
        } else if (ch === "}") depth--;
      }
      end = j;
      if (started && depth === 0) break;
    }

    rows.push({
      file,
      line: i + 1,
      name,
      snaps,
      pixels,
      lines: end - i,
      bucket: snaps ? (pixels ? "A-normal" : "B-marker-only") : pixels ? "C-pixels-no-snap" : "C-param-no-snap",
    });
  });
}

const by = {};
for (const r of rows) by[r.bucket] = (by[r.bucket] || 0) + 1;

console.log("EXPORTED MUTATORS EXAMINED:", rows.length);
for (const [k, v] of Object.entries(by).sort()) console.log(`  ${k.padEnd(20)} ${v}`);

const b = rows.filter((r) => r.bucket === "B-marker-only");
console.log(`\n── B: SNAPS BUT WRITES NO PIXELS (${b.length}) ──`);
console.log("   candidate 'undo that does not undo' — hand-verify each\n");
for (const r of b) console.log(`  ${r.file}:${r.line}  ${r.name}  (${r.lines} lines)`);

const c = rows.filter((r) => r.bucket === "C-param-no-snap");
console.log(`\n── C: NO SNAP, NO PIXEL WRITE (${c.length}) ──`);
console.log("   candidate 'not undoable at all' — many will be legitimately");
console.log("   transient (editing state, cursors, live previews)\n");
for (const r of c) console.log(`  ${r.file}:${r.line}  ${r.name}  (${r.lines} lines)`);

const cp = rows.filter((r) => r.bucket === "C-pixels-no-snap");
console.log(`\n── C': WRITES PIXELS WITHOUT SNAPPING (${cp.length}) ──`);
console.log("   expected for stroke-interior calls that snap at begin_stroke;");
console.log("   anything else here is a missing undo step\n");
for (const r of cp) console.log(`  ${r.file}:${r.line}  ${r.name}`);
