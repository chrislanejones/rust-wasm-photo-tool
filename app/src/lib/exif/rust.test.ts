// Beta "EXIF in Rust": the cross-check's three outcomes, and the switch.
import { describe, it, expect, afterEach, vi } from "vitest";

const logs: string[] = [];
vi.mock("@/lib/diagnosticsLog", () => ({ logDiagnostic: (_s: string, m: string) => logs.push(m) }));
vi.mock("@/lib/engineGate", () => ({ importEngine: async () => ({}) }));

const store = new Map<string, string>();
vi.stubGlobal("window", { localStorage: { getItem: (k: string) => store.get(k) ?? null } });

const { crossCheck, rustExif, setRustExifForTests } = await import("./rust");
const { stripMetadata } = await import("./index");

const B = (...n: number[]) => new Uint8Array(n) as Uint8Array<ArrayBuffer>;
const fake = (strip: (b: Uint8Array) => Uint8Array) => ({
  strip,
  read: () => undefined,
  verbatim: (b: Uint8Array) => b,
  reencoded: (b: Uint8Array) => b,
});

afterEach(() => {
  logs.length = 0;
  store.clear();
  setRustExifForTests(null);
});

describe("EXIF in Rust (Beta)", () => {
  it("off: the Rust functions are never consulted, even when loaded", () => {
    setRustExifForTests(fake(() => B(9)));
    expect(rustExif()).toBeNull();
    expect(stripMetadata(B(1, 2, 3), "all")).toEqual(B(1, 2, 3));
  });

  it("agree: the Rust bytes are used and nothing is logged", () => {
    const out = crossCheck("t", () => B(1, 2), B(1, 2));
    expect(out).toEqual(B(1, 2));
    expect(logs).toEqual([]);
  });

  it("disagree: the TypeScript bytes are used and the mismatch is logged", () => {
    const ts = B(1, 2);
    const out = crossCheck("t", () => B(1, 2, 3), ts);
    expect(out).toBe(ts);
    expect(logs[0]).toMatch(/MISMATCH — Rust 3 B vs TypeScript 2 B; used TypeScript/);
  });

  it("Rust throws: the TypeScript bytes, and the error is logged", () => {
    const ts = B(7);
    expect(crossCheck("t", () => { throw new Error("boom"); }, ts)).toBe(ts);
    expect(logs[0]).toMatch(/threw, used TypeScript: Error: boom/);
  });

  it("on and loaded: a public function routes through the cross-check", () => {
    store.set("ih_exif_rust", "1");
    setRustExifForTests(fake(() => B(42)));
    // Unknown bytes: TypeScript passes them through unchanged, the fake Rust
    // returns something else, so the TS result wins and the diff is logged.
    expect(stripMetadata(B(5, 6), "all")).toEqual(B(5, 6));
    expect(logs[0]).toMatch(/stripMetadata MISMATCH/);
  });
});
