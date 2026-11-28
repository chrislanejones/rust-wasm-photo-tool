// ADR-112 guard: archives written by master's v6 encoder (v9.83) still read,
// byte for byte, as v9.83 read them. See __fixtures__/archive/README.md.
//
// NOT red-first, and it can't be: the reader only grows. It is here so that the
// next change to the reader that misreads an old archive fails here first.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { decodeArchive } from "./editArchive";

const DIR = join(__dirname, "__fixtures__", "archive");
const revive = (_k: string, v: unknown) =>
  v && typeof v === "object" && "u8" in (v as object) ? Uint8Array.from((v as { u8: number[] }).u8) : v;

describe("v6 archives from master's encoder", () => {
  for (const name of ["v6-callout-box-rect", "v6-two-layers", "v6-no-history"]) {
    it(`${name} decodes exactly as v9.83 decoded it`, () => {
      const bytes = new Uint8Array(readFileSync(join(DIR, `${name}.bin`)));
      const before = bytes.slice();
      const expected = JSON.parse(readFileSync(join(DIR, `${name}.expected.json`), "utf8"), revive);
      expect(decodeArchive(bytes)).toEqual(expected);
      expect(bytes, "the reader never writes to its input").toEqual(before);
    });
  }
});
