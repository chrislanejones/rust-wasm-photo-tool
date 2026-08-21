// #60 — THE DRIFT GUARD FOR annotationHitTest.ts.
//
// WHY THIS EXISTS. `annotationHitTest.ts` is a hand port of two Rust functions,
// and `annotationHitTest.test.ts` pins it with 21 cases. Those 21 tests check
// TYPESCRIPT AGAINST TYPESCRIPT. Change the bounds in `annotations.rs` and every
// one of them still passes while the two implementations silently disagree —
// the port keeps answering the old question perfectly.
//
// A test that cannot fail on the condition you care about is not a test. This
// one hashes the Rust bodies the port mirrors, so editing the original fails
// here and names the file that has to follow.
//
// WHAT IT DELIBERATELY DOES NOT DO. It does not check that the port is
// CORRECT — nothing here can. It checks that the Rust has not moved since a
// human last confirmed the port matched it. Those are different claims and
// conflating them would be worse than having no guard: a green checksum means
// "the source is unchanged", never "the port is right".
//
// ⚠️ EXPIRY, STATED. v8.56 replaces the port with one engine call returning
// (layer, id). When that lands, DELETE this file and `annotationHitTest.ts`
// together — a drift guard outliving the thing it guards is pure friction, and
// the next person will assume it is load-bearing and work around it.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

/** The Rust file whose logic `annotationHitTest.ts` mirrors. */
const RUST_SOURCE = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../src/annotations.rs",
);

/** The two functions the port reproduces. */
const MIRRORED = ["text_annotation_at", "shape_annotation_at"] as const;

/**
 * Extract one `pub fn <name>` body by brace-matching from its opening `{`.
 *
 * A real parser is out of scope (and the stop-condition for this task said so):
 * these two bodies contain no braces inside string literals or comments, which
 * is the only thing a counter gets wrong. If that ever stops being true the
 * hash changes, this test fails, and a human reads it — which is the same
 * outcome as a genuine drift, just with a boring cause.
 */
function extractBody(src: string, fnName: string): string {
  const sig = `pub fn ${fnName}`;
  const at = src.indexOf(sig);
  if (at < 0) throw new Error(`${fnName} not found in annotations.rs`);
  const open = src.indexOf("{", at);
  if (open < 0) throw new Error(`no body brace for ${fnName}`);
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") {
      depth--;
      if (depth === 0) return src.slice(open, i + 1);
    }
  }
  throw new Error(`unbalanced braces reading ${fnName}`);
}

/**
 * Normalise before hashing so the guard fires on LOGIC, not on formatting.
 *
 * Dropped: line comments, block comments, and all whitespace runs. Reflowing a
 * comment or letting rustfmt move a line must not cost anyone ten minutes —
 * that is how a guard earns a reputation for crying wolf and gets deleted.
 */
function normalise(body: string): string {
  return body
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "")
    .replace(/\s+/g, "")
    .trim();
}

function hashOf(fnName: string): string {
  const src = readFileSync(RUST_SOURCE, "utf8");
  return createHash("sha256")
    .update(normalise(extractBody(src, fnName)))
    .digest("hex")
    .slice(0, 16);
}

/**
 * Confirmed-matching hashes.
 *
 * TO UPDATE — and only ever in this order:
 *   1. Read the Rust diff. Decide what changed about the RULE.
 *   2. Make `annotationHitTest.ts` match, and add a case to
 *      `annotationHitTest.test.ts` covering the new behaviour.
 *   3. Only then paste the new hash here.
 *
 * Updating the hash first turns this file into a rubber stamp, which is
 * strictly worse than deleting it — it would still look like protection.
 */
const CONFIRMED: Record<(typeof MIRRORED)[number], string> = {
  text_annotation_at: "69fa8d110af212b2",
  shape_annotation_at: "6769816ca3a09358",
};

describe("#60 — annotationHitTest.ts has not drifted from annotations.rs", () => {
  for (const fn of MIRRORED) {
    it(`${fn} is unchanged since the port was confirmed`, () => {
      expect(
        hashOf(fn),
        `\n\n  annotations.rs::${fn} has CHANGED.\n` +
          `  app/src/lib/annotationHitTest.ts is a hand port of it and does NOT\n` +
          `  follow automatically — its own 21 tests check TypeScript against\n` +
          `  TypeScript and will stay green while the two disagree.\n\n` +
          `  Update the port and its tests FIRST, then the hash in this file.\n` +
          `  (If v8.56 has replaced the port with an engine call, delete\n` +
          `   annotationHitTest.ts and this file together instead.)\n`,
      ).toBe(CONFIRMED[fn]);
    });
  }

  it("fails loudly if the Rust file or functions go missing", () => {
    // Guards the guard: a renamed function must not silently pass as "no
    // drift". Without this, `extractBody` throwing is the only signal, and a
    // throw inside a for-loop test reads as an infrastructure error rather
    // than as the finding it is.
    expect(() => hashOf("text_annotation_at")).not.toThrow();
    expect(() => hashOf("definitely_not_a_function")).toThrow();
  });
});
