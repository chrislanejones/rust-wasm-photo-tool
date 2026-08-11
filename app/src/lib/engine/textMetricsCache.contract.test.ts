// ADR-024 Stage 3.5 a2 — the guard on the assumption `textMetricsCache` rests on.
//
// The cache is only correct because the three engine methods it wraps are PURE
// FUNCTIONS OF THEIR ARGUMENTS. If that ever stops being true, a cache keyed on
// the arguments returns a confidently wrong answer — text laid out against
// stale metrics, on the render path, with nothing to catch it. That is a worse
// failure than the synchronous read it replaced.
//
// So the assumption is TESTED, not remembered. Source-level and against the
// Rust, because the property lives there: a JS test could only observe that the
// current build happens to agree with itself.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  measureText,
  textInkOffset,
  measureTextAwaited,
  textInkOffsetBgAwaited,
  primeTextMetrics,
  textMetricsCacheSize,
  resetTextMetricsCache,
} from "./textMetricsCache";

const CRATE = join(process.cwd(), "..", "src");
const rust = (f: string) => readFileSync(join(CRATE, f), "utf8");

/** Body of a `pub fn name(...)` / `pub(crate) fn name(...)`, brace-matched. */
function fnBody(src: string, name: string): string {
  const decl = new RegExp(`(?:pub(?:\\(crate\\))?\\s+)?fn\\s+${name}\\s*[(<]`).exec(src);
  if (!decl) throw new Error(`could not find fn ${name}`);
  const open = src.indexOf("{", decl.index);
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") {
      depth--;
      if (depth === 0) return src.slice(open + 1, i);
    }
  }
  throw new Error(`unbalanced braces in ${name}`);
}

describe("the wrapped engine methods read no engine state", () => {
  // Each wrapper takes `&self` — a wasm-bindgen calling convention — and must
  // forward straight to a free function. `self.` appearing in a body would mean
  // the result depends on the document, and the cache key would be incomplete.
  it("measure_text delegates to a free function and never touches self", () => {
    const body = fnBody(rust("lib.rs"), "measure_text");
    expect(body).toContain("crate::text::measure(");
    expect(
      body.replace(/crate::text::measure\([^)]*\)/g, ""),
      "measure_text reads engine state — the metrics cache key is now incomplete. " +
        "Read textMetricsCache.ts's header before changing this.",
    ).not.toMatch(/\bself\s*\./);
  });

  it("crate::text::measure is a free function", () => {
    expect(
      rust("text.rs"),
      "text::measure gained a receiver — it is no longer pure in its arguments",
    ).toMatch(/pub fn measure\(\s*text:\s*&str,\s*font_size:\s*f32,\s*bold:\s*bool\s*\)/);
  });

  it("text_ink_offset_bg delegates to a free function and never touches self", () => {
    const body = fnBody(rust("annotations.rs"), "text_ink_offset_bg");
    expect(body).toContain("crate::layer::annotation_ink_offset(");
    expect(
      body.replace(/crate::layer::annotation_ink_offset\([\s\S]*?\)/g, ""),
      "text_ink_offset_bg reads engine state — the metrics cache key is now incomplete",
    ).not.toMatch(/\bself\s*\./);
  });

  it("annotation_ink_offset is a free function", () => {
    expect(
      rust("layer.rs"),
      "annotation_ink_offset gained a receiver — it is no longer pure in its arguments",
    ).toMatch(/fn annotation_ink_offset\(\s*\n?\s*text:\s*&str/);
  });

  it("annotation_ink_offset's own inputs are all arguments or consts", () => {
    // Its body may call other helpers; what it must NOT do is reach a document.
    const body = fnBody(rust("layer.rs"), "annotation_ink_offset");
    expect(body).not.toMatch(/\bself\b/);
  });
});

describe("the cache behaves like a memo, not a mirror", () => {
  // ⚠️ REWRITTEN v8.14 (ADR-024 b1). The sync readers no longer call the engine
  // at all — a render pass cannot await, so `cached()` is a pure lookup and the
  // cache is filled off the render path by `primeTextMetrics` (or, for callers
  // that can await, by the awaited twins). These tests therefore FILL through
  // the async API and READ through the sync one.
  //
  // Three of them used to count engine calls made BY the sync readers, which is
  // now structurally impossible. The eviction test is the one worth pausing on:
  // it kept passing after the change and had become VACUOUS — it filled via
  // `measureText`, which now stores nothing, so "size <= 512" held at zero. A
  // check that cannot fail is not a check.
  const fakeTool = (calls?: string[]) =>
    ({
      measure_text: (t: string, sz: number, b: boolean) => {
        calls?.push(`m|${t}|${sz}|${b}`);
        return new Uint32Array([t.length * sz, sz]);
      },
      text_ink_offset: (t: string, sz: number, b: boolean) => {
        calls?.push(`i|${t}|${sz}|${b}`);
        return new Int32Array([1, 2]);
      },
      text_ink_offset_bg: (
        t: string,
        sz: number,
        b: boolean,
        k: number,
        pad: number,
      ) => {
        calls?.push(`b|${t}|${sz}|${b}|${k}|${pad}`);
        return new Int32Array([k, pad]);
      },
    }) as unknown as Parameters<typeof primeTextMetrics>[0];

  it("returns undefined rather than guessing on a miss", async () => {
    resetTextMetricsCache();
    // A wrong number here would be laid out as if it were right. Both readers
    // have a documented fallback; neither wants a fabricated metric.
    expect(measureText(null, "hello", 24, false)).toBeUndefined();
    expect(textInkOffset(undefined, "hello", 24, false)).toBeUndefined();
    // ...and passing a live tool does NOT change that, which is the v8.14
    // behaviour change: the sync readers cannot reach the engine any more.
    expect(measureText(fakeTool(), "hello", 24, false)).toBeUndefined();
    expect(textMetricsCacheSize(), "a miss must not store anything").toBe(0);
  });

  it("a primed entry is what the sync reader returns", async () => {
    resetTextMetricsCache();
    const calls: string[] = [];
    const fake = fakeTool(calls);
    expect(await primeTextMetrics(fake, "hi", 24, false)).toBe(true);
    expect(calls.length, "prime fills BOTH keys the render path reads").toBe(2);
    expect(measureText(fake, "hi", 24, false)).toEqual([2 * 24, 24]);
    expect(textInkOffset(fake, "hi", 24, false)).toEqual([1, 2]);
    // Priming an already-warm pair must report false, or the caller re-renders
    // forever.
    expect(await primeTextMetrics(fake, "hi", 24, false)).toBe(false);
    expect(calls.length, "a warm prime must not reach the engine").toBe(2);
  });

  it("keys on every argument, so no two calls can collide", async () => {
    resetTextMetricsCache();
    const calls: string[] = [];
    const fake = fakeTool(calls);
    await primeTextMetrics(fake, "hi", 24, false);
    const base = calls.length;
    await primeTextMetrics(fake, "hi", 24, true); // bold differs
    await primeTextMetrics(fake, "hi", 25, false); // size differs
    await primeTextMetrics(fake, "hi ", 24, false); // trailing space
    expect(calls.length, "each distinct argument set is its own entry").toBe(base + 6);
    // The bg variant keys separately from the plain one on shared arguments.
    await textInkOffsetBgAwaited(fake, "hi", 24, false, 0, 0);
    expect(await textInkOffsetBgAwaited(fake, "hi", 24, false, 2, 8)).toEqual([2, 8]);
    expect(await textInkOffsetBgAwaited(fake, "hi", 24, false, 1, 4)).toEqual([1, 4]);
  });

  it("separator cannot be forged out of the other arguments", async () => {
    resetTextMetricsCache();
    const seen = new Set<string>();
    const fake = {
      measure_text: (t: string, sz: number, b: boolean) => {
        seen.add(`${t}|${sz}|${b}`);
        return new Uint32Array([1, 1]);
      },
    } as unknown as Parameters<typeof measureTextAwaited>[0];
    // Text containing the separator character must not alias another entry.
    await measureTextAwaited(fake, "24 0 x", 1, false);
    await measureTextAwaited(fake, "x", 24, false);
    expect(seen.size, "two distinct argument sets collided into one cache key").toBe(2);
  });

  it("evicts oldest-first and stays bounded", async () => {
    resetTextMetricsCache();
    const fake = {
      measure_text: () => new Uint32Array([1, 1]),
    } as unknown as Parameters<typeof measureTextAwaited>[0];
    for (let i = 0; i < 600; i++) await measureTextAwaited(fake, `t${i}`, 24, false);
    // Guard against the vacuous version of this test: it must actually be full.
    expect(textMetricsCacheSize(), "nothing was cached — the test proves nothing").toBe(512);
    expect(
      textMetricsCacheSize(),
      "unbounded growth — a long typing session would leak one entry per keystroke",
    ).toBeLessThanOrEqual(512);
  });
});
