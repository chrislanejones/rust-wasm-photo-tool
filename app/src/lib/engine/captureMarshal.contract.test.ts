// ADR-024 a12.4 — a boxed capture must survive the worker boundary.
//
// THE PROPERTY. Seven engine methods return a wasm-bindgen struct. Their fields
// are PROTOTYPE ACCESSORS, and `postMessage` structured-clones own data
// properties only — so before a12.4 the main thread received `{ __wbg_ptr }`,
// with every field `undefined` and no `free`. `readUiSnapshot` then threw in its
// `finally`, and `syncState` runs after essentially every mutation, so React's
// mirror of the engine was dead behind the flag.
//
// The first test below reproduces that mechanism against the real
// `structuredClone` rather than asserting it from the outside, because the whole
// bug is a fact about structured clone that four green gates did not encode.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  isCaptureStruct,
  marshalCapture,
  readCaptureFields,
  rehydrateCapture,
} from "./captureMarshal";

/** A stand-in with wasm-bindgen's exact shape: fields as prototype accessors,
 *  `__wbg_ptr` as the only own property, and a hand-called `free`. */
class FakeCapture {
  __wbg_ptr = 1114112;
  freed = 0;
  reads: string[] = [];
  #w = 2078;
  #rgba = new Uint8Array([1, 2, 3, 4]);
  get width(): number {
    this.reads.push("width");
    return this.#w;
  }
  get layers_json(): string {
    this.reads.push("layers_json");
    return "[]";
  }
  get rgba(): Uint8Array {
    this.reads.push("rgba");
    return this.#rgba;
  }
  free(): void {
    this.freed += 1;
  }
}

describe("the mechanism", () => {
  it("structured clone strips a capture down to its pointer", () => {
    // This is the bug, reproduced. If this test ever fails because clone starts
    // carrying accessors, the marshalling below becomes unnecessary — but that
    // is not the platform we have.
    const cloned = structuredClone(new FakeCapture()) as Record<string, unknown>;
    expect(Object.keys(cloned)).toContain("__wbg_ptr");
    expect(cloned.width).toBeUndefined();
    expect(typeof cloned.free).toBe("undefined");
  });
});

describe("isCaptureStruct", () => {
  it("recognises a boxed struct", () => {
    expect(isCaptureStruct(new FakeCapture())).toBe(true);
  });

  it("rejects plain values, and the engine handle itself", () => {
    // BOTH halves of the test matter: a plain object carrying `__wbg_ptr` (a
    // reply coming back the other way) must not be mistaken for a struct, and
    // an engine handle — which has `free` but no own `__wbg_ptr` on a Proxy —
    // must never be flattened and freed by accident.
    expect(isCaptureStruct(null)).toBe(false);
    expect(isCaptureStruct(42)).toBe(false);
    expect(isCaptureStruct({ width: 1 })).toBe(false);
    expect(isCaptureStruct({ __wbg_ptr: 7 })).toBe(false);
    expect(isCaptureStruct({ free: () => {} })).toBe(false);
  });
});

describe("readCaptureFields", () => {
  it("copies every accessor and nothing else", () => {
    const fields = readCaptureFields(new FakeCapture());
    expect(fields).toEqual({ width: 2078, layers_json: "[]", rgba: new Uint8Array([1, 2, 3, 4]) });
    // The dangling pointer must NOT travel: on the far side it indexes another
    // thread's linear memory, and a number that looks like a handle is worse
    // than no handle.
    expect("__wbg_ptr" in fields).toBe(false);
    expect("free" in fields).toBe(false);
  });

  it("reads each field EXACTLY once", () => {
    // Not style. `getter_with_clone` copies the whole value out of wasm on every
    // access — 17 MB per read of `rgba` on a 2078² composite.
    const c = new FakeCapture();
    readCaptureFields(c);
    expect(c.reads).toEqual(["width", "layers_json", "rgba"]);
  });
});

describe("marshalCapture", () => {
  it("frees the struct on the side that owns it", () => {
    const c = new FakeCapture();
    marshalCapture(c);
    expect(c.freed).toBe(1);
  });

  it("frees even when a getter throws", () => {
    // wasm memory never shrinks — a leak here would be per-mutation. A getter
    // can trap (a struct freed underneath us), so the release cannot sit on the
    // happy path.
    class Trapped extends FakeCapture {
      get width(): number {
        throw new Error("null pointer passed to rust");
      }
    }
    const c = new Trapped();
    expect(() => marshalCapture(c)).toThrow(/null pointer/);
    expect(c.freed).toBe(1);
  });
});

describe("rehydrateCapture", () => {
  it("gives the fields back with a no-op free", () => {
    const wire = marshalCapture(new FakeCapture());
    const cap = rehydrateCapture(structuredClone(wire));
    expect(cap.width).toBe(2078);
    expect(cap.rgba).toEqual(new Uint8Array([1, 2, 3, 4]));
    // The twelve `cap.free()` call sites stay unchanged across both
    // implementations — that is the point of fixing this at the seam.
    expect(typeof cap.free).toBe("function");
    expect(() => (cap.free as () => void)()).not.toThrow();
  });

  it("survives the round trip a real reply makes", () => {
    const cap = rehydrateCapture(structuredClone(marshalCapture(new FakeCapture())));
    expect(cap.layers_json).toBe("[]");
  });
});

// ── The structural guard ────────────────────────────────────────────────────
//
// The tests above pin the behaviour. This one pins the SCOPE: it fails the
// moment the engine grows another struct-returning method, whether or not
// anyone remembers this file exists. That is the half that would have caught
// the original bug — the behaviour was never wrong, the coverage was.
describe("every struct-returning engine method is accounted for", () => {
  // Anchored on THIS FILE, never on `process.cwd()`. A guard that reads source
  // relative to the launch directory passes vacuously when the suite is started
  // from anywhere else — `readFileSync` throws, but a `walk()` over a missing
  // tree just returns an empty list and every assertion over it succeeds. This
  // repo has shipped a vacuous contract test before (v8.26); the fix is to make
  // the anchor a fact about the file rather than about the caller.
  const HERE = fileURLToPath(new URL(".", import.meta.url)); // app/src/lib/engine/
  const APP = join(HERE, "..", "..", ".."); // app/
  const DTS = join(APP, "..", "pkg", "stamp_tool.d.ts");

  /** Classes wasm-bindgen exports that are NOT the engine itself. Any method
   *  returning one of these is a capture and must cross via this module. */
  function boxedClasses(dts: string): string[] {
    return [...dts.matchAll(/^export class (\w+)/gm)]
      .map((m) => m[1])
      .filter((n) => n !== "ImageHorseTool");
  }

  it("returns only classes this module can marshal", () => {
    const dts = readFileSync(DTS, "utf8");
    const classes = boxedClasses(dts);
    // Sanity: if this ever reads zero classes the guard has gone vacuous — a
    // contract test that passes because it tested nothing is a shape this repo
    // has shipped before (v8.26).
    expect(classes.length).toBeGreaterThan(3);

    const returners = [
      ...dts.matchAll(/^\s{4}(\w+)\(([^)]*)\):\s*(\w+);/gm),
    ].filter((m) => classes.includes(m[3]));

    // Every one of these is flattened by `isCaptureStruct` + `marshalCapture`
    // at the worker, and rebuilt by `rehydrateCapture` at the client. The
    // detection is structural (own `__wbg_ptr` + prototype `free`), so it covers
    // any class shaped like these — the assertion is that the LIST is what we
    // think it is, so a new shape shows up as a failure here.
    expect(returners.map((m) => m[1]).sort()).toEqual([
      "capture_composite",
      "capture_composite_excluding_background",
      "capture_layer_stack",
      "capture_pen_hit",
      "capture_thumbnail",
      "capture_ui_state",
      "export_dims_excluding_background",
    ]);
  });

  it("the worker marshals before it replies", () => {
    // Guards the WIRING, not the helper: the helper being right is worth
    // nothing if `drain()` stops calling it. Reads the worker source rather
    // than standing up a Worker, which vitest's node environment cannot do.
    const worker = readFileSync(
      join(APP, "src", "workers", "engine.worker.ts"),
      "utf8",
    );
    expect(worker).toMatch(/isCaptureStruct\(value\)/);
    expect(worker).toMatch(/marshalCapture\(/);
    const client = readFileSync(
      join(APP, "src", "lib", "engine", "workerClient.ts"),
      "utf8",
    );
    expect(client).toMatch(/rehydrateCapture\(/);
  });
});
